import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import Community from "@/pages/Community";
import { createCommunityStore, daysAgoLabel } from "@/lib/community-store";
import { blockedRows, createFriendsVisit, friendRows, requestCards, sentRows, type RequestCard } from "./friends-visit";

vi.mock("@/components/RecoveryShell", () => ({ default: ({ children }: { children: unknown }) => children }));

// Midday, so quiet time (9 pm to 8 am) never changes the toolbar while the tests run.
beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 9, 6, 12, 0)); });
afterAll(() => { vi.useRealTimers(); });

const DAY = 86_400_000;
const page = (path: string) => renderToStaticMarkup(createElement(Router, { ssrPath: path, children: createElement(Community) })).replace(/ data-loc="[^"]*"/g, "");
/** The drawer's own markup: from its dialog box to the end, so the page behind it doesn't count. */
const drawer = (path: string) => {
  const html = page(path);
  const at = html.indexOf('class="cm-dialog cm-dialog-drawer cm-fr-drawer"');
  expect(at).toBeGreaterThan(-1);
  return html.slice(at);
};
const words = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/\s+/g, " ");
/** Whether some opening tag of this kind carries every one of the given attributes, in any order. */
const tagWith = (html: string, name: string, ...attributes: string[]) =>
  (html.match(new RegExp(`<${name}\\b[^>]*>`, "g")) ?? []).some(tag => attributes.every(attribute => tag.includes(attribute)));
const selectedTab = (html: string) => html.match(/aria-selected="true"[^>]*><span class="cm-fr-tab-label">([^<]+)</)?.[1];
const cardStates = (cards: RequestCard[]) => cards.map(card => `${card.request.who}:${card.state}`);

