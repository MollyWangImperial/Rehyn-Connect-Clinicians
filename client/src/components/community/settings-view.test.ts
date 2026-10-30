import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import type { CommunityMemory, CommunitySettings, SettingsSection } from "@/lib/community-store";
import type { Profile } from "@/lib/profile";

// What the page reads in each test: the stored record and the profile (by default, a blank record
// and the default profile, as on a first visit).
const state = vi.hoisted(() => ({ memory: null as CommunityMemory | null, profile: null as Profile | null }));

vi.mock("@/components/RecoveryShell", () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock("@/lib/community-store", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/community-store")>();
  return { ...actual, useCommunity: () => state.memory ?? actual.blankCommunityMemory() };
});
vi.mock("@/lib/profile", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/profile")>();
  return { ...actual, useProfile: () => state.profile ?? actual.DEFAULT_PROFILE };
});

import { blankCommunityMemory } from "@/lib/community-store";
import { DEFAULT_PROFILE } from "@/lib/profile";
import Community from "@/pages/Community";
import SettingsView from "./SettingsView";

// Midday on Tuesday 6 October 2026, so quiet time is not on while the tests run.
const NOW = new Date(2026, 9, 6, 12, 0).getTime();
const DAY = 86_400_000;
beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW); });
afterAll(() => { vi.useRealTimers(); });
afterEach(() => { state.memory = null; state.profile = null; });

const clean = (html: string) => html.replace(/ data-loc="[^"]*"/g, "");
const page = (path: string) => clean(renderToStaticMarkup(createElement(Router, { ssrPath: path, children: createElement(Community) })));
const view = () => clean(renderToStaticMarkup(createElement(Router, { ssrPath: "/community?space=settings", children: createElement(SettingsView, { name: "Zak" }) })));
/** The settings as Settings → Your profile draws them when an address names a section (`?space=settings&section=…`). */
const at = (section: string) => clean(renderToStaticMarkup(createElement(Router, { ssrPath: "/community", children: createElement(SettingsView, { name: "Zak", section: section as SettingsSection }) })));
const words = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/\s+/g, " ");
/** Every opening tag of this kind that carries all of the given attributes. */
const tagsWith = (html: string, name: string, ...attributes: string[]) =>
  (html.match(new RegExp(`<${name}\\b[^>]*>`, "g")) ?? []).filter(tag => attributes.every(attribute => tag.includes(attribute)));
const tagWith = (html: string, name: string, ...attributes: string[]) => tagsWith(html, name, ...attributes).length > 0;
/** Whether the button with this text is pressed. */
const pressed = (html: string, label: string) => new RegExp(`<button[^>]*aria-pressed="true"[^>]*>${label}</button>`).test(html);
function withSettings(patch: Partial<CommunitySettings>, edit?: (memory: CommunityMemory) => void): CommunityMemory {
  const memory = blankCommunityMemory();
  memory.settings = { ...memory.settings, ...patch };
  edit?.(memory);
  return memory;
}

