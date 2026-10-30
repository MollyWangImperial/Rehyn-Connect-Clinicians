import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { conditionGroups, CONDITION_IDS, sampleGames, sampleGroups, suggestedGroups } from "@/content/community-samples";
import { blankCommunityMemory, communityHref, communityViewFromQuery, createCommunityStore, gamesAllowed, groupVisibility, OPEN_GAMES, parseCommunityMemory, type CommunityMemory } from "@/lib/community-store";
import { findInCommunity } from "./alerts-helpers";
import { myGames, myGroups, openGames, visibleSubgroupCount, visibleSubgroups } from "./group-model";
import GroupsView from "./Groups";
import StartGroupView from "./StartGroup";

// Groups by condition for clinicians (comments 7, 8, 14, 16 and 22): professional groups inside each condition
// network, private subgroups that stay with the clinicians in them, and no games anywhere in the views. The privacy
// rules are kept in the model, so every list, search and count obeys them.

vi.mock("@/components/RecoveryShell", () => ({ default: ({ children }: { children: unknown }) => children }));
const given = vi.hoisted(() => ({ memory: null as CommunityMemory | null }));
vi.mock("@/lib/community-store", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/community-store")>();
  return { ...actual, useCommunity: () => given.memory ?? actual.blankCommunityMemory() };
});

beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 9, 14, 12, 0)); });
afterAll(() => { vi.useRealTimers(); });
let store = createCommunityStore(() => null);
beforeEach(() => { store = createCommunityStore(() => null); given.memory = null; });

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const words = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const render = (path: string, element: ReturnType<typeof createElement>) => {
  given.memory = store.load();
  return renderToStaticMarkup(createElement(Router, { ssrPath: path, children: element }));
};
const groupsPage = (query = "") => render(`/community?space=groups${query}`, createElement(GroupsView, { active: false, requested: null }));
const groupPage = (id: string, query = "") => render(`/community?space=groups&group=${id}${query}`, createElement(GroupsView, { active: false, requested: id }));
const hiddenGroups = conditionGroups.filter(group => group.visibility === "private");
/** Words of the patient edition's hobby groups and games that must not appear for clinicians. */
const PATIENT_WORDS = /Garden gang|Morning walkers|Kitchen singalong|Knit and natter|Tuesday tea|Carers' corner|Dance for balance|hearts?\b|challenge/i;
const GAME_WORDS = /Play now|Start a game|chess|Battleships|draughts|Ludo|Games in this group/i;

describe("private groups never show to non-members", () => {
  it("guard: the examples include private groups the clinician is not in", () => {
    expect(hiddenGroups.map(group => group.name)).toEqual(["Stroke Unit Leads", "PD Nurse Specialists"]);
  });

  it("leaves them out of every list, count and suggestion in the model", () => {
    const memory = blankCommunityMemory();
    const ids = hiddenGroups.map(group => group.id as string);
    for (const condition of CONDITION_IDS) {
      const seen = visibleSubgroups(memory, condition);
      expect(seen.map(group => group.id).filter(id => ids.includes(id))).toEqual([]);
      expect(visibleSubgroupCount(memory, condition)).toBe(seen.length);
      // Every group shown is public, or one the clinician is in.
      expect(seen.every(group => group.visibility === "public" || group.member)).toBe(true);
    }
    expect(myGroups(memory).map(group => group.id).filter(id => ids.includes(id))).toEqual([]);
    expect(suggestedGroups.every(group => group.visibility === "public")).toBe(true);
  });

  it("leaves them out of search, even when searched for by name", () => {
    const found = findInCommunity(blankCommunityMemory(), "Stroke Unit Leads", { space: "feed", group: null });
    expect([...found.groups, ...found.suggested].map(group => group.name)).not.toContain("Stroke Unit Leads");
    const nurses = findInCommunity(blankCommunityMemory(), "PD Nurse Specialists", { space: "feed", group: null });
    expect([...nurses.groups, ...nurses.suggested].map(group => group.name)).not.toContain("PD Nurse Specialists");
  });

  it("can't be joined, even by asking the store directly", () => {
    store.toggleJoined("tuesday-tea" as never);
    expect(store.load().joined).toEqual([]);
    // Saved data can't sneak one in either.
    expect(parseCommunityMemory(JSON.stringify({ joined: ["tuesday-tea", "finding"] })).joined).toEqual(["finding"]);
  });

  it("doesn't show them on the Groups tab, but shows the clinician's own private groups", () => {
    const html = words(groupsPage());
    expect(html).toContain("Groups in Stroke");
    expect(html).toContain("Stroke Rehabilitation Network");
    expect(html).toContain("Young Stroke Clinicians");
    expect(html).toContain("Hyperacute Stroke Care");
    expect(html).not.toContain("Stroke Unit Leads");
    expect(html).toContain("Private groups you are not in never appear here.");
    const parkinsons = words(groupsPage("&cond=parkinsons"));
    expect(parkinsons).toContain("Parkinson's Clinical Network");
    expect(parkinsons).toContain("Parkinson's Medication Safety");
    expect(parkinsons).not.toContain("PD Nurse Specialists");
  });

  it("shows a private group started by the clinician, and only in its own condition", () => {
    const group = store.startGroup({ name: "Complex Case Review", theme: "walking", friends: ["grace"], conditionId: "ms" }, NOW);
    const memory = store.load();
    expect(group.visibility).toBe("private");
    expect(visibleSubgroups(memory, "ms").map(item => item.id)).toContain(group.id);
    expect(visibleSubgroups(memory, "stroke").map(item => item.id)).not.toContain(group.id);
    // Starting a group in a condition makes the clinician a member of it.
    expect(memory.conditions).toEqual(["ms"]);
  });
});

