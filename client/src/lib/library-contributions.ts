import { useSyncExternalStore } from "react";
import type { ContentType, ItemKind } from "@/content/library";
import type { Role } from "./clinician-portal";
import { allConditions, CONTENT_TYPES, findCondition } from "./library";

// What clinicians add to the Library (browser comment 15): a piece of content placed on one condition's page, in one
// of that page's parts (Understand, Explore or Treat & manage, Live well, Watch & listen), with who added it and when.
// The Library's own content is written into content/library.ts; there is no backend for it yet, so in this preview a
// contribution is kept on this device only. Nothing is reviewed or published to anyone else until there is one.

export const LIBRARY_CONTRIBUTIONS_KEY = "rehyn.library.contributions.v1";

/** This copy is Rehyn Connect for clinicians: everyone signed in is a clinician unless they chose to join as a patient. */
export const CLINICIAN_EDITION = true;

/** The one check for the "Add to library" control. Patients never get it, in either edition. */
export function canContributeToLibrary(role: Role | null, clinicianEdition = CLINICIAN_EDITION): boolean {
  if (role === "patient") return false;
  return role === "clinician" || clinicianEdition;
}

/** The kinds of piece a clinician can add, from the Library's own (ItemKind), in the order the form offers them. */
export const CONTRIBUTION_KINDS: ItemKind[] = ["article", "video", "podcast", "exercise", "research"];

export const CONTRIBUTION_LIMITS = { title: { min: 3, max: 120 }, summary: { min: 10, max: 300 }, body: { max: 4000 }, url: { max: 500 } } as const;

export type ContributionAuthor = { clinicianId: string; name: string; title: string; photo: string | null; initials: string };

export type LibraryContribution = {
  id: string;
  /** Where it sits: the Library's group and condition (content/library.ts), and the part of the condition page. */
  groupId: string;
  conditionId: string;
  category: ContentType;
  kind: ItemKind;
  title: string;
  summary: string;
  body?: string;
  url?: string;
  author: ContributionAuthor;
  /** When it was added, in milliseconds. */
  createdAt: number;
};

/** The form as typed: every field a string, the selects empty until chosen. */
export type ContributionDraft = { groupId: string; conditionId: string; category: string; kind: string; title: string; summary: string; body: string; url: string };
export type ContributionField = keyof ContributionDraft;
export type ContributionErrors = Partial<Record<ContributionField, string>>;

export const EMPTY_DRAFT: ContributionDraft = { groupId: "", conditionId: "", category: "", kind: "article", title: "", summary: "", body: "", url: "" };

/** A web address the card can open: http or https, with a host. */
export function isWebAddress(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

type Checked = { ok: true; value: Omit<LibraryContribution, "id" | "author" | "createdAt"> } | { ok: false; errors: ContributionErrors };

/** Checks the form against the Library's taxonomy and the limits, and gives back the trimmed content or each field's problem. */
export function validateContribution(draft: ContributionDraft): Checked {
  const errors: ContributionErrors = {};
  const title = draft.title.trim();
  const summary = draft.summary.trim();
  const body = draft.body.trim();
  const url = draft.url.trim();
  const place = findCondition(draft.groupId, draft.conditionId);

  if (!draft.groupId) errors.groupId = "Choose the group this belongs to.";
  else if (!allConditions().some(entry => entry.group.id === draft.groupId)) errors.groupId = "That group isn't in the Library. Choose one from the list.";
  if (!draft.conditionId) errors.conditionId = "Choose the condition.";
  else if (!place) errors.conditionId = "That condition isn't in the chosen group. Choose one from the list.";
  if (!draft.category) errors.category = "Choose the part of the page it goes under.";
  else if (!CONTENT_TYPES.includes(draft.category as ContentType)) errors.category = "Choose a category from the list.";
  if (!CONTRIBUTION_KINDS.includes(draft.kind as ItemKind)) errors.kind = "Choose what kind of content this is.";

  const { title: titleLimit, summary: summaryLimit } = CONTRIBUTION_LIMITS;
  if (!title) errors.title = "Add a title.";
  else if (title.length < titleLimit.min) errors.title = `Use at least ${titleLimit.min} characters.`;
  else if (title.length > titleLimit.max) errors.title = `Keep the title to ${titleLimit.max} characters (it is ${title.length}).`;
  if (!summary) errors.summary = "Add a short summary.";
  else if (summary.length < summaryLimit.min) errors.summary = `Use at least ${summaryLimit.min} characters.`;
  else if (summary.length > summaryLimit.max) errors.summary = `Keep the summary to ${summaryLimit.max} characters (it is ${summary.length}).`;
  if (body.length > CONTRIBUTION_LIMITS.body.max) errors.body = `Keep the full text to ${CONTRIBUTION_LIMITS.body.max} characters (it is ${body.length}).`;
  if (url && url.length > CONTRIBUTION_LIMITS.url.max) errors.url = `Keep the link to ${CONTRIBUTION_LIMITS.url.max} characters.`;
  else if (url && !isWebAddress(url)) errors.url = "Enter a full web address starting with https://";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: { groupId: draft.groupId, conditionId: draft.conditionId, category: draft.category as ContentType, kind: draft.kind as ItemKind, title, summary, ...(body ? { body } : {}), ...(url ? { url } : {}) },
  };
}

