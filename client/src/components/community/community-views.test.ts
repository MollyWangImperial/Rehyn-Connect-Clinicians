import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import Community from "@/pages/Community";
import { blankCommunityMemory, createCommunityStore, type CommunityMemory, type CommunitySpace } from "@/lib/community-store";
import { OwnPostCard } from "./Feed";
import MessagesDock from "./MessagesDock";
import type { SettingsSection } from "./settings-model";
import SettingsView from "./SettingsView";

vi.mock("@/components/RecoveryShell", () => ({ default: ({ children }: { children: unknown }) => children }));
// What the page reads as the stored record (a blank one, as on a first visit, unless a test sets it).
const held = vi.hoisted(() => ({ memory: null as CommunityMemory | null }));
vi.mock("@/lib/community-store", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/community-store")>();
  return { ...actual, useCommunity: () => held.memory ?? actual.blankCommunityMemory() };
});

// Midday, so quiet time (9 pm to 8 am) never hides the alerts badge while the tests run.
beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 9, 6, 12, 0)); });
afterAll(() => { vi.useRealTimers(); });
afterEach(() => { held.memory = null; });

const page = (path: string) => renderToStaticMarkup(createElement(Router, { ssrPath: path, children: createElement(Community) })).replace(/ data-loc="[^"]*"/g, "");
/** Settings → Your profile: the community settings, as drawn inside the Settings window. */
const settings = (section: SettingsSection, embedded = false) => renderToStaticMarkup(createElement(Router, { ssrPath: "/community", children: createElement(SettingsView, { name: "Zak", section, embedded }) })).replace(/ data-loc="[^"]*"/g, "");
const words = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/\s+/g, " ");
/** Whether some opening tag of this kind carries every one of the given attributes, in any order. */
const tagWith = (html: string, name: string, ...attributes: string[]) =>
  (html.match(new RegExp(`<${name}\\b[^>]*>`, "g")) ?? []).some(tag => attributes.every(attribute => tag.includes(attribute)));