describe("Community settings (F5)", () => {
  it("has Your profile first, then three sections with What you see open", () => {
    const html = view();
    const text = words(html);
    expect(html).toMatch(/<h2[^>]*data-view-heading[^>]*>Community settings<\/h2>/);
    expect(text).toContain("Only for My community. The settings below save as you go.");
    // Your profile comes first: the picture with Change picture, then the name, town and words on the card,
    // with Your privacy and Blocked under it. The old "How you appear" and "Friends and messages" live there now.
    expect(text.indexOf("Your profile")).toBeLessThan(text.indexOf("Your privacy"));
    expect(text.indexOf("Your privacy")).toBeLessThan(text.indexOf("Blocked"));
    expect(text.indexOf("Blocked")).toBeLessThan(text.indexOf("What you see"));
    for (const gone of ["How you appear", "Friends and messages"]) expect(text).not.toContain(gone);
    const toggles = tagsWith(html, "button", 'class="cm-set-toggle"');
    expect(toggles).toHaveLength(3);
    expect(toggles.filter(tag => tag.includes('aria-expanded="true"'))).toHaveLength(1);
    for (const title of ["What you see", "Reading and listening", "Quiet times"]) expect(text).toContain(title);
    // Each heading controls its own panel; only the open one is shown.
    const panels = toggles.map(tag => tag.match(/aria-controls="([^"]+)"/)?.[1]);
    panels.forEach((id, index) => {
      const panel = tagsWith(html, "div", `id="${id}"`, 'role="region"', 'class="cm-set-panel"');
      expect(panel).toHaveLength(1);
      expect(panel[0].includes("hidden")).toBe(index !== 0);
    });
    expect(tagWith(html, "button", 'class="cm-set-toggle"', 'aria-expanded="true"')).toBe(true);
    // The dots are shown; a screen reader hears commas.
    // The clinician edition starts with no hidden words.
    expect(text).toContain("Gentle mode on · , no hidden words");
    expect(text).toContain("Read aloud off · , normal text");
    expect(text).toContain("Quiet from 9 pm to 8 am");
    expect(tagWith(html, "p", 'class="cm-set-saved-slot"', 'role="status"')).toBe(true);
  });

  it("shows every setting as it is stored: switches, choices, words and quiet time", () => {
    const html = view();
    const switches = tagsWith(html, "button", 'role="switch"');
    expect(switches).toHaveLength(6);
    expect(switches.filter(tag => tag.includes('aria-checked="true"'))).toHaveLength(5);
    for (const label of ["Any verified clinician", "Only connections", "Connections", "Normal", "No break"]) expect(pressed(html, label)).toBe(true);
    for (const label of ["All clinicians", "No one", "Bigger", "1 week"]) expect(pressed(html, label)).toBe(false);
    // No hidden words to begin with: nothing to stop hiding, and the first suggestion to add.
    expect(tagWith(html, "button", "aria-label=\"Stop hiding")).toBe(false);
    expect(words(html)).toContain("Add “sponsored”");
    expect(tagWith(html, "button", 'class="cm-set-add"', 'aria-expanded="false"')).toBe(true);
    expect(tagWith(html, "button", 'aria-label="Earlier start"', 'aria-disabled="false"')).toBe(true);
    expect(tagWith(html, "button", 'aria-label="Later start"', 'aria-disabled="false"')).toBe(true);
    expect(html).toMatch(/<output[^>]*>9 pm<\/output>/);
    expect(words(html)).toContain("The Alerts badge stays quiet from 9 pm to 8 am");
    // Words the person hides are listed, each with a way to stop hiding it.
    state.memory = withSettings({ hiddenWords: ["supplement", "politics"] });
    const hiding = view();
    expect(tagWith(hiding, "button", 'aria-label="Stop hiding supplement"')).toBe(true);
    expect(tagWith(hiding, "button", 'aria-label="Stop hiding politics"')).toBe(true);
    expect(words(hiding)).toContain("Gentle mode on · , 2 hidden words");
    expect(words(hiding)).toContain("Add “sponsored”");
  });

  it("links to the Friends drawer over this page, and to Safety", () => {
    const html = view();
    expect(tagWith(html, "a", 'class="cm-set-link"', 'href="/community?space=settings&amp;panel=friends"')).toBe(true);
    expect(words(html)).toContain("See requests you have sent and received");
    expect(tagWith(html, "a", 'class="cm-card cm-set-safety"', 'href="/community?space=safety"')).toBe(true);
    expect(words(html)).toContain("Safety and blocking Your reports, and the people and posts you've hidden");
  });

  it("puts Your privacy and Blocked under Your profile, with the stored settings and a way to unblock", () => {
    state.memory = withSettings({ messagesFrom: "noOne", postsSeenBy: "everyone", showTown: false });
    const html = view();
    const text = words(html);
    expect(tagWith(html, "section", 'class="cm-card cm-set-privacy"')).toBe(true);
    for (const choice of ["Who sees my posts by default", "Who can message me", "Who can ask to be friends", "Show my town", "Show when I'm online"]) expect(text).toContain(choice);
    expect(pressed(html, "No one")).toBe(true);
    expect(pressed(html, "All clinicians")).toBe(true);
    expect(text).toContain("No one can message you.");
    expect(text).toContain("Every verified clinician on Rehyn Connect sees what you share.");
    expect(text).toContain("Any verified clinician can ask to connect.");
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"/);
    // Blocked: Gary, from the start, with Unblock (which asks once more before it happens).
    expect(tagWith(html, "section", 'class="cm-card cm-set-blocked"')).toBe(true);
    expect(text).toContain("Blocked 1 blocked");
    expect(text).toContain("Gary Blocked 3 days ago");
    expect(tagWith(html, "button", 'class="cm-set-small"', 'data-set-focus="unblock-gary"', 'aria-expanded="false"')).toBe(true);
    expect(text).toContain("People you block are never told. You can unblock them at any time.");
    // Gary unblocked on an earlier visit (a block of 0 is one taken off): nobody is listed.
    state.memory = withSettings({}, memory => { memory.blocks = { gary: 0 }; });
    expect(words(view())).toContain("Blocked 0 blocked You haven't blocked anyone.");
  });

  it("keeps the words true to what happens on this device", () => {
    const text = words(view());
    expect(text).not.toContain("Bristol");
    expect(text).toContain("Add your town in Your profile, above.");
    expect(text).toContain("Your device's own voice reads them.");
    expect(text).not.toMatch(/Alira reads|her voice/);
    expect(text).toContain("During a break, the Alerts badge stays quiet. Nothing is deleted.");
    expect(text).not.toMatch(/friends will see|will be told|notified|Taking a break/i);
    expect(text).toContain("How others would see you");
    expect(text).toContain("What other members would see when they tap your name. Only friends could message you.");
  });
});