describe("My Network (the Friends drawer)", () => {
  it("opens at Invitations: both requests with their notes and connections in common, then people you may know", () => {
    const html = drawer("/community?panel=friends");
    const text = words(html);
    expect(text).toContain("My Network");
    expect(text).toContain("4 connections · 2 invitations waiting for you");
    expect(tagWith(html, "div", 'role="tablist"')).toBe(true);
    expect((html.match(/role="tab"/g) ?? []).length).toBe(4);
    expect(selectedTab(html)).toBe("Invitations");
    expect(tagWith(html, "span", 'class="cm-segment-count is-waiting"')).toBe(true);
    expect(text).toContain(", 2 waiting");
    expect(tagWith(html, "div", 'role="tabpanel"')).toBe(true);
    expect(text).toContain("Ruth Calloway wants to connect");
    expect(text).toContain("Dr Michael Chau wants to connect");
    expect(text).toContain("Whitby · in Stroke Rehabilitation Network with you");
    expect(text).toContain("“We both run joint cardiac and stroke rehab. Would be good to connect.”");
    expect(text).toContain("Hannah Brooks and Grace Whitlow are connections of yours");
    expect(text).toContain("Kwame Mensah is a connection of yours");
    expect(text).toContain("Accept Ruth Calloway's request");
    expect(text).toContain("Not now for Dr Michael Chau");
    expect(text).not.toContain("All caught up");
    expect(text).toContain("People you may know");
    expect(text).toContain("Also in Aphasia and Dysphagia Practice Group");
    expect(text).toContain("Connect with Priya Raman");
    expect(text).toContain("Connect with Joseph Hartley");
    // Connection wording, not the patient edition's friendship wording.
    expect(text).not.toMatch(/wants to be friends|Add friend|friends of yours/);
  });

  it("links to Community settings, at Your profile (where Your privacy is), from the foot of every tab", () => {
    for (const tab of ["", "&tab=sent", "&tab=friends", "&tab=blocked"]) {
      const html = drawer(`/community?space=events&panel=friends${tab}`);
      expect(tagWith(html, "a", 'href="/community?space=settings&amp;section=profile"', 'class="cm-dialog-foot-link cm-fr-foot"')).toBe(true);
      expect(words(html)).toContain("Who can send you requests: Any verified clinician Change");
    }
  });

  it("shows requests sent, with Cancel, and that withdrawing one isn't told", () => {
    const html = drawer("/community?space=events&panel=friends&tab=sent");
    const text = words(html);
    expect(selectedTab(html)).toBe("Sent");
    expect(text).toContain("Dr Tomás Leal");
    expect(text).toContain("Sent 2 days ago");
    expect(text).toContain("Cancel your request to Dr Tomás Leal");
    expect(text).toContain("If you withdraw one, they are not told.");
  });

  it("lists connections with a filter, online dots, Say hello and the ··· button for the safety sheet", () => {
    const html = drawer("/community?panel=friends&tab=friends");
    const text = words(html);
    expect(selectedTab(html)).toBe("Connections");
    expect(tagWith(html, "input", 'type="search"', 'placeholder="Search your connections"')).toBe(true);
    expect(text).toContain("Find a connection");
    for (const name of ["Dr Kwame Mensah", "Hannah Brooks", "Grace Whitlow", "Imani Clarke"]) {
      expect(tagWith(html, "button", `aria-label="More options for ${name}"`, 'aria-haspopup="dialog"')).toBe(true);
      expect(text).toContain(`Say hello to ${name}`);
    }
    expect(text).not.toContain("Wave to");
    expect(text).toContain("Online now");
    expect((html.match(/class="cm-fr-online"/g) ?? []).length).toBe(1);
    // There is no messaging in this preview, so there is no Message button.
    expect(html).not.toMatch(/>Message</);
  });

  it("lists Gary as blocked, explains what blocking does and links to Safety", () => {
    const html = drawer("/community?space=safety&panel=friends&tab=blocked");
    const text = words(html);
    expect(selectedTab(html)).toBe("Blocked");
    expect(text).toContain("Gary");
    expect(text).toContain("Blocked 3 days ago");
    expect(tagWith(html, "button", 'class="cm-fr-pill"', 'aria-expanded="false"')).toBe(true);
    expect(text).toContain("Unblock Gary");
    expect(text).toContain("What blocking does");
    expect(text).toContain("They are never told that you blocked them.");
    expect(tagWith(html, "a", 'href="/community?space=safety"', 'class="cm-fr-safety"')).toBe(true);
  });

  it("never says anyone is told, or that anything is on its way", () => {
    for (const tab of ["", "&tab=sent", "&tab=friends", "&tab=blocked"]) {
      expect(words(drawer(`/community?panel=friends${tab}`))).not.toMatch(/on its way|notif|will be told|reviewed|within 24/i);
    }
  });
});

