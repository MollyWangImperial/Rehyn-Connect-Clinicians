import { describe, expect, it } from "vitest";
import { SAMPLE_GOING, sampleGatherings } from "@/content/circle-events";
import { blankCircleEvents, blankDraft, createCircleEventsStore, draftProblem, draftToGathering, parseCircleEvents } from "./circle-events-store";
import { canSeeGathering, comingUpFor, matchesFilters, NO_FILTERS, whenRange, type Gathering } from "./circle-gatherings";
import { mergeGatherings, myEvents, standingFor } from "./circle-listing";

const NOW = new Date(2026, 9, 14, 12, 0);
const base: Gathering = {
  id: "e", name: "Film club", detail: "", start: NOW.getTime() + 86_400_000, minutes: 60, format: "open", repeats: "once",
  host: { kind: "member", who: "kwame" }, access: "friends", invited: ["hannah", "you"], bringFriend: false,
  audience: ["all"], communities: ["stroke"], seats: 8, going: 3, faces: [],
};

describe("who can see an event", () => {
  it("lists public and by-invitation events for everyone", () => {
    expect(canSeeGathering({ ...base, access: "public", invited: [] }, "priya")).toBe(true);
    expect(canSeeGathering({ ...base, access: "invite", invited: [] }, "priya")).toBe(true);
  });

  it("never shows a friends-only event to anyone the host didn't pick", () => {
    expect(canSeeGathering(base, "you")).toBe(true);
    expect(canSeeGathering(base, "hannah")).toBe(true);
    expect(canSeeGathering(base, "kwame")).toBe(true);
    expect(canSeeGathering(base, "priya")).toBe(false);
    expect(canSeeGathering({ ...base, invited: ["hannah"] }, "you")).toBe(false);
    // No filter brings it back.
    for (const hostedBy of ["anyone", "alira", "members", "friends"] as const) {
      expect(comingUpFor([{ ...base, invited: ["hannah"] }], "you", { ...NO_FILTERS, hostedBy }, ["kwame"], NOW.getTime())).toEqual([]);
    }
  });

  it("keeps Priya's friends-only quiz out of the person's Coming up and My events", () => {
    const events = sampleGatherings(NOW);
    const quiz = events.find(event => event.id === "m-priya-birthday")!;
    expect(quiz.access).toBe("friends");
    expect(comingUpFor(events, "you", NO_FILTERS, ["kwame"], NOW.getTime()).map(event => event.id)).not.toContain("m-priya-birthday");
    const mine = myEvents(events, blankCircleEvents(), SAMPLE_GOING, NOW.getTime());
    expect([...mine.hosting, ...mine.waiting, ...mine.going, ...mine.past].map(event => event.id)).not.toContain("m-priya-birthday");
    // Margaret was picked, so she sees it.
    expect(comingUpFor(events, "hannah", NO_FILTERS, [], NOW.getTime()).map(event => event.id)).toContain("m-priya-birthday");
  });

  it("hides events hosted by someone the person has blocked", () => {
    expect(canSeeGathering({ ...base, access: "public" }, "you", ["kwame"])).toBe(false);
  });
});

describe("the filters above Coming up", () => {
  const event = { ...base, access: "public" as const, audience: ["over60" as const], communities: ["stroke" as const] };
  it("shows every event with All ages and Everyone", () => {
    expect(matchesFilters(event, NO_FILTERS, [])).toBe(true);
  });
  it("matches events tagged for the group, or for everyone", () => {
    expect(matchesFilters(event, { ...NO_FILTERS, audience: "over60" }, [])).toBe(true);
    expect(matchesFilters(event, { ...NO_FILTERS, audience: "under35" }, [])).toBe(false);
    expect(matchesFilters({ ...event, audience: ["all"] }, { ...NO_FILTERS, audience: "under35" }, [])).toBe(true);
    expect(matchesFilters(event, { ...NO_FILTERS, community: "ms" }, [])).toBe(false);
    expect(matchesFilters({ ...event, communities: ["everyone"] }, { ...NO_FILTERS, community: "ms" }, [])).toBe(true);
  });
  it("filters by who hosts", () => {
    expect(matchesFilters(event, { ...NO_FILTERS, hostedBy: "members" }, [])).toBe(true);
    expect(matchesFilters(event, { ...NO_FILTERS, hostedBy: "alira" }, [])).toBe(false);
    expect(matchesFilters(event, { ...NO_FILTERS, hostedBy: "friends" }, ["kwame"])).toBe(true);
    expect(matchesFilters(event, { ...NO_FILTERS, hostedBy: "friends" }, ["grace"])).toBe(false);
  });
});

