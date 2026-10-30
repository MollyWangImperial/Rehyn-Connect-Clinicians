import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { feedPosts, members, pronounWords } from "@/content/community-samples";
import { blankCommunityMemory, createCommunityStore, isBlocked, type CommunityMemory } from "@/lib/community-store";
import { aboutLine, blockingFacts, clockLabel, fileReport, personWords, postText, quoteFor, reasonOf, safetyLists, savedLabel, unblockQuestion } from "./safety-model";

// Midday on the day the designs show.
beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 9, 6, 12, 0)); });
afterAll(() => { vi.useRealTimers(); });

const NOW = new Date(2026, 9, 6, 12, 0).getTime();
const DAY = 86_400_000;

function memoryStorage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
const freshStore = () => createCommunityStore(() => memoryStorage());

describe("what the sheet says about someone", () => {
  it("describes Gary as the design does once he is no longer blocked", () => {
    const unblocked: CommunityMemory = { ...blankCommunityMemory(), blocks: { gary: 0 } };
    expect(aboutLine(unblocked, "gary")).toBe("Unverified account · joined 2 days ago · no friends in common · not in your groups");
    expect(aboutLine(blankCommunityMemory(), "gary")).toBe("Unverified account · joined 2 days ago · blocked · not in your groups");
  });

  it("says where the person stands with someone, and the groups they share", () => {
    const memory = blankCommunityMemory();
    // A clinician's line starts with their professional title and organisation.
    expect(members.hannah.about).toBe("Specialist speech & language therapist · Bath Community Therapy Service");
    expect(aboutLine(memory, "hannah")).toBe("Specialist speech & language therapist · Bath Community Therapy Service · your friend · in 2 of your groups");
    expect(aboutLine(memory, "tomas")).toBe(`${members.tomas.about} · you asked to be friends · in Young Stroke Clinicians with you`);
    expect(aboutLine(memory, "ruth")).toBe(`${members.ruth.about} · wants to be friends · in 2 of your groups`);
    expect(aboutLine(memory, "joseph")).toBe(`${members.joseph.about} · in Stroke Rehabilitation Network with you`);
  });

  it("uses each person's own pronouns", () => {
    expect(personWords("gary")).toMatchObject({ name: "Gary", Subject: "He", object: "him", possessive: "his", is: "is" });
    expect(personWords("hannah")).toMatchObject({ name: "Hannah Brooks", Subject: "She", object: "her", possessive: "her" });
    expect(personWords("michael")).toMatchObject({ name: "Dr Michael Chau", subject: "he", Subject: "He", object: "him", possessive: "his", is: "is" });
    // No example clinician uses "they" now, but the words for it still agree ("they are").
    expect(pronounWords.they).toEqual({ subject: "they", object: "them", possessive: "their", is: "are", was: "were" });
  });

  it("explains blocking and unblocking the same way in the sheet, the Friends drawer and the Safety page", () => {
    expect(blockingFacts("hannah")).toEqual(["She can't see your posts or comments.", "She can't message you or send a friend request.", "She won't be told. You can unblock any time."]);
    expect(blockingFacts(null)).toEqual(["They can't see your posts or comments.", "They can't message you or send a friend request.", "They are never told that you blocked them."]);
    expect(unblockQuestion("gary")).toBe("Unblock Gary? You'll see his posts again, and he can send you requests. He won't be told.");
    expect(unblockQuestion("michael")).toBe("Unblock Dr Michael Chau? You'll see his posts again, and he can send you requests. He won't be told.");
  });

  it("names the reasons and quotes the example posts", () => {
    expect(reasonOf("health").label).toBe("Unsafe clinical advice");
    expect(reasonOf("fake").label).toBe("Not a registered clinician");
    expect(reasonOf("money")).toMatchObject({ label: "Promotion, selling or a conflict of interest", tint: "#F3F4F6", ink: "#27323D" });
    expect(postText("p-gary")).toContain("supplement");
    expect(postText(null)).toBeNull();
    expect(postText("p-unknown")).toBeNull();
  });

  it("keeps a quoted post out of sight when a hidden word would, and gentle mode covers no clinician post", () => {
    const memory = blankCommunityMemory();
    expect(quoteFor(memory, "p-hannah")).toEqual({ text: expect.stringContaining("seven-day early supported discharge"), covered: false });
    // The clinician feed has no sad posts for gentle mode to cover, so with it on every post is quoted.
    expect(memory.settings.gentleMode).toBe(true);
    expect(feedPosts.filter(post => post.gentle)).toEqual([]);
    for (const post of feedPosts) expect(quoteFor(memory, post.id)?.covered).toBe(false);
    const hiding: CommunityMemory = { ...memory, settings: { ...memory.settings, hiddenWords: ["supplement"] } };
    expect(quoteFor(hiding, "p-gary")).toEqual({ text: "Not shown, because it mentions “supplement”, one of your hidden words.", covered: true });
    expect(quoteFor(hiding, "p-hannah")?.covered).toBe(false);
    expect(quoteFor(memory, null)).toBeNull();
  });
});

