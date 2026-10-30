import { describe, expect, it } from "vitest";
import { blankCommunityMemory, defaultCommunitySettings, LIMITS, type CommunitySettings } from "@/lib/community-store";
import {
  breakHint,
  breakNow,
  cardLine,
  cardNote,
  dayLabel,
  hiddenWordProblem,
  nextSuggestedWord,
  postsAudience,
  privacyMeaning,
  quietEdges,
  quietHint,
  sampleLine,
  settingsSummaries,
  settingsTarget,
  stepQuietFrom,
  townHint,
  typedWord,
} from "./settings-model";

// Tuesday 6 October 2026, midday, on this device's clock.
const NOW = new Date(2026, 9, 6, 12, 0).getTime();
const DAY = 86_400_000;
const settings = (patch: Partial<CommunitySettings> = {}): CommunitySettings => ({ ...defaultCommunitySettings(), ...patch });

describe("Community settings: the line under each section", () => {
  it("sums up the settings as they start", () => {
    // The clinician edition starts with no hidden words.
    expect(settingsSummaries(settings(), NOW)).toEqual({
      see: ["Gentle mode on", "no hidden words"],
      read: ["Read aloud off", "normal text"],
      quiet: ["Quiet from 9 pm to 8 am"],
    });
  });

  it("follows each change", () => {
    const changed = settings({
      gentleMode: false, hiddenWords: ["money"], readAloud: true, textSize: "bigger", quietFrom: 23, breakChoice: "week", breakUntil: NOW + 7 * DAY,
    });
    expect(settingsSummaries(changed, NOW)).toEqual({
      see: ["Gentle mode off", "1 hidden word"],
      read: ["Read aloud on", "bigger text"],
      quiet: ["Quiet from 11 pm to 8 am", "on a break until 13 October"],
    });
    expect(settingsSummaries(settings({ hiddenWords: [] }), NOW).see).toEqual(["Gentle mode on", "no hidden words"]);
  });
});

describe("Community settings: where a link that names a section lands", () => {
  it("opens a panel by name, and Your profile by its own name or its older ones", () => {
    expect(settingsTarget("see")).toBe("see");
    expect(settingsTarget("read")).toBe("read");
    expect(settingsTarget("quiet")).toBe("quiet");
    expect(settingsTarget("profile")).toBe("profile");
    expect(settingsTarget("appear")).toBe("profile");
    expect(settingsTarget("friends")).toBe("profile");
    expect(settingsTarget(null)).toBeNull();
    expect(settingsTarget(undefined)).toBeNull();
  });
});

describe("Community settings: Your privacy", () => {
  it("says what each choice means, on this device and nothing more", () => {
    expect(privacyMeaning.postsSeenBy.friends).toBe("Only your connections see what you share.");
    expect(privacyMeaning.postsSeenBy.onlyMe).toBe("What you share stays with you.");
    expect(privacyMeaning.messagesFrom.noOne).toBe("No one can message you.");
    expect(privacyMeaning.messagesFrom.friendsAndGroups).toBe("Connections, and clinicians in your groups, can message you.");
    expect(privacyMeaning.requestsFrom.friendsOfFriends).toBe("Only connections of your connections can ask.");
    expect(privacyMeaning.requestsFrom.noOne).toContain("Requests already waiting stay in My Network.");
    for (const group of Object.values(privacyMeaning)) for (const text of Object.values(group)) expect(text).not.toMatch(/told|notified/i);
  });
});

describe("Community settings: who can see my posts", () => {
  it("names each choice the same way beside a post, in the summary and once posted", () => {
    expect(postsAudience("friends")).toEqual({ label: "Connections", summary: "posts for connections", posted: "Posted for your connections." });
    expect(postsAudience("everyone")).toEqual({ label: "All clinicians", summary: "posts for all clinicians", posted: "Posted for every clinician on Rehyn Connect." });
    expect(postsAudience("onlyMe")).toEqual({ label: "Only me", summary: "posts just for you", posted: "Posted. Only you can see it." });
  });
});