describe("links that name a setting", () => {
  /** The title of the one section that is open. */
  const openSection = (html: string) => {
    const open: string[] = html.match(/<button[^>]*class="cm-set-toggle"[^>]*aria-expanded="true"[^>]*>[\s\S]*?class="cm-set-toggle-title"[^>]*>([^<]+)</g) ?? [];
    expect(open).toHaveLength(1);
    return open[0]?.match(/>([^<>]+)<$/)?.[1];
  };

  it("opens at the section the address names", () => {
    expect(openSection(at("see"))).toBe("What you see");
    expect(openSection(at("read"))).toBe("Reading and listening");
    expect(openSection(at("quiet"))).toBe("Quiet times");
    // Your profile is always open at the top; a link to it (by its name, or the old "appear" and
    // "friends") leaves the first panel open under it. An unknown section, or none, does the same.
    for (const section of ["profile", "appear", "friends", "secrets"]) {
      const html = at(section);
      expect(openSection(html)).toBe("What you see");
      expect(tagWith(html, "div", 'class="cm-set-profile"')).toBe(true);
      expect(tagWith(html, "h3", 'class="cm-pic-profile-title"', 'tabindex="-1"', "data-set-heading")).toBe(true);
    }
    expect(openSection(view())).toBe("What you see");
  });

  it("is no longer a page of My community: its old address shows the feed (Settings opens over it)", () => {
    for (const path of ["/community?space=settings", "/community?space=settings&section=quiet", "/community?section=quiet"]) expect(page(path)).not.toContain("cm-set-page");
  });
});