describe("condition groups for clinicians (comment 14)", () => {
  it("lists the condition networks with their member counts and the clinician's memberships, and no patient hobby groups", () => {
    const html = groupsPage();
    const text = words(html);
    for (const name of ["Stroke", "Parkinson's", "Multiple sclerosis", "Brain injury", "Spinal cord injury", "Hip and knee"]) expect(text).toContain(name);
    expect(text).toContain("1,240 clinicians");
    // The clinician's own networks (Stroke and Parkinson's) are marked; the chosen one is current.
    expect((html.match(/class="cm-cond-tile is-on is-member"/g) ?? []).length).toBe(1);
    expect((html.match(/class="cm-cond-tile  is-member"/g) ?? []).length).toBe(1);
    expect(html).toMatch(/<a[^>]*class="cm-cond-tile is-on is-member"[^>]*aria-current="true"|<a[^>]*aria-current="true"[^>]*class="cm-cond-tile is-on is-member"/);
    expect(text).not.toMatch(PATIENT_WORDS);
    // No pastel tile colours: the tiles carry no inline background.
    expect(html).not.toMatch(/class="cm-cond-tile[^"]*"[^>]*style=/);
  });

  it("shows the chosen condition's professional purpose, relevant expertise and membership state", () => {
    const stroke = words(groupsPage());
    expect(stroke).toContain("Acute care, rehabilitation and secondary prevention after stroke and TIA.");
    expect(stroke).toContain("Relevant expertise Stroke physicians, neuro physios, SLTs, OTs, stroke nurses");
    expect(stroke).toContain("Member of the Stroke network");
    const ms = words(groupsPage("&cond=ms"));
    expect(ms).toContain("Disease-modifying therapy, relapse care, fatigue and mobility in MS.");
    expect(ms).toContain("Join Multiple sclerosis network");
    expect(ms).toContain("MS Fatigue and Rehabilitation");
    expect(ms).toContain("63 clinicians");
  });

  it("joins a group with the membership flow, and shows it in Your groups and on its own page", () => {
    const before = groupsPage("&cond=ms");
    expect(words(before)).toContain("Join MS Fatigue and Rehabilitation");
    store.toggleJoined("fatigue");
    const memory = store.load();
    // Joining a group in another condition joins that network too.
    expect(memory.conditions).toEqual(["ms"]);
    expect(visibleSubgroups(memory, "ms").find(group => group.id === "fatigue")?.member).toBe(true);
    expect(myGroups(memory).map(group => group.id)).toContain("fatigue");
    const after = groupsPage("&cond=ms");
    expect(words(after)).toContain("Open MS Fatigue and Rehabilitation");
    expect(words(after)).toContain("Leave MS Fatigue and Rehabilitation");
    const yours = after.slice(after.indexOf('id="cm-your-groups-title"'));
    expect(yours).toContain('href="/community?space=groups&amp;group=fatigue"');
    const page = words(groupPage("fatigue"));
    expect(page).toContain("MS Fatigue and Rehabilitation");
    expect(page).toContain("Member");
    expect(page).toContain("Leave group");
    expect(page).toContain("64 clinicians");
    store.toggleJoined("fatigue");
    expect(myGroups(store.load()).map(group => group.id)).not.toContain("fatigue");
  });
});

describe("the clinician's own groups read as clinical expertise networks (comments 8 and 16)", () => {
  it("names them after their conditions, with clinicians, expertise and a plain monthly focus", () => {
    expect(sampleGroups.find(group => group.id === "garden")?.name).toBe("Stroke Rehabilitation Network");
    expect(sampleGroups.find(group => group.id === "walk")?.name).toBe("Parkinson's Clinical Network");
    const html = groupPage("garden");
    const text = words(html);
    expect(html).toMatch(/<h2[^>]*id="cm-group-title"[^>]*>Stroke Rehabilitation Network<\/h2>/);
    expect(text).toContain("186 clinicians");
    expect(text).toContain("Relevant expertise Stroke physicians");
    expect(text).toContain("This month Share one audit or service improvement from your unit");
    expect(text).toContain("Invite colleagues");
    expect(text).not.toMatch(PATIENT_WORDS);
    expect(html).not.toContain('role="progressbar"');
    // Who is in it: clinicians, with their roles, linking to their profiles.
    expect(html).toMatch(/href="\/clinicians\/[a-z-]+"/);
    const walk = words(groupPage("walk"));
    expect(walk).toContain("Parkinson's Clinical Network");
    expect(walk).toContain("Parkinson's · professional group");
  });

  it("offers professional quick replies, with no hearts", () => {
    const html = groupPage("garden");
    expect(words(html)).toContain("Thanks for sharing");
    expect(html).not.toContain("cm-heart");
    expect(html).not.toContain("Send a heart");
  });
});

