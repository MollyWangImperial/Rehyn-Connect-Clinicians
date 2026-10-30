import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { ALERT_IDS, communityAlerts } from "@/content/community-samples";
import { blankCommunityMemory, defaultCommunitySettings, type CommunityMemory, type CommunityPlace } from "@/lib/community-store";
import AlertsPanel from "./AlertsPanel";
import {
  alertLabel,
  alertLink,
  alertOutcome,
  breakEndLabel,
  clockLabel,
  findInCommunity,
  fold,
  foundLabel,
  friendChangeNote,
  highlight,
  matchScore,
  newAlertIds,
  quietNote,
  shownAlerts,
} from "./alerts-helpers";

// The panels read the person's record through useCommunity(). Here it reads the record each test
// sets up, so the panels can be drawn with requests answered, people blocked, groups joined.
const held = vi.hoisted(() => ({ memory: null as CommunityMemory | null }));
vi.mock("@/lib/community-store", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/community-store")>();
  return { ...actual, useCommunity: () => held.memory ?? actual.blankCommunityMemory() };
});

// Midday on Tuesday 6 October, so quiet time (9 pm to 8 am) is not on unless a test says so.
const MIDDAY = new Date(2026, 9, 6, 12, 0);
beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(MIDDAY); });
afterAll(() => { vi.useRealTimers(); });
beforeEach(() => { vi.setSystemTime(MIDDAY); held.memory = blankCommunityMemory(); });

const FEED: CommunityPlace = { space: "feed", group: null };
// The lounge is not a named space in the clinician edition, so the view used here is professional events.
const EVENTS: CommunityPlace = { space: "events", group: null };
const LOUNGE: CommunityPlace = { space: "lounge", group: null };
const noop = () => {};
const memory = (change: Partial<CommunityMemory>): CommunityMemory => ({ ...blankCommunityMemory(), ...change });

const render = (element: ReactElement, path: string) => renderToStaticMarkup(createElement(Router, { ssrPath: path, children: element })).replace(/ data-loc="[^"]*"/g, "");
const words = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/\s+/g, " ");
/** The opening tags of this kind that carry every one of the given attributes, in any order. */
const tags = (html: string, name: string, ...attributes: string[]) =>
  (html.match(new RegExp(`<${name}\\b[^>]*>`, "g")) ?? []).filter(tag => attributes.every(attribute => tag.includes(attribute)));
const tagWith = (html: string, name: string, ...attributes: string[]) => tags(html, name, ...attributes).length > 0;

const alertsPanel = (over = FEED, path = "/community") =>
  render(createElement(AlertsPanel, { onClose: noop, anchor: null, over, fallbackFocus: () => null }), path);