describe("when a report was saved", () => {
  it("gives the time today and yesterday, then just the day", () => {
    expect(clockLabel(new Date(2026, 9, 6, 20, 45).getTime())).toBe("8:45 pm");
    expect(clockLabel(new Date(2026, 9, 6, 0, 5).getTime())).toBe("12:05 am");
    expect(clockLabel(new Date(2026, 9, 6, 12, 0).getTime())).toBe("12:00 pm");
    expect(savedLabel(new Date(2026, 9, 6, 9, 10).getTime(), NOW)).toBe("today at 9:10 am");
    expect(savedLabel(new Date(2026, 9, 5, 20, 45).getTime(), NOW)).toBe("yesterday at 8:45 pm");
    expect(savedLabel(NOW - 3 * DAY, NOW)).toBe("3 days ago");
  });
});

describe("saving a report on this device", () => {
  it("keeps the report and blocks the person when asked, so the block hides the post", () => {
    const store = freshStore();
    store.unblock("gary");
    const outcome = fileReport(store, { who: "gary", postId: "p-gary" }, { reason: "health", note: "He sent me the same message too.", alsoBlock: true }, NOW);
    expect(outcome).toEqual({ blocked: true, postHidden: false });
    const memory = store.load();
    expect(isBlocked(memory, "gary")).toBe(true);
    expect(memory.reports[0]).toMatchObject({ who: "gary", postId: "p-gary", reason: "health", note: "He sent me the same message too.", alsoBlock: true, createdAt: NOW });
    expect(memory.hiddenPosts["p-gary"]).toBeUndefined();
  });

  it("hides the post reported when the person is not blocked", () => {
    const store = freshStore();
    const outcome = fileReport(store, { who: "hannah", postId: "p-hannah" }, { reason: "other", note: "", alsoBlock: false }, NOW);
    expect(outcome).toEqual({ blocked: false, postHidden: true });
    expect(store.load().hiddenPosts["p-hannah"]).toBe(NOW);
    expect(isBlocked(store.load(), "hannah")).toBe(false);
    expect(store.load().reports[0]).toMatchObject({ who: "hannah", alsoBlock: false });
  });

  it("doesn't block again someone already blocked", () => {
    const store = freshStore();
    const outcome = fileReport(store, { who: "gary", postId: null }, { reason: "fake", note: "", alsoBlock: true }, NOW);
    expect(outcome).toEqual({ blocked: true, postHidden: false });
    expect(store.load().reports[0]).toMatchObject({ who: "gary", postId: null, alsoBlock: false });
  });

  it("reports a person from the Friends drawer without hiding anything", () => {
    const store = freshStore();
    const outcome = fileReport(store, { who: "kwame", postId: null }, { reason: "unkind", note: "", alsoBlock: false }, NOW);
    expect(outcome).toEqual({ blocked: false, postHidden: false });
    expect(store.load().hiddenPosts).toEqual({});
  });
});

describe("what the Safety page lists", () => {
  it("lists Gary as blocked three days ago to begin with, and nothing else", () => {
    const lists = safetyLists(blankCommunityMemory(), NOW);
    expect(lists.blocked).toEqual([{ who: "gary", at: NOW - 3 * DAY, muted: false }]);
    expect(lists.muted).toEqual([]);
    expect(lists.posts).toEqual([]);
  });

  it("lists hidden people and posts, leaving a post to its writer's row while they are blocked or hidden", () => {
    const store = freshStore();
    store.mute("grace", NOW - DAY);
    store.hidePost("p-tomas", NOW - 2 * DAY);
    store.hidePost("p-hannah", NOW);
    store.block("hannah", NOW);
    store.mute("gary", NOW);
    const lists = safetyLists(store.load(), NOW);
    expect(lists.blocked.map(entry => entry.who)).toEqual(["hannah", "gary"]);
    expect(lists.blocked.find(entry => entry.who === "gary")?.muted).toBe(true);
    expect(lists.muted).toEqual([{ who: "grace", at: NOW - DAY }]);
    expect(lists.posts.map(entry => entry.postId)).toEqual(["p-tomas"]);
  });
});