describe("the live preview of the person's card", () => {
  /** The card itself, without the rest of the page. */
  const cardOf = (html: string) => html.slice(html.indexOf('class="cm-card cm-set-card"'), html.indexOf('class="cm-card cm-set-sample"'));
  /** The demo clinician's portrait (Dr Amara Osei), the face the clinician shows everywhere. */
  const OWN_PORTRAIT = "background-image:url(&quot;/photos/clinicians/amara-osei.jpg&quot;)";

  it("is tagged as the person's card, and what it offers are labels, not buttons", () => {
    const html = view();
    const card = html.slice(html.indexOf('class="cm-card cm-set-card"'), html.indexOf('class="cm-card cm-set-sample"'));
    expect(card).toContain('<span class="cm-set-card-tag">Your card</span>');
    expect(card).not.toMatch(/<(button|a)\b/);
    expect(tagWith(card, "span", 'class="cm-set-pill cm-set-pill-add"')).toBe(true);
  });

  it("starts with the drawn face, the online dot, groups and friends, and the two buttons", () => {
    const html = view();
    const text = words(html);
    expect(text).toContain("Zak");
    expect(text).toContain("In 4 groups · 4 friends");
    expect(html).toContain('<span class="cm-set-pill cm-set-pill-add">Connect</span>');
    expect(text).toContain("Message (connections only)");
    expect(tagWith(html, "span", "cm-set-online")).toBe(true);
    expect(text).toContain("Your drawn face, with a green dot for online.");
    expect(text).toContain("Sample post at this size Hannah Brooks");
  });

  it("shows the town from the profile, only while Show my town is on", () => {
    state.profile = { ...DEFAULT_PROFILE, city: "Leeds" };
    const shown = words(view());
    expect(shown).toContain("Leeds · In 4 groups · 4 friends");
    expect(shown).toContain("Puts “Leeds” under your name on your card");
    state.memory = withSettings({ showTown: false });
    const hidden = words(view());
    expect(hidden).not.toContain("Leeds · In 4 groups");
    expect(hidden).toContain("Hidden from your card while Show my town is off.");
  });

  it("follows who can ask, who can message, the online dot and the picture", () => {
    state.memory = withSettings({ requestsFrom: "noOne", messagesFrom: "friendsAndGroups", showOnline: false, picture: "initial" });
    const html = view();
    const text = words(html);
    expect(text).toContain("Not taking requests");
    expect(text).toContain("No one can send you a connection request. Requests already waiting stay in My Network.");
    expect(text).not.toContain("(connections only)");
    expect(text).not.toContain("Only friends could message you");
    expect(tagWith(html, "span", "cm-set-online")).toBe(false);
    expect(text).toContain("Your initial, Z, on peach.");
    // The card's face is the signed-in clinician's own portrait, whatever picture is chosen (comment 21).
    expect(cardOf(html)).toContain(OWN_PORTRAIT);
    expect(cardOf(html)).not.toContain("cm-face-monogram");
  });

  it("describes the profile photo once there is one, and the initial until then", () => {
    state.memory = withSettings({ picture: "photo" });
    expect(words(view())).toContain("Your initial, Z, with a green dot for online.");
    state.profile = { ...DEFAULT_PROFILE, photo: "data:image/png;base64,iVBORw0KGgo=" };
    const html = view();
    expect(words(html)).toContain("Your photo, with a green dot for online.");
    expect(cardOf(html)).toContain(OWN_PORTRAIT);
  });

  it("describes a portrait, an emblem or an illustrated face the person chose", () => {
    state.memory = withSettings({ picture: "portrait" });
    const portrait = view();
    expect(words(portrait)).toContain("Your portrait, with a green dot for online.");
    expect(cardOf(portrait)).toContain(OWN_PORTRAIT);
    state.memory = withSettings({ picture: "emblem", look: { ...blankCommunityMemory().settings.look, emblem: "tea" } });
    expect(words(view())).toContain("Your emblem: a cup of tea, with a green dot for online.");
    state.memory = withSettings({ picture: "illustrated" });
    expect(words(view())).toContain("Your illustrated picture, with a green dot for online.");
  });

  it("starts with Your profile: the picture, Change picture, and the name, town and words people see", () => {
    state.profile = { ...DEFAULT_PROFILE, city: "Leeds" };
    state.memory = withSettings({ about: "Gardener and proud grandad." });
    const html = view();
    const text = words(html);
    expect(tagWith(html, "section", 'class="cm-card cm-pic-profile"')).toBe(true);
    expect(tagWith(html, "button", 'class="cm-btn cm-btn-green cm-pic-change"', 'aria-haspopup="dialog"')).toBe(true);
    expect(text).toContain("Change picture");
    expect(text).toContain("Your drawn face.");
    expect(tagWith(html, "input", 'value="Zak"', 'autoComplete="nickname"')).toBe(true);
    expect(tagWith(html, "input", 'value="Leeds"', 'autoComplete="address-level2"')).toBe(true);
    expect(html).toMatch(/<textarea[^>]*maxLength="160"[^>]*>Gardener and proud grandad\.<\/textarea>/);
    expect(text).toContain("The name you go by. Alira uses it too.");
    expect(text).toContain("Cancel Save changes");
    // The card shows the words, as others would see them.
    expect(text).toContain("Leeds · In 4 groups · 4 friends “Gardener and proud grandad.”");
  });

  it("counts friends and groups as they change", () => {
    state.memory = withSettings({}, memory => { memory.answers = { ruth: "accepted" }; memory.joined = ["knit"]; });
    expect(words(view())).toContain("In 5 groups · 5 friends");
  });

  it("takes the sample post from someone the person still sees", () => {
    state.memory = withSettings({}, memory => { memory.blocks = { hannah: NOW }; });
    const text = words(view());
    expect(text).toContain("Sample post at this size Ruth Calloway");
    expect(text).not.toContain("Sample post at this size Hannah Brooks");
  });
});