describe("the Alerts panel", () => {
  it("is a dialog listing the four new alerts, each a link to where it happened", () => {
    const html = alertsPanel();
    const text = words(html);
    expect(tagWith(html, "div", 'role="dialog"', 'aria-modal="true"', 'class="cm-dialog cm-dialog-panel cm-al-panel"')).toBe(true);
    const heading = html.match(/<h2 id="([^"]+)"[^>]*>Alerts<\/h2>/);
    expect(heading).not.toBeNull();
    expect(tagWith(html, "div", 'role="dialog"', `aria-labelledby="${heading?.[1]}"`)).toBe(true);
    expect(html).toContain("<p>4 new</p>");
    expect(tags(html, "a", 'class="cm-al-row is-new"')).toHaveLength(4);
    expect(tagWith(html, "a", 'href="/community?space=circle"', "cm-al-row is-new")).toBe(true);
    expect(tagWith(html, "a", 'href="/community?space=groups&amp;group=garden"', "cm-al-row is-new")).toBe(true);
    // Both connection requests open My Network at Invitations, over the feed.
    expect(tags(html, "a", 'href="/community?panel=friends"', "cm-al-row is-new")).toHaveLength(2);
    expect(tagWith(html, "a", 'aria-label="Ruth Calloway wants to connect, new. We both run joint cardiac and stroke rehab. Would be good to connect. 10 minutes ago."')).toBe(true);
    expect(tags(html, "span", 'class="cm-al-new"')).toHaveLength(4);
    expect(text).toContain("Your group weekly session starts soon");
    expect(text).toContain("3 new messages in Stroke Rehabilitation Network");
    expect(text).toContain("Hannah Brooks: Happy to share our rota");
    expect(text).toContain("Michael Chau wants to connect");
    expect(text).not.toMatch(/Sunday circle|Garden gang|wants to be friends/);
    expect(text).not.toContain("Earlier");
    expect(text).not.toContain("quiet time until");
    // The foot says when the badge stays quiet, and links to Community settings, at Quiet times, to change it.
    expect(tagWith(html, "a", 'href="/community?space=settings&amp;section=quiet"', "cm-dialog-foot-link")).toBe(true);
    expect(text).toContain("Quiet time: 9 pm to 8 am Change");
  });

  it("opens a connection request over the view the person is on", () => {
    const html = alertsPanel(EVENTS, "/community?space=events");
    expect(tags(html, "a", 'href="/community?space=events&amp;panel=friends"', "cm-al-row")).toHaveLength(2);
    expect(tagWith(html, "a", 'href="/community?space=circle"', "cm-al-row")).toBe(true);
    expect(tagWith(html, "a", 'href="/community?space=groups&amp;group=garden"', "cm-al-row")).toBe(true);
  });

  it("opens a connection request over the feed from the old lounge address, which is not a space any more", () => {
    const html = alertsPanel(LOUNGE, "/community?space=lounge");
    expect(tags(html, "a", 'href="/community?panel=friends"', "cm-al-row")).toHaveLength(2);
    expect(html).not.toContain("space=lounge");
  });

  it("says when there is nothing new, and keeps the earlier alerts", () => {
    held.memory = memory({ seenAlerts: [...ALERT_IDS] });
    const html = alertsPanel();
    const text = words(html);
    expect(html).toContain("<p>Nothing new</p>");
    expect(text).toContain("All caught up. Nothing new since you last looked.");
    expect(text).toContain("Earlier");
    expect(tags(html, "a", 'class="cm-al-row "')).toHaveLength(4);
    expect(html).not.toContain('class="cm-al-new"');
  });

  it("follows what has happened since: a friend accepted, a request declined, a group read, a seat taken", () => {
    held.memory = memory({ answers: { ruth: "accepted", michael: "declined" }, read: ["garden"], seated: true });
    const html = alertsPanel();
    for (const outcome of ["Friends now", "You chose not now", "You&#x27;ve caught up", "You took your seat"]) expect(html).toContain(`${outcome}</span>`);
    expect(html).toContain("<p>Nothing new</p>");
  });

  it("leaves out a request from someone blocked, and a message from someone hidden", () => {
    held.memory = memory({ blocks: { ruth: Date.now() }, muted: { hannah: Date.now() } });
    const html = alertsPanel();
    const text = words(html);
    expect(text).not.toContain("Ruth Calloway wants to connect");
    expect(text).toContain("Michael Chau wants to connect");
    expect(text).toContain("3 new messages in Stroke Rehabilitation Network");
    expect(text).not.toContain("Happy to share our rota");
    expect(html).toContain("<p>3 new</p>");
  });

  it("explains quiet time and a break, which keep the badge quiet", () => {
    vi.setSystemTime(new Date(2026, 9, 6, 22, 0));
    expect(words(alertsPanel())).toContain("It's quiet time until 8 am, so the Alerts badge stays quiet. Your alerts are still here.");
    vi.setSystemTime(MIDDAY);
    held.memory = memory({ settings: { ...defaultCommunitySettings(), breakChoice: "day", breakUntil: Date.now() + 86_400_000 } });
    const text = words(alertsPanel());
    expect(text).toContain("You're taking a break until 12 pm tomorrow, so the Alerts badge stays quiet. Nothing is deleted.");
    expect(text).toContain("On a break until 12 pm tomorrow Change");
  });
});