describe("Community settings: quiet time and breaks", () => {
  it("moves quiet time an hour at a time, between 7 pm and 11 pm", () => {
    expect(stepQuietFrom(21, -1)).toBe(20);
    expect(stepQuietFrom(21, 1)).toBe(22);
    expect(stepQuietFrom(19, -1)).toBe(19);
    expect(stepQuietFrom(23, 1)).toBe(23);
    expect(stepQuietFrom(5, 1)).toBe(21);
    expect(quietEdges(19)).toEqual({ earliest: true, latest: false });
    expect(quietEdges(23)).toEqual({ earliest: false, latest: true });
    expect(quietEdges(21)).toEqual({ earliest: false, latest: false });
  });

  it("says what quiet time and a break do, and nothing more", () => {
    expect(quietHint(settings(), new Date(NOW))).toBe("The Alerts badge stays quiet from 9 pm to 8 am");
    expect(quietHint(settings({ quietFrom: 19 }), new Date(NOW))).toBe("The Alerts badge stays quiet from 7 pm to 8 am");
    expect(quietHint(settings(), new Date(2026, 9, 6, 22, 15))).toBe("The Alerts badge stays quiet from 9 pm to 8 am. It's quiet time now.");
    expect(quietHint(settings({ quietFrom: 23 }), new Date(2026, 9, 6, 22, 15))).toBe("The Alerts badge stays quiet from 11 pm to 8 am");
    expect(breakHint(settings(), NOW)).toBe("During a break, the Alerts badge stays quiet. Nothing is deleted.");
    expect(breakHint(settings({ breakChoice: "day", breakUntil: NOW + DAY }), NOW)).toBe("The Alerts badge stays quiet until Wednesday 7 October. Nothing is deleted.");
    for (const text of [breakHint(settings(), NOW), quietHint(settings(), new Date(NOW))]) expect(text).not.toMatch(/friends see|told|notified/i);
  });

  it("treats a break that has ended as no break", () => {
    expect(breakNow(settings({ breakChoice: "week", breakUntil: NOW + DAY }), NOW)).toBe("week");
    expect(breakNow(settings({ breakChoice: "day", breakUntil: NOW - 1 }), NOW)).toBe("none");
    expect(breakNow(settings(), NOW)).toBe("none");
    expect(breakHint(settings({ breakChoice: "day", breakUntil: NOW - 1 }), NOW)).toBe("During a break, the Alerts badge stays quiet. Nothing is deleted.");
    expect(settingsSummaries(settings({ breakChoice: "day", breakUntil: NOW - 1 }), NOW).quiet).toEqual(["Quiet from 9 pm to 8 am"]);
  });

  it("names days on this device's calendar", () => {
    expect(dayLabel(new Date(2026, 9, 13, 9, 30).getTime())).toBe("13 October");
    expect(dayLabel(new Date(2026, 9, 13, 9, 30).getTime(), true)).toBe("Tuesday 13 October");
    expect(dayLabel(new Date(2027, 0, 1).getTime(), true)).toBe("Friday 1 January");
  });
});

describe("Community settings: the card preview", () => {
  it("puts the town (when shown), the groups and the friends under the name", () => {
    expect(cardLine(true, "Leeds", 4, 3)).toBe("Leeds · In 4 groups · 3 friends");
    expect(cardLine(false, "Leeds", 4, 3)).toBe("In 4 groups · 3 friends");
    expect(cardLine(true, "", 1, 1)).toBe("In 1 group · 1 friend");
    expect(cardLine(true, "", 0, 0)).toBe("No groups yet · No friends yet");
  });

  it("never invents a town, and keeps the card hypothetical", () => {
    expect(townHint("")).toBe("Add your town in Your profile, above.");
    expect(townHint("Leeds")).toBe("Puts “Leeds” under your name on your card");
    expect(townHint("")).not.toContain("Bristol");
    expect(cardNote("friends")).toBe("What other members would see when they tap your name. Only friends could message you.");
    expect(cardNote("friendsAndGroups")).toBe("What other members would see when they tap your name.");
  });

  it("takes the sample post from someone the person still sees, without a hidden word", () => {
    const memory = blankCommunityMemory();
    expect(sampleLine(memory)).toEqual({ who: "hannah", text: "Our seven-day ESD service has halved 30-day readmissions." });
    memory.blocks = { hannah: NOW };
    expect(sampleLine(memory).who).toBe("ruth");
    memory.muted = { ruth: NOW };
    expect(sampleLine(memory).who).toBe("kwame");
    const words = blankCommunityMemory();
    words.settings.hiddenWords = ["readmissions", "cardiac", "screening"];
    expect(sampleLine(words)).toEqual({ who: null, text: "This is the size posts are in the feed." });
  });
});

describe("Community settings: hidden words", () => {
  it("explains why a word can't be added", () => {
    expect(hiddenWordProblem("", [])).toBe("Write a word or a short phrase first.");
    expect(hiddenWordProblem("   ", [])).toBe("Write a word or a short phrase first.");
    expect(hiddenWordProblem("!!!", [])).toBe("Use letters and numbers. Spaces, apostrophes and hyphens are fine too.");
    expect(hiddenWordProblem("Hospital", ["hospital"])).toBe("Posts that mention “hospital” are already hidden.");
    const full = Array.from({ length: LIMITS.hiddenWords }, (_, index) => `word${index}`);
    expect(hiddenWordProblem("money", full)).toBe("You can hide up to 20 words. Remove one to add another.");
    expect(hiddenWordProblem("bad news", ["hospital"])).toBeNull();
  });

  it("accepts a curly apostrophe, as phones type it", () => {
    expect(typedWord("don’t")).toBe("don't");
    expect(hiddenWordProblem("don’t", [])).toBeNull();
    expect(hiddenWordProblem("Don’t", ["don't"])).toBe("Posts that mention “don't” are already hidden.");
  });

  it("offers the suggested words in turn, and nothing once they are all hidden", () => {
    // The clinician edition suggests "sponsored", "supplement" and "politics", and starts with no hidden words.
    expect(nextSuggestedWord([])).toBe("sponsored");
    expect(nextSuggestedWord(["sponsored"])).toBe("supplement");
    expect(nextSuggestedWord(["sponsored", "politics"])).toBe("supplement");
    expect(nextSuggestedWord(["supplement", "sponsored"])).toBe("politics");
    expect(nextSuggestedWord(["sponsored", "supplement", "politics"])).toBeNull();
  });
});