describe("the other settings as they are stored", () => {
  it("presses the chosen text size", () => {
    state.memory = withSettings({ textSize: "bigger", readAloud: true });
    const html = view();
    expect(pressed(html, "Bigger")).toBe(true);
    expect(words(html)).toContain("Read aloud on · , bigger text");
  });

  it("stops quiet time at 11 pm and at 7 pm", () => {
    state.memory = withSettings({ quietFrom: 23 });
    const late = view();
    expect(late).toMatch(/<output[^>]*>11 pm<\/output>/);
    expect(tagWith(late, "button", 'aria-label="Later start"', 'aria-disabled="true"')).toBe(true);
    expect(tagWith(late, "button", 'aria-label="Earlier start"', 'aria-disabled="false"')).toBe(true);
    expect(words(late)).toContain("The Alerts badge stays quiet from 11 pm to 8 am");
    state.memory = withSettings({ quietFrom: 19 });
    expect(tagWith(view(), "button", 'aria-label="Earlier start"', 'aria-disabled="true"')).toBe(true);
  });

  it("shows a break while it lasts, and no break once it has ended", () => {
    state.memory = withSettings({ breakChoice: "week", breakUntil: NOW + 7 * DAY });
    const on = view();
    expect(pressed(on, "1 week")).toBe(true);
    expect(words(on)).toContain("The Alerts badge stays quiet until Tuesday 13 October. Nothing is deleted.");
    expect(words(on)).toContain("on a break until 13 October");
    state.memory = withSettings({ breakChoice: "day", breakUntil: NOW - 1000 });
    expect(pressed(view(), "No break")).toBe(true);
  });

  it("offers the next suggested word once one is hidden, and stops adding at 20 words", () => {
    state.memory = withSettings({ hiddenWords: ["sponsored"] });
    expect(words(view())).toContain("Add “supplement”");
    state.memory = withSettings({ hiddenWords: Array.from({ length: 20 }, (_, index) => `word${index}`) });
    const full = view();
    expect(tagWith(full, "button", 'class="cm-set-add"')).toBe(false);
    expect(words(full)).toContain("You're hiding 20 words, the most you can. Remove one to add another.");
    state.memory = withSettings({ hiddenWords: [] });
    const none = words(view());
    expect(none).toContain("no hidden words");
    expect(none).toContain("Add “sponsored”");
  });
});