describe("My Network's rows", () => {
  const fresh = () => createCommunityStore(() => null);

  it("remembers what was done in this visit until it is cleared", () => {
    const visit = createFriendsVisit();
    let changes = 0;
    const stop = visit.subscribe(() => { changes++; });
    visit.answered("ruth");
    visit.answered("ruth");
    visit.cancelled("tomas", 5);
    visit.resent("tomas");
    visit.resent("tomas");
    visit.unblocked("gary", 7);
    expect(visit.read()).toEqual({ answered: ["ruth"], cancelled: [], unblocked: [{ who: "gary", at: 7 }] });
    expect(changes).toBe(4);
    stop();
    visit.clear();
    expect(changes).toBe(4);
    expect(visit.read()).toEqual({ answered: [], cancelled: [], unblocked: [] });
  });

  it("keeps a request answered in this visit as its card, then keeps only the 'not now' with its Undo", () => {
    const store = fresh();
    const visit = createFriendsVisit();
    expect(cardStates(requestCards(store.load(), visit.read()))).toEqual(["ruth:pending", "michael:pending"]);
    visit.answered("ruth");
    store.acceptRequest("ruth");
    visit.answered("michael");
    store.declineRequest("michael");
    expect(cardStates(requestCards(store.load(), visit.read()))).toEqual(["ruth:accepted", "michael:declined"]);
    // On another visit Ruth's card has gone (she is in the Connections tab). Michael's "not now" stays,
    // so the person can still change their mind, and Michael's alert still leads somewhere.
    expect(cardStates(requestCards(store.load(), createFriendsVisit().read()))).toEqual(["michael:declined"]);
    expect(friendRows(store.load()).map(row => row.who)).toEqual(["kwame", "hannah", "grace", "imani", "ruth"]);
    store.undoAnswer("michael");
    expect(cardStates(requestCards(store.load(), visit.read()))).toEqual(["ruth:accepted", "michael:pending"]);
  });

  it("keeps a request cancelled in this visit in Sent, and Undo puts it back as it was", () => {
    const store = fresh();
    const visit = createFriendsVisit();
    const now = Date.now();
    const [tomas] = sentRows(store.load(), visit.read(), now);
    expect(tomas).toEqual({ who: "tomas", at: now - 2 * DAY, cancelled: false });
    visit.cancelled("tomas", tomas.at);
    store.cancelRequest("tomas");
    expect(sentRows(store.load(), visit.read(), now)).toEqual([{ ...tomas, cancelled: true }]);
    expect(sentRows(store.load(), createFriendsVisit().read(), now)).toEqual([]);
    store.requestFriend("tomas", tomas.at);
    visit.resent("tomas");
    expect(sentRows(store.load(), visit.read(), now)).toEqual([tomas]);

    // A request sent this visit keeps the time it was first sent through a cancel and an Undo.
    store.requestFriend("joseph", now - 60_000);
    const [joseph] = sentRows(store.load(), visit.read(), now);
    expect(joseph).toEqual({ who: "joseph", at: now - 60_000, cancelled: false });
    visit.cancelled("joseph", joseph.at);
    store.cancelRequest("joseph");
    expect(sentRows(store.load(), visit.read(), now).map(row => `${row.who}:${row.cancelled}`)).toEqual(["joseph:true", "tomas:false"]);
    store.requestFriend("joseph", joseph.at);
    visit.resent("joseph");
    expect(sentRows(store.load(), visit.read(), now)).toEqual([joseph, tomas]);
  });

  it("keeps someone unblocked in this visit in Blocked, and Undo blocks them from when they were first blocked", () => {
    const store = fresh();
    const visit = createFriendsVisit();
    const now = Date.now();
    const [gary] = blockedRows(store.load(), visit.read(), now);
    expect(gary).toEqual({ who: "gary", at: now - 3 * DAY, unblocked: false });
    visit.unblocked("gary", gary.at);
    store.unblock("gary");
    expect(blockedRows(store.load(), visit.read(), now)).toEqual([{ ...gary, unblocked: true }]);
    expect(blockedRows(store.load(), createFriendsVisit().read(), now)).toEqual([]);
    store.block("gary", gary.at);
    visit.reblocked("gary");
    expect(blockedRows(store.load(), visit.read(), now)).toEqual([gary]);
    expect(daysAgoLabel(gary.at, now)).toBe("3 days ago");
  });

  it("keeps a friend blocked in this visit in their place, so the ··· button that blocked them stays", () => {
    const store = fresh();
    const now = Date.now();
    expect(friendRows(store.load(), now - 1000, now).map(row => row.who)).toEqual(["kwame", "hannah", "grace", "imani"]);
    store.block("hannah", now);
    const rows = friendRows(store.load(), now - 1000, now);
    expect(rows.map(row => row.who)).toEqual(["kwame", "hannah", "grace", "imani"]);
    expect(rows[1]).toMatchObject({ who: "hannah", blockedAt: now });
    // Blocked before this visit began: no longer listed.
    expect(friendRows(store.load(), now + 1000, now).map(row => row.who)).toEqual(["kwame", "grace", "imani"]);
    store.mute("grace", now);
    expect(friendRows(store.load(), now - 1000, now)[2]).toMatchObject({ who: "grace", muted: true, blockedAt: null });
  });
});