describe("events as the person sees them", () => {
  it("waits for an answer to a friends-only invitation, then remembers it", () => {
    const events = sampleGatherings(NOW);
    const film = events.find(event => event.id === "m-kwame-film")!;
    const memory = blankCircleEvents();
    expect(standingFor(film, memory, SAMPLE_GOING)).toBe("invited");
    expect(myEvents(events, memory, SAMPLE_GOING, NOW.getTime()).waiting.map(event => event.id)).toEqual(["m-kwame-film"]);
    const store = createCircleEventsStore(() => null);
    store.answer("m-kwame-film", "going");
    expect(myEvents(events, store.load(), SAMPLE_GOING, NOW.getTime()).going.map(event => event.id)).toContain("m-kwame-film");
  });

  it("puts the person's own events under Hosting, and a past one they went to under Past", () => {
    const mine = myEvents(sampleGatherings(NOW), blankCircleEvents(), SAMPLE_GOING, NOW.getTime());
    expect(mine.hosting.map(event => event.id)).toEqual(["y-crossword", "y-grandparents"]);
    expect(mine.past.map(event => event.id)).toEqual(["m-ruth-garden"]);
  });

  it("writes the time as the mockups do", () => {
    expect(whenRange(new Date(2026, 9, 16, 16).getTime(), 60)).toBe("Friday 16 October, 4 to 5 pm");
    expect(whenRange(new Date(2026, 9, 19, 12, 30).getTime(), 30)).toBe("Monday 19 October, 12.30 to 1 pm");
    expect(whenRange(new Date(2026, 9, 24, 11).getTime(), 60)).toBe("Saturday 24 October, 11 am to 12");
    expect(whenRange(new Date(2026, 9, 24, 11).getTime(), 90)).toBe("Saturday 24 October, 11 am to 12.30 pm");
  });
});

describe("creating an event", () => {
  it("asks for a name, a time ahead, and at least one friend for a friends-only event", () => {
    const draft = blankDraft(NOW);
    expect(draftProblem(draft, NOW.getTime(), 20)).toBe("name");
    const named = { ...draft, name: "Gardening from a chair" };
    expect(draftProblem(named, NOW.getTime(), 20)).toBeNull();
    expect(draftProblem({ ...named, date: "2026-10-01" }, NOW.getTime(), 20)).toBe("past");
    expect(draftProblem({ ...named, access: "friends" }, NOW.getTime(), 20)).toBe("friends");
    expect(draftProblem({ ...named, access: "friends", invited: ["kwame"] }, NOW.getTime(), 20)).toBeNull();
    expect(draftProblem({ ...named, seats: 30 }, NOW.getTime(), 20)).toBe("seats");
  });

  it("keeps Alira sitting in on a public event, and the friend list only on a friends-only one", () => {
    const draft = { ...blankDraft(NOW), name: "Tea", aliraHelps: false, invited: ["kwame" as const] };
    expect(draftToGathering(draft, "x")!.rules?.aliraHelps).toBe(true);
    expect(draftToGathering(draft, "x")!.invited).toEqual([]);
    expect(draftToGathering({ ...draft, access: "friends" }, "x")!.invited).toEqual(["kwame"]);
  });

  it("stores the new event, which only the picked friends can see when it is friends only", () => {
    const store = createCircleEventsStore(() => null);
    const event = store.create({ ...blankDraft(NOW), name: "Crossword corner", access: "friends", invited: ["hannah"] }, NOW.getTime());
    expect(event).not.toBeNull();
    const events = mergeGatherings(sampleGatherings(NOW), store.load());
    expect(comingUpFor(events, "you", NO_FILTERS, [], NOW.getTime()).map(item => item.id)).toContain(event!.id);
    expect(comingUpFor(events, "hannah", NO_FILTERS, [], NOW.getTime()).map(item => item.id)).toContain(event!.id);
    expect(comingUpFor(events, "priya", NO_FILTERS, [], NOW.getTime()).map(item => item.id)).not.toContain(event!.id);
  });

  it("reads back what was stored, and drops what it can't trust", () => {
    const storage = new Map<string, string>();
    const access = () => ({ getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } });
    const store = createCircleEventsStore(access);
    store.create({ ...blankDraft(NOW), name: "Quiz" }, NOW.getTime());
    store.toggleReminder("m-grace-work");
    store.askedAbout("work", "rob", "2026-10-14");
    const again = createCircleEventsStore(access).load();
    expect(again.created.map(event => event.name)).toEqual(["Quiz"]);
    expect(again.reminders).toEqual(["m-grace-work"]);
    expect(again.rooms.work).toEqual({ day: "2026-10-14", asked: ["rob"], removed: [] });
    expect(parseCircleEvents("{\"created\":[{\"id\":\"<x>\"}],\"answers\":{\"a\":\"maybe\"}}")).toEqual(blankCircleEvents());
  });
});