describe("no games for clinicians (comment 7)", () => {
  it("keeps the store's game rules for saved data: private groups only", () => {
    const memory = blankCommunityMemory();
    expect(groupVisibility(memory, "garden")).toBe("private");
    expect(gamesAllowed(memory, "garden")).toBe(true);
    expect(gamesAllowed(memory, "walk")).toBe(false);
    expect(gamesAllowed(memory, "tuesday-tea")).toBe(false);
    expect(store.startGame({ groupId: "walk", type: "chess", players: ["kwame"] }, NOW)).toBeNull();
  });

  it("shows no game UI on the Groups page or a group's page, even when a game is asked for", () => {
    for (const html of [groupsPage(), groupsPage("&game=new-open"), groupPage("garden"), groupPage("walk"), groupPage("garden", "&game=new")]) {
      expect(words(html)).not.toMatch(GAME_WORDS);
      expect(html).not.toContain("cm-gs-area");
      expect(html).not.toContain("cm-strip");
    }
  });

  it("ignores a game's address: a saved game never opens, and the group page shows instead", () => {
    const game = store.startGame({ groupId: "garden", type: "battleships", players: ["hannah"] }, NOW)!;
    store.setGameState(game.id, "playing");
    const page = groupPage("garden", `&game=${game.id}`);
    expect(page).not.toContain("cm-bs-main");
    expect(page).toMatch(/<h2[^>]*id="cm-group-title"[^>]*>Stroke Rehabilitation Network<\/h2>/);
    const open = store.startOpenGame("chess", NOW)!;
    expect(groupsPage(`&game=${open.id}`)).toContain("Groups by condition");
  });

  it("offers no games when starting a group, and new groups start without them", () => {
    const html = render("/community?space=start", createElement(StartGroupView, { name: "Zak" }));
    const text = words(html);
    expect(text).toContain("Private Default");
    expect(text).toContain("Clinical practice");
    expect(text).toContain("Invite colleagues");
    expect(text).not.toMatch(GAME_WORDS);
    expect(html).not.toContain('role="switch"');
    expect(html).not.toContain('value="games"');
  });
});

describe("old saved groups and games", () => {
  it("keeps groups saved before conditions existed, in Stroke, private unless they were open", () => {
    const memory = parseCommunityMemory(JSON.stringify({
      started: [
        { id: "mine-old", name: "Tea and cake", theme: "chatting", friends: ["ruth"], open: true, createdAt: NOW, hello: null },
        { id: "mine-older", name: "Quiet ones", theme: "crafts", friends: [], open: false, createdAt: NOW },
      ],
    }));
    expect(memory.started[0]).toMatchObject({ conditionId: "stroke", visibility: "public", games: false });
    expect(memory.started[1]).toMatchObject({ conditionId: "stroke", visibility: "private", games: true, theme: "crafts" });
    expect(memory.conditions).toEqual([]);
    expect(memory.games).toEqual([]);
  });

  it("keeps Play now games that were saved, and drops games in groups that aren't there", () => {
    const memory = parseCommunityMemory(JSON.stringify({
      games: [
        { id: "game-open", groupId: "open", type: "chess", players: ["priya"], watch: false, state: "playing", createdAt: NOW },
        { id: "game-lost", groupId: "nowhere", type: "chess", players: ["priya"], state: "playing", createdAt: NOW },
      ],
      chess: { "game-open": ["e2e4"], "game-lost": ["e2e4"] },
    }));
    expect(memory.games.map(game => game.id)).toEqual(["game-open"]);
    expect(openGames(memory)[0].moves).toEqual(["e2e4"]);
    expect(gamesAllowed(memory, OPEN_GAMES)).toBe(false);
  });

  it("has no example games, so no group lists any", () => {
    expect(sampleGames).toEqual([]);
    expect(myGames(blankCommunityMemory())).toEqual([]);
  });

  it("writes the address of a group and of a condition", () => {
    expect(communityHref("groups", "garden")).toBe("/community?space=groups&group=garden");
    expect(communityHref("groups", null, { cond: "ms" })).toBe("/community?space=groups&cond=ms");
    expect(communityHref("start", null, { cond: "stroke" })).toBe("/community?space=start&cond=stroke");
    expect(communityViewFromQuery("space=groups&cond=nowhere").cond).toBeUndefined();
  });
});
