import { describe, expect, it } from "vitest";
import {
  canContributeToLibrary,
  contributionsFor,
  createContributionStore,
  EMPTY_DRAFT,
  isWebAddress,
  LIBRARY_CONTRIBUTIONS_KEY,
  readContributions,
  SAVE_FAILED,
  validateContribution,
  type ContributionDraft,
} from "./library-contributions";

const AUTHOR = { clinicianId: "amara-osei", name: "Dr Amara Osei", title: "Consultant stroke physician", photo: null, initials: "AO" };
const DRAFT: ContributionDraft = { ...EMPTY_DRAFT, groupId: "stroke", conditionId: "ischaemic", category: "recover", title: "Walking after a stroke", summary: "How to build up walking safely in the first weeks at home." };

function memory() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, values };
}

describe("who can add to the Library", () => {
  it("lets clinicians add, and never patients", () => {
    expect(canContributeToLibrary("clinician")).toBe(true);
    expect(canContributeToLibrary(null)).toBe(true);
    expect(canContributeToLibrary("patient")).toBe(false);
    expect(canContributeToLibrary(null, false)).toBe(false);
    expect(canContributeToLibrary("clinician", false)).toBe(true);
  });
});

describe("checking a contribution", () => {
  it("needs a group, a condition and a category from the Library's own taxonomy", () => {
    const empty = validateContribution({ ...DRAFT, groupId: "", conditionId: "", category: "" });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(Object.keys(empty.errors).sort()).toEqual(["category", "conditionId", "groupId"]);
    const wrong = validateContribution({ ...DRAFT, groupId: "stroke", conditionId: "asthma", category: "news" });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) { expect(wrong.errors.conditionId).toBeTruthy(); expect(wrong.errors.category).toBeTruthy(); expect(wrong.errors.groupId).toBeUndefined(); }
    expect(validateContribution({ ...DRAFT, groupId: "nowhere" }).ok).toBe(false);
  });

  it("checks the title, summary, full text and link", () => {
    const bad = validateContribution({ ...DRAFT, title: "ab", summary: "short", body: "x".repeat(4001), url: "not a link" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(["body", "summary", "title", "url"]);
    expect(isWebAddress("https://www.stroke.org.uk/")).toBe(true);
    expect(isWebAddress("javascript:alert(1)")).toBe(false);
    expect(isWebAddress("ftp://example.com")).toBe(false);
  });

  it("gives back the trimmed content with all three classifications", () => {
    const good = validateContribution({ ...DRAFT, title: "  Walking after a stroke  ", url: " https://www.nhs.uk/conditions/stroke/ " });
    expect(good.ok && good.value).toEqual({ groupId: "stroke", conditionId: "ischaemic", category: "recover", kind: "article", title: "Walking after a stroke", summary: DRAFT.summary, url: "https://www.nhs.uk/conditions/stroke/" });
  });
});

describe("keeping contributions on this device", () => {
  it("saves one where it was placed, with who added it and when", () => {
    const storage = memory();
    const store = createContributionStore(() => storage);
    const result = store.add(DRAFT, AUTHOR, 1000, "c-1");
    expect(result.ok).toBe(true);
    expect(store.load()).toHaveLength(1);
    expect(readContributions(storage.values.get(LIBRARY_CONTRIBUTIONS_KEY) ?? null)[0]).toMatchObject({ id: "c-1", groupId: "stroke", conditionId: "ischaemic", category: "recover", author: AUTHOR, createdAt: 1000 });
    expect(contributionsFor(store.load(), "stroke", "ischaemic", "recover")).toHaveLength(1);
    expect(contributionsFor(store.load(), "stroke", "ischaemic", "understand")).toHaveLength(0);
    expect(store.remove("c-1")).toBeNull();
    expect(store.load()).toHaveLength(0);
  });

  it("says so plainly when the browser won't keep it, and keeps nothing", () => {
    const store = createContributionStore(() => ({ getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); } }));
    expect(store.add(DRAFT, AUTHOR)).toEqual({ ok: false, error: SAVE_FAILED });
    expect(store.load()).toEqual([]);
    expect(createContributionStore(() => null).add(DRAFT, AUTHOR)).toEqual({ ok: false, error: SAVE_FAILED });
  });

  it("does not save a contribution that fails the checks", () => {
    const store = createContributionStore(() => memory());
    const result = store.add({ ...DRAFT, category: "" }, AUTHOR);
    expect(result.ok).toBe(false);
    expect(store.load()).toEqual([]);
  });

  it("drops saved entries that are broken or point somewhere that no longer exists", () => {
    expect(readContributions("not json")).toEqual([]);
    expect(readContributions(JSON.stringify([{ id: "x", groupId: "stroke", conditionId: "gone", category: "recover", title: "t", summary: "s", createdAt: 1, author: AUTHOR }]))).toEqual([]);
  });
});
