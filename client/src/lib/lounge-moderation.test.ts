import { describe, expect, it } from "vitest";
import { applyReport, createModerationStore, needsPerson, parseModeration, reportersOf, seededModeration, statusFor, type ModerationState } from "./lounge-moderation";
import { FALLBACK_CHECK, checkLoungePhoto, readCheckReply } from "./lounge-moderation-check";
import { classifyScore, readPhotoScores, riskFromScores, type PhotoScores } from "./lounge-moderation-rules";

const zero: PhotoScores = { sexual: 0, hate: 0, violence: 0, drugs: 0, medical: 0, alcohol: 0, people: 0, text: 0 };
const NOW = 1_800_000_000_000;
const blank = (): ModerationState => ({ ...seededModeration(NOW), posts: [], reports: [], removals: {}, blocked: [], log: [] });
const rob = { postId: "p1", author: "rob" as const, text: "Double your blood thinners.", reason: "medical" as const };

describe("classifyScore", () => {
  it("passes below the unsure band, blocks above it, and holds everything inside it", () => {
    expect(classifyScore(0.1)).toBe("pass");
    expect(classifyScore(0.349)).toBe("pass");
    expect(classifyScore(0.35)).toBe("unsure");
    expect(classifyScore(0.7)).toBe("unsure");
    expect(classifyScore(0.71)).toBe("block");
    expect(classifyScore(0.5, { low: 0.2, high: 0.45 })).toBe("block");
  });
  it("holds a score it can't read", () => expect(classifyScore(Number.NaN)).toBe("unsure"));
});

describe("riskFromScores", () => {
  it("lets a blocking category count as it is", () => {
    expect(riskFromScores({ ...zero, sexual: 0.92 })).toEqual({ risk: 0.92, labels: ["Sexual or nude content"] });
  });
  it("only lifts review categories into the unsure band, never to a block", () => {
    expect(classifyScore(riskFromScores({ ...zero, alcohol: 1 }).risk)).toBe("unsure");
    expect(classifyScore(riskFromScores({ ...zero, medical: 0.5 }).risk)).toBe("unsure");
    expect(classifyScore(riskFromScores({ ...zero, people: 0.3 }).risk)).toBe("pass");
  });
  it("reads only complete scores", () => {
    expect(readPhotoScores({ ...zero, text: 2 })?.text).toBe(1);
    expect(readPhotoScores({ ...zero, text: "high" })).toBeNull();
    expect(readPhotoScores({ sexual: 0 })).toBeNull();
  });
});

