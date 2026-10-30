import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { communityStore, createCommunityStore, type CommunityMemory } from "@/lib/community-store";
import MessagesView from "./Messages";
import MessagesDock from "./MessagesDock";
import { allChats, chatById, directChats, unreadMessages } from "./messages-model";

// Messages for clinicians (comment 23): a professional messaging workspace with network colleagues and clinical
// groups. The identities are the ones My Network and the directory use.

vi.mock("@/components/RecoveryShell", () => ({ default: ({ children }: { children: unknown }) => children }));

const given = vi.hoisted(() => ({ memory: null as CommunityMemory | null }));
vi.mock("@/lib/community-store", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/community-store")>();
  return { ...actual, useCommunity: () => given.memory ?? actual.blankCommunityMemory() };
});

beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 9, 6, 12, 0)); });
afterAll(() => { vi.useRealTimers(); });

let store = createCommunityStore(() => null);
beforeEach(() => { store = createCommunityStore(() => null); given.memory = null; });

const words = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/\s+/g, " ");
const html = (path: string, element: ReturnType<typeof createElement>) => {
  given.memory = store.load();
  return renderToStaticMarkup(createElement(Router, { ssrPath: path, children: element })).replace(/ data-loc="[^"]*"/g, "");
};
/** Whether some opening tag of this kind carries every one of the given attributes, in any order. */
const tagWith = (page: string, name: string, ...attributes: string[]) =>
  (page.match(new RegExp(`<${name}\\b[^>]*>`, "g")) ?? []).some(tag => attributes.every(attribute => tag.includes(attribute)));
const messages = (chat: string | null) => html(`/community?space=messages${chat ? `&chat=${chat}` : ""}`, createElement(MessagesView, { active: false, chat, onPersonMenu: () => {} }));

describe("Messages for clinicians", () => {
  it("opens at the newest conversation: colleagues by name and specialty, the thread, and their professional profile", () => {
    const page = messages(null);
    const text = words(page);
    expect(page).toMatch(/<h2[^>]*data-view-heading[^>]*>Messages<\/h2>/);
    for (const name of ["Hannah Brooks", "Dr Kwame Mensah", "Grace Whitlow", "Stroke Rehabilitation Network"]) expect(text).toContain(name);
    expect(tagWith(page, "a", 'href="/community?space=messages&amp;chat=hannah"', 'aria-current="page"')).toBe(true);
    expect(text).toContain("I'll upload it to the Library under Stroke");
    expect(page).toContain('href="/clinicians/hannah-brooks"');
    for (const words of ["View profile", "Connected", "Connected since September 2026", "Member since March 2026", "Mute notifications", "Block or report", "Clinical interests"]) expect(text).toContain(words);
    // Search, the unread filter and groups stay.
    expect(page).toContain('placeholder="Search messages"');
    for (const filter of ["All", "Unread", "Groups"]) expect(page).toMatch(new RegExp(`<button[^>]*class="cm-segment"[^>]*aria-pressed="(true|false)">${filter}`));
    // No patient-community leftovers: friends, hearts or voice notes.
    for (const gone of ["Friends since", "Voice message", "voice note", "Heart for"]) expect(text).not.toContain(gone);
  });

  it("opens a group thread with each colleague's role and professional quick replies", () => {
    const page = messages("garden");
    const text = words(page);
    expect(page).toMatch(/<h2[^>]*>Stroke Rehabilitation Network<\/h2>/);
    expect(text).toContain("Has anyone moved their ESD team to a seven-day service?");
    expect(text).toContain("Open the group page");
    expect(text).toContain("Thanks for sharing");
    for (const gone of ["Lovely!", "Well done", "Heart for"]) expect(text).not.toContain(gone);
  });

  it("keeps what the clinician sends, in order, with a way to remove it, and their colleague's reply arrives after it", () => {
    const since = communityStore.visitStart;
    const note = store.addDirect("grace", { text: "Feedback after clinic is attached." }, since + 1000);
    const text = words(messages("grace"));
    expect(text).toContain("Feedback after clinic is attached.");
    expect(text).toContain("Remove your message");
    const replied = directChats(store.load(), { replied: { grace: since + 2000 }, typing: null }).find(chat => chat.id === "grace")!;
    expect(replied.lines.map(line => line.id).slice(-3)).toEqual(["dm-a2", note!.id, "reply-grace"]);
    expect(replied.lines[replied.lines.length - 1]).toMatchObject({ kind: "theirs", text: "Will do. I'll send feedback after next week's clinic." });
    store.removeDirect("grace", note!.id);
    expect(store.load().direct.grace).toBeUndefined();
  });

  it("counts unread conversations until they are read, not while muted, in the list and the docked window", () => {
    expect(unreadMessages(store.load())).toBe(2);
    expect(words(html("/community", createElement(MessagesDock, { space: "feed" })))).toContain("Messages 2 , 2 unread");
    store.markChatRead("hannah");
    expect(unreadMessages(store.load())).toBe(1);
    store.toggleChatMuted("kwame");
    expect(unreadMessages(store.load())).toBe(0);
    expect(words(messages("kwame"))).toContain("Notifications muted");
    expect(html("/community", createElement(MessagesDock, { space: "messages" }))).toBe("");
  });

  it("names someone not connected as nobody to write to, and lists groups among the conversations", () => {
    expect(chatById(store.load(), "sarah")).toBeNull();
    expect(chatById(store.load(), "kwame")).toMatchObject({ kind: "direct", connection: "Connected", profileHref: "/clinicians/kwame-mensah" });
    expect(allChats(store.load()).filter(chat => chat.kind === "group").map(chat => chat.name)).toContain("Parkinson's Clinical Network");
  });
});