// The Find panel is gone from the page (Feed review, comment 1); its search logic stays for the alerts' places.
describe("what findInCommunity finds", () => {
  it("finds people, groups and places by name or by what is said about them, best first", () => {
    const blank = blankCommunityMemory();
    const network = findInCommunity(blank, "network", FEED);
    expect(network.groups.map(item => item.group.id)).toEqual(["garden", "walk"]);
    expect(foundLabel(network)).toBe("2 groups found");
    // "Rehab" starts a word of Stroke Rehabilitation Network, and is in what two clinicians do.
    const rehab = findInCommunity(blank, "rehab", FEED);
    expect(rehab.groups.map(item => item.group.id)).toEqual(["garden"]);
    expect(rehab.people.map(item => item.who)).toEqual(["priya", "ruth"]);
    expect(foundLabel(rehab)).toBe("2 people and 1 group found");
    expect(findInCommunity(blank, "michael", FEED).people.map(item => item.who)).toEqual(["michael"]);
    expect(findInCommunity(blank, "CHAU", FEED).people.map(item => item.who)).toEqual(["michael"]);
    expect(findInCommunity(blank, "han", FEED).people.map(item => item.who)).toEqual(["hannah"]);
    expect(findInCommunity(blank, "quiet", FEED).places.map(place => place.id)).toEqual(["settings"]);
    expect(findInCommunity(blank, "blocked", FEED).places.map(place => place.id)).toEqual(["friends-blocked", "safety"]);
    expect(findInCommunity(blank, "friends", FEED).places.map(place => place.id)).toEqual(["friends", "friends-list"]);
    expect(findInCommunity(blank, "who can message", FEED).places.map(place => place.id)).toContain("privacy");
    expect(findInCommunity(blank, "messages", FEED).places.map(place => place.id)).toContain("messages");
    const priya = findInCommunity(blank, "priya", FEED);
    expect(priya.people.map(item => item.who)).toEqual(["priya"]);
    // Spasticity Management Forum is suggested because of "Priya Raman and 14 others".
    expect(priya.suggested.map(group => group.id)).toEqual(["knit"]);
    const none = findInCommunity(blank, "zzz", FEED);
    expect(none.total).toBe(0);
    expect(foundLabel(none)).toBe("Nothing found");
    // No lounge in the clinician edition.
    expect(findInCommunity(blank, "   ", FEED).browse.map(place => place.id)).toEqual(["feed", "circle", "groups", "messages", "start", "friends", "safety", "settings"]);
    expect(findInCommunity(blank, "lounge", FEED).places).toEqual([]);
  });

  it("never finds someone blocked, and Gary is not one of the people to find", () => {
    expect(findInCommunity(memory({ blocks: { michael: Date.now() } }), "michael chau", FEED).people).toEqual([]);
    expect(findInCommunity(blankCommunityMemory(), "gary", FEED).people).toEqual([]);
    expect(findInCommunity(memory({ blocks: { gary: 0 } }), "gary", FEED).people).toEqual([]);
  });

  it("moves a group into your groups once it is joined", () => {
    expect(findInCommunity(blankCommunityMemory(), "spasticity", FEED).suggested.map(group => group.id)).toEqual(["knit"]);
    const joined = findInCommunity(memory({ joined: ["knit"] }), "spasticity", FEED);
    expect(joined.suggested).toEqual([]);
    expect(joined.groups.map(item => [item.group.id, item.sub])).toEqual([["knit", "You joined · 65 clinicians"]]);
    // Found by why it was suggested ("Priya Raman and 14 others") before joining, and still after.
    expect(findInCommunity(memory({ joined: ["knit"] }), "priya", FEED).groups.map(item => item.group.id)).toEqual(["knit"]);
  });
});