describe("the photo check from the browser", () => {
  const photo = "data:image/jpeg;base64,AAAA";
  const band = { low: 0.35, high: 0.7 };
  it("classifies the server's risk score", async () => {
    const fetcher = (async () => new Response(JSON.stringify({ risk: 0.1, labels: [] }), { status: 200 })) as typeof fetch;
    expect((await checkLoungePhoto(photo, band, { fetcher })).verdict).toBe("pass");
    expect(readCheckReply({ risk: 0.9, labels: ["Illegal drugs"] }, band)?.verdict).toBe("block");
  });
  it("holds the photo when the check has no key, fails or takes too long", async () => {
    const noKey = (async () => new Response(JSON.stringify({ code: "CHECK_NOT_CONFIGURED" }), { status: 503 })) as typeof fetch;
    const broken = (async () => { throw new TypeError("offline"); }) as typeof fetch;
    const slow = ((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as unknown as typeof fetch;
    expect(await checkLoungePhoto(photo, band, { fetcher: noKey })).toEqual(FALLBACK_CHECK);
    expect(await checkLoungePhoto(photo, band, { fetcher: broken })).toEqual(FALLBACK_CHECK);
    expect(await checkLoungePhoto(photo, band, { fetcher: slow, timeoutMs: 10 })).toEqual(FALLBACK_CHECK);
    expect(await checkLoungePhoto("data:image/png;base64,AAAA", band, { fetcher: noKey })).toEqual(FALLBACK_CHECK);
  });
  it("posts a passed photo and holds an unsure one", () => {
    expect(statusFor({ verdict: "pass", score: 0.1, labels: [], source: "model" })).toBe("live");
    expect(statusFor(FALLBACK_CHECK)).toBe("pending_review");
    expect(statusFor(null)).toBe("live");
  });
});

describe("applyReport", () => {
  it("keeps one report per member per post", () => {
    const first = applyReport(blank(), rob, "a", NOW);
    expect(first.outcome).toBe("reported");
    const again = applyReport(first.state, { ...rob, reason: "spam" }, "a", NOW + 1);
    expect(again.outcome).toBe("duplicate");
    expect(again.state.reports).toHaveLength(1);
  });
  it("removes a post at the threshold from different members", () => {
    let state = blank();
    for (const member of ["a", "b"]) state = applyReport(state, rob, member, NOW).state;
    expect(state.removals.p1).toBeUndefined();
    const third = applyReport(state, rob, "c", NOW + 5);
    expect(third.outcome).toBe("removed");
    expect(third.state.removals.p1).toMatchObject({ by: "reports", author: "rob", at: NOW + 5 });
    expect(reportersOf(third.state, "p1")).toEqual(["c", "b", "a"]);
    expect(applyReport(third.state, rob, "d", NOW + 6).outcome).toBe("gone");
  });
  it("follows the threshold setting and leaves a post the care team kept", () => {
    const low = { ...blank(), settings: { ...blank().settings, threshold: 1 } };
    expect(applyReport(low, rob, "a", NOW).outcome).toBe("removed");
    let kept = { ...blank(), kept: ["p1"] };
    for (const member of ["a", "b", "c"]) kept = applyReport(kept, rob, member, NOW).state;
    expect(kept.removals.p1).toBeUndefined();
  });
  it("won't let someone report their own post, and tells the person privately when theirs comes down", () => {
    expect(applyReport(blank(), { ...rob, author: "you" }, "you", NOW).outcome).toBe("own");
    let state = blank();
    for (const member of ["a", "b", "c"]) state = applyReport(state, { ...rob, author: "you" }, member, NOW).state;
    expect(state.notes).toHaveLength(1);
    expect(state.notes[0]).toMatchObject({ kind: "removed", postId: "p1" });
    expect(JSON.stringify(state.notes)).not.toMatch(/"(a|b|c)"/);
  });
});

describe("the moderation store", () => {
  const memoryStorage = () => {
    const items = new Map<string, string>();
    return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
  };

  it("starts with the sample queue and keeps changes", () => {
    const storage = memoryStorage();
    const store = createModerationStore(() => storage);
    expect(needsPerson(store.load()).map(item => (item.kind === "held" ? item.post.author : "appeal"))).toEqual(["michael", "kwame", "priya", "you"]);
    store.approve("seed-priya", NOW);
    store.remove("seed-zak", "you", "", NOW);
    const again = createModerationStore(() => storage).load();
    expect(again.posts.find(post => post.id === "seed-priya")?.status).toBe("live");
    expect(again.posts.find(post => post.id === "seed-zak")?.status).toBe("declined");
    expect(again.notes[0]).toMatchObject({ kind: "declined", postId: "seed-zak" });
    expect(needsPerson(again)).toHaveLength(2);
  });

  it("removes Rob's post when the person makes the third report, and an appeal can put a post back", () => {
    const store = createModerationStore(() => memoryStorage());
    expect(store.report({ postId: "seed-rob", author: "rob", text: "If you feel dizzy…", reason: "medical" }, false, NOW)).toBe("removed");
    expect(store.load().removals["seed-rob"]?.by).toBe("reports");
    store.remove("seed-zak", "you", "", NOW);
    const note = store.load().notes[0];
    store.appeal({ noteId: note.id }, NOW);
    const appeal = needsPerson(store.load()).find(item => item.kind === "appeal");
    expect(appeal).toBeTruthy();
    if (appeal?.kind === "appeal") store.settleAppeal(appeal.appeal.id, true, NOW);
    expect(store.load().posts.find(post => post.id === "seed-zak")?.status).toBe("live");
  });

  it("never keeps a blocked photo, and notes the attempt", () => {
    const store = createModerationStore(() => memoryStorage());
    const id = store.recordCheck({ verdict: "block", score: 0.9, labels: ["Illegal drugs"], source: "model" }, NOW);
    expect(store.load().blocked.find(item => item.id === id)).toMatchObject({ author: "you", score: 0.9 });
    expect(store.addPost({ text: "", photo: "data:image/jpeg;base64,AAAA", check: { verdict: "block", score: 0.9, labels: [], source: "model" } }, NOW)).toBeNull();
  });

  it("reads back only what makes sense", () => {
    const state = parseModeration(JSON.stringify({ posts: [{ id: "x", author: "nobody" }], settings: { threshold: 99, hideForReporter: false } }), NOW);
    expect(state.posts).toEqual([]);
    expect(state.settings).toMatchObject({ threshold: 3, hideForReporter: false });
    expect(parseModeration("{oops", NOW).posts.length).toBeGreaterThan(0);
  });
});