/** Saved contributions, keeping only well-formed ones placed somewhere that still exists. */
export function readContributions(raw: string | null): LibraryContribution[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is LibraryContribution => {
      if (!entry || typeof entry !== "object") return false;
      const item = entry as Partial<LibraryContribution>;
      return typeof item.id === "string" && typeof item.title === "string" && typeof item.summary === "string" && typeof item.createdAt === "number"
        && typeof item.groupId === "string" && typeof item.conditionId === "string" && CONTENT_TYPES.includes(item.category as ContentType)
        && Boolean(item.author && typeof item.author.name === "string") && Boolean(findCondition(item.groupId, item.conditionId));
    });
  } catch {
    return [];
  }
}

/** The contributions on one condition's page under one part, newest first. */
export const contributionsFor = (list: LibraryContribution[], groupId: string, conditionId: string, category?: ContentType) =>
  list.filter(item => item.groupId === groupId && item.conditionId === conditionId && (!category || item.category === category)).sort((a, b) => b.createdAt - a.createdAt);

export const SAVE_FAILED = "This couldn't be saved on this device. The browser's storage may be full or turned off (as in some private windows). Your text is still in the form, so you can try again.";

export type SaveResult = { ok: true; contribution: LibraryContribution } | { ok: false; error: string };

export function createContributionStore(access: () => Pick<Storage, "getItem" | "setItem"> | null) {
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; list: LibraryContribution[] } | null = null;
  const load = (): LibraryContribution[] => {
    let raw: string | null = null;
    try { raw = access()?.getItem(LIBRARY_CONTRIBUTIONS_KEY) ?? null; } catch { raw = null; }
    if (!cache || cache.raw !== raw) cache = { raw, list: readContributions(raw) };
    return cache.list;
  };
  /** Writes the new list; nothing changes on screen unless the browser kept it. */
  const write = (next: LibraryContribution[]): string | null => {
    const raw = JSON.stringify(next);
    try {
      const storage = access();
      if (!storage) return SAVE_FAILED;
      storage.setItem(LIBRARY_CONTRIBUTIONS_KEY, raw);
    } catch {
      return SAVE_FAILED;
    }
    cache = { raw, list: next };
    listeners.forEach(listener => listener());
    return null;
  };
  return {
    load,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /** Another tab changed the list: read it again. */
    refresh: () => { cache = null; listeners.forEach(listener => listener()); },
    add(draft: ContributionDraft, author: ContributionAuthor, now = Date.now(), id = `c-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`): SaveResult | { ok: false; errors: ContributionErrors } {
      const checked = validateContribution(draft);
      if (!checked.ok) return checked;
      const contribution: LibraryContribution = { id, ...checked.value, author, createdAt: now };
      const error = write([...load(), contribution]);
      return error ? { ok: false, error } : { ok: true, contribution };
    },
    /** Takes away one of the clinician's own contributions. */
    remove(id: string): string | null {
      const list = load();
      return list.some(item => item.id === id) ? write(list.filter(item => item.id !== id)) : null;
    },
  };
}

export const contributionStore = createContributionStore(() => (typeof localStorage === "undefined" ? null : localStorage));
if (typeof window !== "undefined") window.addEventListener("storage", event => { if (event.key === LIBRARY_CONTRIBUTIONS_KEY) contributionStore.refresh(); });

const NONE: LibraryContribution[] = [];
export const useContributions = () => useSyncExternalStore(contributionStore.subscribe, contributionStore.load, () => NONE);

/** "29 October 2026". */
export const contributionDate = (at: number) => new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