describe("Rehyn Connect for clinicians views", () => {
  it("opens on the feed, with the composer, clinicians' posts and the side cards (the tabs are in the shell's top bar)", () => {
    const html = page("/community");
    const text = words(html);
    expect(html).toMatch(/<h1 class="cm-sr"[^>]*data-page-heading[^>]*>Rehyn Connect for clinicians<\/h1>/);
    expect(html).not.toContain("cm-tab");
    // The composer greets the signed-in clinician (the demo profile, Dr Amara Osei) and offers an image, nothing else.
    expect(text).toContain("Start a post, Amara");
    expect((html.match(/class="cm-chip /g) ?? []).length).toBe(1);
    expect(tagWith(html, "button", 'class="cm-chip cm-chip-photo"')).toBe(true);
    expect(text).toContain("Image");
    for (const name of ["Hannah Brooks", "Dr Tomás Leal", "Priya Raman", "Dr Kwame Mensah", "Ruth Calloway", "Dr Sarah Whitfield"]) expect(text).toContain(name);
    // Only clinicians post here: the unverified account's post never shows.
    expect(text).not.toContain("Earn £500 a week");
    expect(tagWith(html, "button", 'class="cm-react cm-tone-love "', 'aria-pressed="false"')).toBe(true);
    // Comments are open under every post, with "Write a comment" (no button to open them first).
    expect(html).not.toContain("cm-comments-toggle");
    // Hannah's post shows its two latest comments, the rest behind "View all".
    expect(text).toContain("Priya Raman Great work, Hannah. Sharing with our service lead.");
    expect(text).not.toContain("Impressive numbers. How did you staff weekend SLT cover?");
    expect(text).toContain("View all comments");
    expect(text).not.toMatch(/View all \d+ comments/);
    expect((html.match(/placeholder="Write a comment"/g) ?? []).length).toBeGreaterThanOrEqual(4);
    // No Daily question in the feed.
    expect(html).not.toContain("dq-card");
    expect(text).not.toContain("Daily question");
    // The right column: My Consultations first, then the clinician's Group weekly sessions. No Library card, no
    // Sunday circle or lounge cards, no groups or people cards, and no guidelines footer.
    expect(text).toContain("My Consultations");
    expect(text).toContain("Group weekly sessions");
    expect(html.indexOf("My Consultations")).toBeLessThan(html.indexOf("Group weekly sessions"));
    expect(tagWith(html, "a", 'href="/clinicians/portal/consultations"')).toBe(true);
    expect(tagWith(html, "a", 'href="/community?space=circle"', 'class="cm-sessions-all"')).toBe(true);
    // Consultation rows give only the length (every consultation is by video), with no example label or demo note;
    // session rows give the date and time range and the title, with no minutes, topics or places.
    expect(html).toMatch(/<span>30 min<\/span>/);
    for (const gone of ["Video · 30 min", "· Example", "Examples for the demo profile", "· 60 min", "· 45 min", "25 places", "20 places"]) expect(text).not.toContain(gone);
    expect(html).not.toContain("cm-session-meta");
    for (const gone of ["The library", "Open the library", "Community guidelines and safety", "Take your seat", "Join the conversation", "Your groups", "People you may know"]) expect(text).not.toContain(gone);
    expect(tagWith(html, "a", 'href="/community?space=start"')).toBe(false);
  });

  it("shows who can see your own posts, and never says only you can see what you share", () => {
    // A post the person made: its line says who sees it (Connections, until the setting is changed).
    const post = createCommunityStore(() => null).addPost({ text: "Walked to the post box today." });
    expect(post).not.toBeNull();
    const card = words(renderToStaticMarkup(createElement(OwnPostCard, { post: post!, name: "Zak" })));
    expect(card).toContain("Walked to the post box today.");
    expect(card).toContain("Seen by Connections");
    const onlyYou = /only you (can|will) see|only visible to you/i;
    expect(card).not.toMatch(onlyYou);
    for (const path of ["/community", "/community?space=circle", "/community?space=events", "/community?space=groups", "/community?space=start", "/community?space=settings", "/community?panel=friends"]) {
      expect(words(page(path)), path).not.toMatch(onlyYou);
    }
    expect(words(settings("profile"))).toContain("Who sees my posts by default");
  });

  it("has no lounge or poker night: their old addresses open the feed", () => {
    for (const path of ["/community?space=lounge", "/community?space=poker"]) {
      const html = page(path);
      expect(html, path).toMatch(/<div class="cm-space" data-space="feed">/);
      expect(words(html), path).toContain("Start a post, Amara");
      for (const gone of ["The lounge", "House rules", "Poker night", "Wave to"]) expect(words(html), path).not.toContain(gone);
    }
  });

  it("shows Group weekly sessions at the circle's address, with no Sunday circle", () => {
    const html = page("/community?space=circle");
    const text = words(html);
    expect(html).toMatch(/<div class="cm-space" data-space="circle">/);
    expect(html).toMatch(/<h1[^>]*data-view-heading[^>]*>Group weekly sessions<\/h1>/);
    expect(text).toContain("Coming up");
    expect(text).toContain("How do I lower my risk of another stroke?");
    // The Sunday circle is gone: no teacup, no seats, no captions, no poker night.
    for (const gone of ["teacup", "Take your seat", "an empty seat, kept for you", "Said in the circle", "Poker night", "Leave quietly"]) expect(text).not.toContain(gone);
    expect(html).not.toContain("cm-stage");
    expect(html).not.toContain('href="/community?space=poker"');
  });

  it("shows My professional events at its own address", () => {
    const html = page("/community?space=events");
    expect(html).toMatch(/<div class="cm-space" data-space="events">/);
    expect(html).toMatch(/<h1[^>]*data-view-heading[^>]*>My professional events<\/h1>/);
    expect(words(html)).toContain("Regional Stroke Forum: early supported discharge");
  });

  it("opens a named group, with its challenge, the group list and suggestions", () => {
    const html = page("/community?space=groups&group=walk");
    const text = words(html);
    expect(html).toMatch(/<h2[^>]*id="cm-group-title"[^>]*>Parkinson&#x27;s Clinical Network<\/h2>/);
    expect(text).toContain("Neurologists, Parkinson's nurse specialists, physios and SLTs");
    expect(text).toContain("This month Review time-critical medication on your ward");
    expect(tagWith(html, "a", 'href="/community?space=groups&amp;group=walk"', 'class="cm-group-pick is-on"', 'aria-current="page"')).toBe(true);
    // Your groups come first, then the open group.
    expect(html.indexOf("Your groups")).toBeLessThan(html.indexOf('id="cm-group-title"'));
    expect(text).toContain("Suggested groups");
    expect(text).toContain("Spasticity Management Forum");
    expect(text).toContain("Invite colleagues");
    expect(text).toContain("Member");
  });

  it("opens Messages at the newest conversation, with the list, the conversation and who it is with", () => {
    const html = page("/community?space=messages");
    const text = words(html);
    expect(html).toMatch(/<h2[^>]*data-view-heading[^>]*>Messages<\/h2>/);
    for (const name of ["Hannah Brooks", "Dr Kwame Mensah", "Grace Whitlow", "Stroke Rehabilitation Network"]) expect(text).toContain(name);
    expect(tagWith(html, "a", 'href="/community?space=messages&amp;chat=hannah"', 'aria-current="page"')).toBe(true);
    expect(text).toMatch(/Hannah Brooks, \d{1,2}:\d\d [ap]m: Happy to join a call with your service lead next week if that helps\./);
    for (const tool of ["Thank you", "Thursday works", "I'll send an invite", "Mute notifications", "Block or report"]) expect(text).toContain(tool);
    // Text size and reading aloud are set in Community settings: the conversation has no toolbar for them.
    for (const gone of ["Larger text", "Read aloud"]) expect(text).not.toContain(gone);
    expect(text).toContain("Member since March 2026");
    expect(tagWith(html, "button", "aria-pressed", 'class="cm-segment"')).toBe(true);
    // The little window stays out of the way on Messages itself.
    expect(html).not.toContain("cm-dock-bar");
  });

  it("opens a named conversation, a group's, and falls back for someone who isn't a connection", () => {
    expect(words(page("/community?space=messages&chat=kwame"))).toContain("Yes, gladly. I can cover the screening tools");
    const garden = page("/community?space=messages&chat=garden");
    expect(garden).toMatch(/<h2[^>]*>Stroke Rehabilitation Network<\/h2>/);
    expect(words(garden)).toContain("Open the group page");
    // Gary is no connection (and is blocked): his name opens nothing, so the newest conversation shows.
    expect(words(page("/community?space=messages&chat=gary"))).toMatch(/Hannah Brooks, \d{1,2}:\d\d [ap]m: Happy to join a call/);
  });

  it("shows the Messages window at the bottom of the other pages as a small pill with the count", () => {
    // The shell (mocked away here) renders the window on every page, with the community view showing.
    const dock = (space: CommunitySpace | null) => renderToStaticMarkup(createElement(Router, { ssrPath: "/community", children: createElement(MessagesDock, { space }) }));
    const html = dock("events");
    expect(tagWith(html, "button", 'class="cm-dock-bar cm-rise"', 'aria-expanded="false"')).toBe(true);
    expect(words(html)).toContain("Messages 2 , 2 unread");
    expect(words(html)).not.toContain("Happy to join a call");
    // The same pill on a page outside the community.
    expect(words(dock(null))).toContain("Messages 2 , 2 unread");
    expect(dock("start")).not.toContain("cm-dock-bar");
    expect(dock("messages")).not.toContain("cm-dock-bar");
  });

  it("keeps privacy and blocked people under Your profile in Settings (the Friends tab has gone; the My Network drawer stays)", () => {
    const html = settings("profile");
    const text = words(html);
    expect(html).not.toContain("cm-fp-");
    expect(tagWith(html, "div", 'class="cm-set-profile"')).toBe(true);
    // Your profile, then Your privacy, then Blocked, before the other sections.
    expect(text.indexOf("Your profile")).toBeLessThan(text.indexOf("Your privacy"));
    expect(text.indexOf("Your privacy")).toBeLessThan(text.indexOf("Blocked 1 blocked"));
    expect(text.indexOf("Blocked 1 blocked")).toBeLessThan(text.indexOf("What you see"));
    for (const choice of ["Who sees my posts by default", "Who can message me", "Who can ask to be friends", "Show my town", "Show when I'm online"]) expect(text).toContain(choice);
    expect(text).toContain("Connections and my groups");
    expect(tagWith(html, "button", 'role="switch"', 'aria-checked="true"')).toBe(true);
    expect(text).toContain("Gary Blocked 3 days ago");
    expect(tagWith(html, "button", 'class="cm-set-small"', 'aria-expanded="false"')).toBe(true);
    expect(text).toContain("Unblock Gary");
    expect(text).toContain("People you block are never told.");
    // The friends tab's page has gone: its address leads to Your profile, and the drawer still has the invitations.
    expect(page("/community?space=friends")).not.toContain("Invitations 2 waiting");
    expect(words(page("/community?panel=friends"))).toContain("Ruth Calloway wants to connect");
  });

  it("falls back to the first group for an unknown group", () => {
    expect(page("/community?space=groups&group=mine-gone")).toMatch(/<h2[^>]*id="cm-group-title"[^>]*>Stroke Rehabilitation Network<\/h2>/);
  });

  it("starts a group inside a condition, private by default, with a way back to the groups", () => {
    const html = page("/community?space=start");
    const text = words(html);
    expect(tagWith(html, "a", 'class="cm-back"', 'href="/community?space=groups"')).toBe(true);
    expect(html).toMatch(/<h1[^>]*data-view-heading[^>]*>Start a group<\/h1>/);
    // Six conditions, seven kinds of professional group (no games), and private or public.
    expect((html.match(/type="radio"/g) ?? []).length).toBe(15);
    expect((html.match(/type="checkbox"/g) ?? []).length).toBe(6);
    expect(text).not.toMatch(/\bGames\b/);
    expect(text).toContain("Default");
    expect(text).toContain("You and 2 colleagues");
    expect(html).not.toContain("cm-tabs");
    expect(html).not.toContain("cm-tools");
  });
});

describe("the top of the page", () => {
  it("has no header card or toolbar: the page starts with its content, with only a hidden heading for screen readers (Feed review, comments 1 to 7)", () => {
    const html = page("/community");
    const text = words(html);
    expect(html).not.toContain('class="cm-head"');
    expect(html).not.toContain("cm-toolstrip");
    expect(html).not.toContain("cm-tool ");
    expect(text).not.toContain("Search people or groups");
    expect(tagWith(html, "h1", 'class="cm-sr"', "data-page-heading")).toBe(true);
    // The spaces' tabs and Settings are in the shell's top bar; Alerts and Friends in the profile panel (recovery-shell.test.ts).
    expect(html).not.toContain('class="cm-tabs"');
    expect(html).not.toContain('aria-label="Community settings"');
    expect(html).not.toContain('aria-label="Alerts, 4 new"');
  });

  it("draws no dialog until the My Network drawer is asked for", () => {
    expect(page("/community?space=events")).not.toContain('role="dialog"');
  });
});

describe("the feed with connections, safety and settings", () => {
  const withHiddenWords = (hiddenWords: string[]): CommunityMemory => {
    const memory = blankCommunityMemory();
    return { ...memory, settings: { ...memory.settings, hiddenWords } };
  };

  it("leaves out the unverified account's post (blocked or not), covers no clinician's post and hides posts with hidden words", () => {
    const html = page("/community");
    const text = words(html);
    expect(text).not.toContain("Earn £500 a week");
    expect(tagWith(html, "button", 'aria-label="More options for Hannah Brooks&#x27;s post"', 'aria-haspopup="dialog"')).toBe(true);
    expect(tagWith(html, "button", 'aria-label="More options for Dr Tomás Leal&#x27;s post"')).toBe(true);
    // Gentle mode is on, but no clinician's post is one it covers.
    expect(html).not.toContain("cm-gentle");
    expect(text).not.toContain("Gentle mode keeps it covered");
    // Gary unblocked: his post still stays out, since only clinicians' posts reach this feed.
    held.memory = { ...blankCommunityMemory(), blocks: { gary: 0 } };
    expect(words(page("/community"))).not.toContain("Earn £500 a week");
    // A hidden word keeps the post that mentions it behind a note.
    held.memory = withHiddenWords(["anticoagulation"]);
    const hidden = page("/community");
    expect(words(hidden)).not.toContain("Question for the network");
    expect(words(hidden)).toContain("1 post is hidden because it mentions “anticoagulation”");
    // "Change your hidden words" opens Community settings at What you see.
    expect(tagWith(hidden, "a", 'href="/community?space=settings&amp;section=see"', 'class="cm-text-button"')).toBe(true);
  });

  it("shows where the person stands with each writer", () => {
    const html = page("/community");
    const text = words(html);
    expect(text).toContain("Connected with Hannah Brooks");
    expect(text).toContain("Pending : your request to Dr Tomás Leal");
    expect(text).toContain("Connect with Priya Raman");
    expect(text).toContain("Wants to connect : see Ruth Calloway's invitation");
    expect(tagWith(html, "a", 'class="cm-friend is-asking "', 'href="/community?panel=friends"')).toBe(true);
  });
});

describe("the toolbar's pages", () => {
  it("no longer has a Community settings page: its address shows the feed, and Settings → Your profile opens over it (review)", () => {
    const html = page("/community?space=settings");
    expect(html).not.toContain("Community settings");
    expect(html).not.toMatch(/data-space="settings"/);
    expect(html).toMatch(/<div class="cm-space" data-space="feed">/);
    // Inside Settings the page keeps its parts, without its own title (the window names it).
    const inside = settings("profile", true);
    expect(inside).not.toContain("Community settings");
    for (const part of ["Your profile", "Your privacy", "Blocked", "What you see", "Reading and listening", "Quiet times", "How others would see you"]) expect(words(inside)).toContain(part);
  });

  it("opens Safety as a page, with Gary blocked and a way to Warning signs", () => {
    const html = page("/community?space=safety");
    const text = words(html);
    expect(html).toMatch(/<h2[^>]*data-view-heading[^>]*>Safety<\/h2>/);
    expect(text).toContain("Gary");
    expect(text).toContain("Blocked 3 days ago");
    expect(html).toContain('href="/fast-check');
  });

  it("opens the My Network drawer as a dialog over the feed, at Invitations", () => {
    const html = page("/community?panel=friends");
    const text = words(html);
    expect(tagWith(html, "div", 'role="dialog"', 'aria-modal="true"', 'class="cm-dialog cm-dialog-drawer cm-fr-drawer"')).toBe(true);
    expect(text).toContain("My Network");
    expect(tagWith(html, "button", 'role="tab"', 'aria-selected="true"')).toBe(true);
    expect(text).toContain("Ruth Calloway wants to connect");
    expect(text).toContain("Dr Michael Chau wants to connect");
    // The feed is still there underneath.
    expect(text).toContain("Start a post, Amara");
  });

  it("opens the drawer at another tab, over another view", () => {
    const sent = page("/community?space=events&panel=friends&tab=sent");
    expect(words(sent)).toContain("Cancel your request to Dr Tomás Leal");
    expect(words(sent)).toContain("My professional events");
    const blocked = page("/community?space=safety&panel=friends&tab=blocked");
    expect(words(blocked)).toContain("Gary");
    expect(tagWith(blocked, "div", 'role="dialog"')).toBe(true);
  });
});