describe("the logic behind the panels", () => {
  it("scores names, folding case and accents", () => {
    expect(fold("Zoë")).toBe("zoe");
    expect(matchScore("han", "Hannah Brooks")).toBe(0);
    expect(matchScore("aphasia dysphagia", "Aphasia and Dysphagia Practice Group")).toBe(1);
    expect(matchScore("network", "Stroke Rehabilitation Network")).toBe(1);
    expect(matchScore("roo", "Hannah Brooks")).toBe(2);
    expect(matchScore("bath", "Hannah Brooks", ["Bath"])).toBe(3);
    expect(matchScore("xyz", "Hannah Brooks")).toBeNull();
    expect(matchScore("", "Hannah Brooks")).toBeNull();
    expect(matchScore("tomas", "Dr Tomás Leal")).toBe(1);
    expect(matchScore("zoe", "Zoë")).toBe(0);
  });

  it("marks the letters that match, in the name as written", () => {
    expect(highlight("Michael Chau", "chau")).toEqual([{ text: "Michael ", hit: false }, { text: "Chau", hit: true }]);
    expect(highlight("Tomás's group", "tomas")).toEqual([{ text: "Tomás", hit: true }, { text: "'s group", hit: false }]);
    expect(highlight("Hannah Brooks", "")).toEqual([{ text: "Hannah Brooks", hit: false }]);
  });

  it("knows which alerts are new, which to show, and what has happened since", () => {
    const blank = blankCommunityMemory();
    expect(newAlertIds(blank)).toEqual(["a-circle", "a-ruth", "a-garden", "a-michael"]);
    expect(newAlertIds(memory({ seenAlerts: ["a-circle", "a-garden"] }))).toEqual(["a-ruth", "a-michael"]);
    expect(shownAlerts(memory({ blocks: { michael: Date.now() } })).map(entry => entry.alert.id)).toEqual(["a-circle", "a-ruth", "a-garden"]);
    const alert = (id: string) => communityAlerts.find(item => item.id === id)!;
    expect(alertOutcome(blank, alert("a-ruth"))).toBeNull();
    expect(alertOutcome(memory({ answers: { ruth: "accepted" } }), alert("a-ruth"))).toEqual({ label: "Friends now", tone: "ok" });
    expect(alertOutcome(memory({ answers: { michael: "declined" } }), alert("a-michael"))).toEqual({ label: "You chose not now", tone: "plain" });
    expect(alertOutcome(memory({ read: ["garden"] }), alert("a-garden"))).toEqual({ label: "You've caught up", tone: "ok" });
    expect(alertOutcome(memory({ seated: true }), alert("a-circle"))).toEqual({ label: "You took your seat", tone: "ok" });
    expect(alertLabel(alert("a-circle"), "Patients have sent questions in advance", true, null)).toBe("Your group weekly session starts soon, new. Patients have sent questions in advance. Now.");
    expect(alertLabel(alert("a-ruth"), alert("a-ruth").detail, true, null)).toBe("Ruth Calloway wants to connect, new. We both run joint cardiac and stroke rehab. Would be good to connect. 10 minutes ago.");
    expect(alertLabel(alert("a-garden"), null, false, { label: "You've caught up", tone: "ok" })).toBe("3 new messages in Stroke Rehabilitation Network. 20 minutes ago. You've caught up.");
  });

  it("leads a connection request to the request (or the 'not now' left by declining it), and to the connection once accepted", () => {
    const alert = (id: string) => communityAlerts.find(item => item.id === id)!;
    expect(alertLink(blankCommunityMemory(), alert("a-ruth"), EVENTS)).toBe("/community?space=events&panel=friends");
    expect(alertLink(memory({ answers: { ruth: "declined" } }), alert("a-ruth"), EVENTS)).toBe("/community?space=events&panel=friends");
    expect(alertLink(memory({ answers: { ruth: "accepted" } }), alert("a-ruth"), EVENTS)).toBe("/community?space=events&panel=friends&tab=friends");
    expect(alertLink(memory({ answers: { ruth: "accepted" } }), alert("a-garden"), EVENTS)).toBe("/community?space=groups&group=garden");
    expect(alertLink(blankCommunityMemory(), alert("a-circle"), EVENTS)).toBe("/community?space=circle");
    // The old lounge address is not a space any more: the drawer opens over the feed.
    expect(alertLink(blankCommunityMemory(), alert("a-ruth"), LOUNGE)).toBe("/community?panel=friends");
  });

  it("says times and breaks the way the app does", () => {
    expect(clockLabel(new Date(2026, 9, 6, 0, 0))).toBe("12 am");
    expect(clockLabel(new Date(2026, 9, 6, 12, 0))).toBe("12 pm");
    expect(clockLabel(new Date(2026, 9, 6, 14, 5))).toBe("2:05 pm");
    const now = MIDDAY.getTime();
    expect(breakEndLabel(now + 6.5 * 3_600_000, now)).toBe("6:30 pm today");
    expect(breakEndLabel(now + 86_400_000, now)).toBe("12 pm tomorrow");
    expect(breakEndLabel(now + 7 * 86_400_000, now)).toBe("12 pm on Tuesday 13 October");
    const settings = defaultCommunitySettings();
    expect(quietNote(settings, MIDDAY)).toBeNull();
    expect(quietNote(settings, new Date(2026, 9, 6, 7, 0))).toContain("quiet time until 8 am");
    expect(quietNote({ ...settings, breakChoice: "week", breakUntil: now + 7 * 86_400_000 }, MIDDAY)).toBe("You're taking a break until 12 pm on Tuesday 13 October, so the Alerts badge stays quiet. Nothing is deleted.");
  });

  it("says what a friend button did, without promising anyone is told", () => {
    expect(friendChangeNote("priya", "none", "sent")).toBe("Request sent to Priya Raman.");
    expect(friendChangeNote("tomas", "sent", "none")).toBe("Request to Dr Tomás Leal cancelled. They won't be told.");
    expect(friendChangeNote("ruth", "none", "friend")).toBe("You and Ruth Calloway are friends now.");
    expect(friendChangeNote("ruth", "friend", "friend")).toBe("");
  });
});
