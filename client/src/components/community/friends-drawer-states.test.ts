import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import type { FriendsTab } from "@/content/community-samples";
import { communityStore, createCommunityStore, type CommunityMemory } from "@/lib/community-store";
import FriendsDrawer from "./FriendsDrawer";
import type { FriendsVisit } from "./friends-visit";

// The drawer after things have been done in it. A server render always reads the store's starting
// state, so these tests hand the drawer a record and a visit of their own.
const given = vi.hoisted(() => ({ memory: null as CommunityMemory | null, visit: null as FriendsVisit | null }));
vi.mock("@/lib/community-store", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/community-store")>();
  return { ...actual, useCommunity: () => given.memory ?? actual.blankCommunityMemory() };
});
vi.mock("./friends-visit", async importOriginal => {
  const actual = await importOriginal<typeof import("./friends-visit")>();
  return { ...actual, useFriendsVisit: () => given.visit ?? actual.friendsVisit.read() };
});

beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 9, 6, 12, 0)); });
afterAll(() => { vi.useRealTimers(); });

const DAY = 86_400_000;
let store = createCommunityStore(() => null);
let visit: FriendsVisit = { answered: [], cancelled: [], unblocked: [] };
beforeEach(() => {
  store = createCommunityStore(() => null);
  visit = { answered: [], cancelled: [], unblocked: [] };
});

const render = (tab: FriendsTab) => {
  given.memory = store.load();
  given.visit = visit;
  const drawer = createElement(FriendsDrawer, { tab, onTab: () => {}, onClose: () => {}, onPersonMenu: () => {}, fallbackFocus: () => null, name: "Zak" });
  return renderToStaticMarkup(createElement(Router, { ssrPath: "/community", children: drawer })).replace(/ data-loc="[^"]*"/g, "");
};
const words = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/\s+/g, " ");
/** The text with the tags taken out and nothing in their place, the way a button's name reads. */
const flat = (html: string) => words(html.replace(/<[^>]+>/g, ""));
const tagWith = (html: string, name: string, ...attributes: string[]) =>
  (html.match(new RegExp(`<${name}\\b[^>]*>`, "g")) ?? []).some(tag => attributes.every(attribute => tag.includes(attribute)));

describe("Invitations, after answering", () => {
  it("shows the now-connected card with Say hello, the not-now line with Undo, and All caught up", () => {
    store.acceptRequest("ruth");
    store.declineRequest("michael");
    visit = { ...visit, answered: ["ruth", "michael"] };
    let html = render("requests");
    let text = words(html);
    expect(text).toContain("5 connections · no invitations waiting");
    expect(text).toContain("You and Ruth Calloway are now connected");
    expect(text).toContain("Say hello to start the conversation.");
    expect(text).toContain("Say hello to Ruth Calloway");
    expect(text).toContain("Undo accepting Ruth Calloway's request");
    expect(text).toContain("You chose not now for Dr Michael Chau. He won't be told.");
    expect(flat(html)).toContain("Undo, and show Dr Michael Chau's request again");
    expect(text).toContain("All caught up. No invitations waiting.");
    // The clinician edition has no confetti on an accepted request.
    expect(html).not.toContain("cm-fr-confetti");
    expect(text).not.toMatch(/friends now|Wave hello/);

    store.wave("ruth");
    html = render("requests");
    text = words(html);
    expect(text).toContain("You said hello.");
    expect(text).toContain("Hello sent to Ruth Calloway");
    expect(tagWith(html, "button", 'class="cm-fr-wave is-on"', 'aria-disabled="true"')).toBe(true);
    expect(text).not.toMatch(/on its way/);
  });

  it("lets earlier answers go: Ruth is a connection, in the Connections tab", () => {
    store.acceptRequest("ruth");
    const html = render("requests");
    expect(words(html)).not.toContain("Ruth Calloway wants to connect");
    expect(words(html)).toContain("Dr Michael Chau wants to connect");
    expect(words(render("friends"))).toContain("Ruth Calloway Specialist cardiac rehabilitation nurse");
  });

  // Messages shows a just-accepted connection as "New connection" (messages-model statusWords); My Network should agree.
  it("marks a just-accepted connection as a New connection in the Connections tab", () => {
    store.acceptRequest("ruth");
    const text = words(render("friends"));
    expect(text).toContain("Ruth Calloway Specialist cardiac rehabilitation nurse New connection");
    expect(text).not.toContain("New friend");
  });

  it("says when new requests are off, and shows the choice at the foot", () => {
    store.updateSettings({ requestsFrom: "noOne" });
    const text = words(render("requests"));
    expect(text).toContain("New connection requests are off. You chose “No one” in Settings.");
    expect(text).toContain("Who can send you requests: No one Change");
  });

  it("names only the connections in common that are still connections", () => {
    store.block("hannah");
    const text = words(render("requests"));
    expect(text).toContain("Grace Whitlow is a connection of yours");
    expect(text).not.toContain("Hannah Brooks and Grace Whitlow are connections of yours");
  });
});

describe("Sent, Connections and Blocked, after a change", () => {
  it("keeps a cancelled request as Request cancelled, with Undo", () => {
    store.cancelRequest("tomas");
    visit = { ...visit, cancelled: [{ who: "tomas", at: Date.now() - 2 * DAY }] };
    const html = render("sent");
    const text = words(html);
    expect(tagWith(html, "li", 'class="cm-fr-card cm-fr-sent is-cancelled"')).toBe(true);
    expect(text).toContain("Request cancelled");
    expect(flat(html)).toContain("Undo: keep your request to Dr Tomás Leal");
    expect(text).toContain("Sent 0 , 0");
  });

  it("keeps a connection blocked in this visit in their place, with Undo and the ··· button", () => {
    store.block("hannah", communityStore.visitStart + 1);
    store.mute("grace");
    const html = render("friends");
    const text = words(html);
    expect(text).toContain("Connections 3 , 3");
    expect(flat(html)).toContain("Undo, and unblock Hannah Brooks");
    expect(tagWith(html, "button", 'aria-label="More options for Hannah Brooks"')).toBe(true);
    expect(text).not.toContain("Say hello to Hannah Brooks");
    expect(text).toContain("Active yesterday · posts hidden");
  });

  it("keeps someone unblocked in this visit as Unblocked just now, with Undo", () => {
    store.unblock("gary");
    visit = { ...visit, unblocked: [{ who: "gary", at: Date.now() - 3 * DAY }] };
    const html = render("blocked");
    const text = words(html);
    expect(text).toContain("Unblocked just now");
    expect(flat(html)).toContain("Undo, and block Gary again");
    expect(text).toContain("Blocked 0 , 0");
  });

  it("says so when nobody is blocked or waiting", () => {
    store.unblock("gary");
    store.cancelRequest("tomas");
    expect(words(render("blocked"))).toContain("You haven't blocked anyone.");
    expect(words(render("sent"))).toContain("No connection requests waiting for an answer.");
  });
});
