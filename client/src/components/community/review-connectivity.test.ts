import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Link, Router } from "wouter";
import { SettingsContext } from "@/components/settings-context";
import { communityAlerts, FRIENDS_TABS, type FriendsTab } from "@/content/community-samples";
import { blankCommunityMemory, communityHref, communityViewFromQuery, defaultCommunitySettings, viewHref, type CommunityMemory, type CommunityPlace, type SafetyTarget } from "@/lib/community-store";
import { fastCheckReturnPath } from "@/lib/fast-check";
import { DEMO_CLINICIAN_ID } from "@/lib/me";
import SiteTabs from "@/components/SiteTabs";
import Community from "@/pages/Community";
import ProfilePanel from "@/components/ProfilePanel";
import AlertsPanel from "./AlertsPanel";
import FeedView from "./Feed";
import FriendsDrawer from "./FriendsDrawer";
import { friendsVisit } from "./friends-visit";
import { myGroups } from "./group-model";
import { chatById } from "./messages-model";
import { hostedSessions } from "./weekly-sessions-model";
import { SafetySheetSteps, type SheetStep } from "./PostMenu";
import { SafetyPage } from "./SafetyView";
import SettingsView from "./SettingsView";

// Connectivity review: every button in My community has something to do, and every link lands on
// a real page of the app, at the view it means. The JSX runtime is wrapped so each element our
// components create is recorded with its props (the handlers are not in the rendered markup).

type Seen = { type: unknown; props: Record<string, unknown> };
const held = vi.hoisted(() => ({ memory: null as CommunityMemory | null, seen: [] as { type: unknown; props: Record<string, unknown> }[] }));

vi.mock("@/components/RecoveryShell", () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock("@/lib/community-store", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/community-store")>();
  return { ...actual, useCommunity: () => held.memory ?? actual.blankCommunityMemory() };
});
vi.mock("react/jsx-dev-runtime", async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  const jsxDEV = actual.jsxDEV as (type: unknown, props: Record<string, unknown>, ...rest: unknown[]) => unknown;
  return { ...actual, jsxDEV: (type: unknown, props: Record<string, unknown>, ...rest: unknown[]) => { held.seen.push({ type, props }); return jsxDEV(type, props, ...rest); } };
});
vi.mock("react/jsx-runtime", async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  const wrap = (make: unknown) => (type: unknown, props: Record<string, unknown>, ...rest: unknown[]) => { held.seen.push({ type, props }); return (make as (...args: unknown[]) => unknown)(type, props, ...rest); };
  return { ...actual, jsx: wrap(actual.jsx), jsxs: wrap(actual.jsxs) };
});

// Midday, so quiet time (9 pm to 8 am) is not on.
beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 9, 6, 12, 0)); });
afterAll(() => { vi.useRealTimers(); });
beforeEach(() => { held.memory = blankCommunityMemory(); friendsVisit.clear(); });

const memory = (change: Partial<CommunityMemory>): CommunityMemory => ({ ...blankCommunityMemory(), ...change });
const FEED: CommunityPlace = { space: "feed", group: null };
const noop = () => {};

/** Renders at an address and returns the markup and every element created on the way. */
function draw(element: ReactElement, path: string) {
  held.seen = [];
  const html = renderToStaticMarkup(createElement(Router, { ssrPath: path, children: element })).replace(/ data-loc="[^"]*"/g, "");
  const seen: Seen[] = held.seen;
  return {
    html,
    buttons: seen.filter(item => item.type === "button"),
    links: seen.filter(item => item.type === Link),
    anchors: seen.filter(item => item.type === "a"),
    /** Anything else that answers a click (a scrim is fine; a clickable div or span is not). */
    clickables: seen.filter(item => typeof item.type === "string" && item.type !== "button" && item.type !== "a" && typeof item.props.onClick === "function" && item.props.className !== "cm-scrim"),
  };
}

/** The words on a control, for messages: its label, or the text inside it. */
function labelOf(props: Record<string, unknown>): string {
  if (typeof props["aria-label"] === "string") return props["aria-label"];
  const text = (node: unknown): string => {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(text).join("");
    if (node && typeof node === "object" && "props" in node) return text((node as { props: { children?: unknown } }).props.children);
    return "";
  };
  return text(props.children).trim() || String(props.className ?? "?");
}

const hrefOf = (link: Seen) => String(link.props.href ?? link.props.to ?? "");
/** The settings section a community address names (`?space=settings&section=quiet`), as Settings → Your profile receives it. */
const sectionOf = (href: string) => communityViewFromQuery(href.split("?")[1] ?? "").section ?? null;
const APP_PATHS = ["/", "/fast-check", "/library", "/community", "/care-team", "/clinicians"];
/** Routes with pages nested under them (the Library's sections and conditions, the Clinicians tab's pages). */
const NESTED = ["/library/", "/clinicians/"];

/** The sittings Group weekly sessions can open for the signed-in (demo) clinician, coming up or finished this week. */
function hostedSessionIds(): string[] {
  const { coming, finished } = hostedSessions([], DEMO_CLINICIAN_ID, Date.now());
  return [...coming, ...finished].map(session => session.id);
}

/** Why a link would not land where it says, or null when it does. */
function problemWith(given: string, groups: string[]): string | null {
  // "~/library" is wouter's way of saying the app's own /library from inside a nested route.
  const href = given.replace(/^~(?=\/)/, "");
  if (!href || href.startsWith("#")) return `"${href}" goes nowhere`;
  if (/\.dc\.html|_blob|javascript:/i.test(href)) return `"${href}" is left over from the mockup`;
  const url = new URL(href, "https://rehyn.test");
  if (url.origin !== "https://rehyn.test") return `"${href}" leaves the app`;
  if (!APP_PATHS.includes(url.pathname) && !NESTED.some(base => url.pathname.startsWith(base))) return `"${href}" is not a route in App.tsx`;
  if (url.pathname === "/community") {
    const view = communityViewFromQuery(url.search);
    // Group weekly sessions (the circle's address) reads `&session=<id>` itself to open one sitting
    // (WeeklySessions.tsx), so that part is the view's, as long as it names a session the clinician hosts.
    const session = view.space === "circle" ? url.searchParams.get("session") : null;
    if (session !== null && !hostedSessionIds().includes(session)) return `"${href}" names a session that isn't there`;
    const again = session !== null ? `${viewHref(view)}&session=${encodeURIComponent(session)}` : viewHref(view);
    if (again !== href) return `"${href}" has parts the community ignores (it opens ${again})`;
    if (view.space === "groups" && view.group && !groups.includes(view.group)) return `"${href}" names a group that isn't there`;
    if (view.space === "messages" && view.chat && !chatById(held.memory ?? blankCommunityMemory(), view.chat)) return `"${href}" names a conversation that isn't there`;
  }
  if (url.pathname === "/fast-check" && !url.searchParams.get("returnTo")) return `"${href}" has no way back`;
  return null;
}

/** Every dead button and every link that lands nowhere, in what was drawn. */
function deadEnds(drawn: ReturnType<typeof draw>) {
  const groups = myGroups(held.memory ?? blankCommunityMemory()).map(group => group.id);
  return [
    ...drawn.buttons.filter(item => typeof item.props.onClick !== "function" && item.props.type !== "submit").map(item => `button "${labelOf(item.props)}" does nothing`),
    ...drawn.links.flatMap(item => { const why = problemWith(hrefOf(item), groups); return why ? [`link "${labelOf(item.props)}": ${why}`] : []; }),
    ...drawn.anchors.map(item => `raw <a> "${labelOf(item.props)}" (href ${String(item.props.href)})`),
    ...drawn.clickables.map(item => `clickable <${String(item.type)}> "${labelOf(item.props)}"`),
  ];
}

/* ------------------------------------------------------------- the sweep */

// The lounge and poker night are gone (their addresses open the feed); Group weekly sessions sits at the circle's address.
const SPACES = [
  "/community", "/community?space=circle", "/community?space=circle&session=stroke-prevention-qa-20261008", "/community?space=events",
  "/community?space=groups", "/community?space=groups&group=walk",
  "/community?space=messages", "/community?space=messages&chat=kwame", "/community?space=messages&chat=garden",
  "/community?space=start", "/community?space=settings", "/community?space=safety",
];

describe("every control in My community leads somewhere", () => {
  it("on every view, with the toolbar and the Friends drawer at every tab", () => {
    const found: string[] = [];
    let checked = 0;
    const sweep = (path: string) => {
      const drawn = draw(createElement(Community), path);
      checked += drawn.buttons.length + drawn.links.length;
      found.push(...deadEnds(drawn).map(problem => `${path}: ${problem}`));
    };
    for (const path of SPACES) {
      sweep(path);
      if (path.endsWith("start")) continue;
      for (const tab of FRIENDS_TABS) sweep(`${path}${path.includes("?") ? "&" : "?"}panel=friends${tab === "requests" ? "" : `&tab=${tab}`}`);
    }
    expect(found).toEqual([]);
    // The sweep really saw the controls (the JSX runtime is wrapped), so an empty list means something.
    expect(checked).toBeGreaterThan(1000);
  });

  it("in the drawer's changed rows: answered, cancelled, unblocked, a friend blocked, requests off", () => {
    held.memory = memory({ answers: { ruth: "accepted", michael: "declined" }, cancelled: ["tomas"], blocks: { gary: 0, kwame: Date.now() }, waves: ["ruth"], settings: { ...defaultCommunitySettings(), requestsFrom: "noOne" } });
    friendsVisit.answered("ruth");
    friendsVisit.answered("michael");
    friendsVisit.cancelled("tomas", Date.now() - 2 * 86_400_000);
    friendsVisit.unblocked("gary", Date.now() - 3 * 86_400_000);
    const found: string[] = [];
    for (const tab of FRIENDS_TABS) found.push(...deadEnds(draw(createElement(Community), `/community?panel=friends&tab=${tab}`)));
    expect(found).toEqual([]);
  });

  it("in Alerts, the profile panel and every step of the hide, block or report sheet", () => {
    const found: string[] = [];
    found.push(...deadEnds(draw(createElement(AlertsPanel, { onClose: noop, anchor: null, over: FEED, fallbackFocus: () => null }), "/community")));
    // The profile panel's buttons (Alerts, Saved): its links lead into the Library's nested routes, which this
    // sweep does not know, so recovery-shell.test.ts checks those.
    const panel = draw(createElement(SettingsContext.Provider, { value: noop, children: createElement(ProfilePanel) }), "/community");
    found.push(...deadEnds({ ...panel, links: [] }).map(problem => `panel: ${problem}`));
    const steps: SheetStep[] = ["menu", "reason", "details", "sent", "block", "blocked", "muted"];
    for (const target of [{ who: "hannah", postId: "p-hannah" }, { who: "gary", postId: null }] as SafetyTarget[]) {
      for (const step of steps) {
        found.push(...deadEnds(draw(createElement(SafetySheetSteps, { target, name: "Zak", titleId: "t", onClose: noop, start: { step, reason: "money", outcome: { blocked: true, postHidden: true }, blockedHere: true } }), "/community")).map(problem => `sheet ${target.who} ${step}: ${problem}`));
      }
    }
    expect(found).toEqual([]);
  });

  it("on the Safety page with reports, hidden people and posts, and on Settings with its profile buttons", () => {
    held.memory = memory({
      reports: [{ id: "report-a", who: "gary", postId: "p-gary", reason: "health", note: "Same message to me.", alsoBlock: true, createdAt: Date.now() }],
      muted: { grace: Date.now() }, hiddenPosts: { "p-tomas": Date.now() },
      settings: { ...defaultCommunitySettings(), picture: "photo", requestsFrom: "noOne" },
    });
    const found = deadEnds(draw(createElement(SafetyPage, { memory: held.memory, name: "Zak", warningSignsHref: "/fast-check?returnTo=%2F", onPersonMenu: noop }), "/community?space=safety"));
    const inApp = createElement(SettingsContext.Provider, { value: noop, children: createElement(SettingsView, { name: "Zak" }) });
    found.push(...deadEnds(draw(inApp, "/community?space=settings")));
    expect(found).toEqual([]);
  });
});

/* ------------------------------------------------------- where each goes */

describe("the profile panel's rows and the overlays are wired to the right place", () => {
  it("the page has no toolbar any more, and the profile panel has My Network, My professional events and My consultations, with no Alerts, Saved or Game (comments 1 to 7)", () => {
    for (const path of ["/community", "/community?space=events", "/community?space=settings", "/community?space=safety"]) {
      const { buttons, links } = draw(createElement(Community), path);
      expect([...buttons, ...links].filter(item => item.props["data-cm-tool"] !== undefined)).toEqual([]);
    }
    const { buttons, links, html } = draw(createElement(SettingsContext.Provider, { value: noop, children: createElement(ProfilePanel) }), "/community");
    expect([...buttons, ...links].filter(item => item.props["data-cm-tool"] !== undefined)).toEqual([]);
    const text = html.replace(/<[^>]+>/g, " ");
    for (const row of ["My Network", "My professional events", "My consultations"]) expect(text).toContain(row);
    for (const gone of ["Alerts", "Saved", "Game"]) expect(text).not.toMatch(new RegExp(`\\b${gone}\\b`));
    expect(links.map(hrefOf)).toEqual(expect.arrayContaining(["~/community?panel=friends", "~/community?space=events", "~/clinicians/portal/consultations"]));
    expect(html).not.toContain("site-foot");
  });

  it("each alert is a link that closes the panel on its way", () => {
    const onClose = vi.fn();
    const { links } = draw(createElement(AlertsPanel, { onClose, anchor: null, over: FEED, fallbackFocus: () => null }), "/community");
    const rows = links.filter(item => String(item.props.className).includes("cm-al-row"));
    expect(rows.map(hrefOf)).toEqual(["/community?space=circle", "/community?panel=friends", "/community?space=groups&group=garden", "/community?panel=friends"]);
    expect(rows).toHaveLength(communityAlerts.length);
    for (const link of [...rows, ...links.filter(item => String(item.props.className).includes("cm-al-foot"))]) {
      expect(link.props.onClick).toBe(onClose);
    }
  });

  it("the drawer's tabs, Close and a friend's ··· call back to Community", () => {
    const onTab = vi.fn();
    const onClose = vi.fn();
    const onPersonMenu = vi.fn();
    const props = { onTab, onClose, onPersonMenu, fallbackFocus: () => null, name: "Zak" };
    const { buttons } = draw(createElement(FriendsDrawer, { ...props, tab: "friends" as FriendsTab }), "/community?panel=friends&tab=friends");
    for (const tab of buttons.filter(item => item.props.role === "tab")) (tab.props.onClick as () => void)();
    expect(onTab.mock.calls.map(call => call[0])).toEqual(["requests", "sent", "blocked"]);
    (buttons.find(item => item.props["aria-label"] === "Close")!.props.onClick as () => void)();
    expect(onClose).toHaveBeenCalledTimes(1);
    const opener = { tagName: "BUTTON" };
    (buttons.find(item => item.props["aria-label"] === "More options for Hannah Brooks")!.props.onClick as (event: unknown) => void)({ currentTarget: opener });
    expect(onPersonMenu).toHaveBeenCalledWith({ who: "hannah", postId: null }, opener);
  });

  it("a post's ··· opens the sheet about that post, and the Safety page's ··· about that person or post", () => {
    const onMore = vi.fn();
    const feed = draw(createElement(FeedView, { name: "Zak", here: 14, onMore }), "/community");
    const more = feed.buttons.filter(item => String(item.props.className) === "cm-more");
    expect(more.length).toBeGreaterThan(3);
    for (const button of more) (button.props.onClick as (event: unknown) => void)({ currentTarget: null });
    expect(onMore.mock.calls.map(call => call[0].postId)).toEqual(more.map((_, index) => onMore.mock.calls[index][0].postId));
    expect(onMore.mock.calls.every(call => typeof call[0].postId === "string")).toBe(true);
    expect(onMore.mock.calls.map(call => call[0].who)).toContain("hannah");

    const onPersonMenu = vi.fn();
    held.memory = memory({ muted: { grace: Date.now() }, hiddenPosts: { "p-tomas": Date.now() } });
    const page = draw(createElement(SafetyPage, { memory: held.memory, name: "Zak", warningSignsHref: "/fast-check?returnTo=%2F", onPersonMenu }), "/community?space=safety");
    for (const button of page.buttons.filter(item => String(item.props.className) === "cm-more")) (button.props.onClick as (event: unknown) => void)({ currentTarget: null });
    expect(onPersonMenu.mock.calls.map(call => call[0])).toEqual([{ who: "grace", postId: null }, { who: "tomas", postId: "p-tomas" }]);
  });

  it("the sheet's last step: Back to the feed closes it, See my reports closes it as it goes", () => {
    const onClose = vi.fn();
    const drawn = draw(createElement(SafetySheetSteps, { target: { who: "hannah", postId: "p-hannah" }, name: "Zak", titleId: "t", onClose, start: { step: "sent", reason: "money", outcome: { blocked: true, postHidden: false } } }), "/community");
    expect(drawn.links.map(item => [hrefOf(item), item.props.onClick === onClose])).toEqual([["/community?space=safety", true]]);
    expect(drawn.buttons.find(item => labelOf(item.props) === "Back to the feed")?.props.onClick).toBe(onClose);
  });
});

/* ------------------------------------------- problems this review found, now fixed */

describe("problems found in review stay fixed", () => {
  it("Warning signs on the Safety page comes back to Safety, not Home", () => {
    const { links } = draw(createElement(Community), "/community?space=safety");
    const warning = links.find(item => hrefOf(item).startsWith("/fast-check"))!;
    expect(fastCheckReturnPath(hrefOf(warning).split("?")[1])).toBe("/community?space=safety");
  });

  it("Alerts' 'Quiet time … Change' opens Settings with Quiet times open", () => {
    const { links } = draw(createElement(AlertsPanel, { onClose: noop, anchor: null, over: FEED, fallbackFocus: () => null }), "/community");
    const change = hrefOf(links.find(item => String(item.props.className).includes("cm-al-foot"))!);
    const { html } = draw(createElement(SettingsView, { name: "Zak", section: sectionOf(change) }), "/community");
    // The quiet-time stepper sits in the panel that is open, not in a hidden one.
    expect(html).toMatch(/<div class="cm-set-panel" id="[^"]+" role="region" aria-labelledby="[^"]+">(?:(?!<div class="cm-set-panel")[\s\S])*Earlier start/);
  });

  it("every link about one setting opens Community settings at that setting's section", () => {
    const openSection = (html: string) => html.match(/<button[^>]*class="cm-set-toggle"[^>]*aria-expanded="true"[^>]*>[\s\S]*?class="cm-set-toggle-title"[^>]*>([^<]+)</)?.[1];
    // No clinician's post is one gentle mode covers, so the feed has no "Gentle mode settings" link; a hidden word
    // that a post mentions brings up "Change your hidden words".
    expect(draw(createElement(FeedView, { name: "Zak", here: 14, onMore: noop }), "/community").links.find(item => labelOf(item.props) === "Gentle mode settings")).toBeUndefined();
    held.memory = memory({ settings: { ...defaultCommunitySettings(), hiddenWords: ["anticoagulation"] } });
    const feed = draw(createElement(FeedView, { name: "Zak", here: 14, onMore: noop }), "/community");
    held.memory = blankCommunityMemory();
    const words = feed.links.find(item => labelOf(item.props) === "Change your hidden words")!;
    const drawer = draw(createElement(Community), "/community?panel=friends").links.find(item => String(item.props.className).includes("cm-fr-foot"))!;
    const safety = draw(createElement(Community), "/community?space=safety").links.find(item => String(item.props.className).includes("cm-sa-settings"))!;
    const alerts = draw(createElement(AlertsPanel, { onClose: noop, anchor: null, over: FEED, fallbackFocus: () => null }), "/community").links.find(item => String(item.props.className).includes("cm-al-foot"))!;
    // Each address names a section; My community opens Settings → Your profile at it (the settings draw as there).
    const opens = [words, safety, alerts].map(link => openSection(draw(createElement(SettingsView, { name: "Zak", section: sectionOf(hrefOf(link)) }), "/community").html));
    expect(opens).toEqual(["What you see", "What you see", "Quiet times"]);
    // The drawer's "Who can send you requests: Change" leads to Your profile, where Your privacy holds the choice.
    expect(hrefOf(drawer)).toBe("/community?space=settings&section=profile");
    expect(draw(createElement(SettingsView, { name: "Zak", section: sectionOf(hrefOf(drawer)) }), "/community").html).toContain("Who can ask to be friends");
    // The old plain settings address opens at the top section.
    expect(openSection(draw(createElement(SettingsView, { name: "Zak", section: sectionOf("/community?space=settings") }), "/community").html)).toBe("What you see");
  });

  it("an alert about a request already answered on an earlier visit leads to that person", () => {
    held.memory = memory({ answers: { ruth: "accepted" } });
    const { links } = draw(createElement(AlertsPanel, { onClose: noop, anchor: null, over: FEED, fallbackFocus: () => null }), "/community");
    const ruth = hrefOf(links.find(item => String(item.props["aria-label"]).startsWith("Ruth Calloway wants to connect"))!);
    // A new visit: nothing answered in the drawer yet. The tab the alert opens should show Ruth among the connections,
    // not "All caught up" with her named only in someone else's mutual connections.
    expect(ruth).toBe("/community?panel=friends&tab=friends");
    const { html } = draw(createElement(Community), ruth);
    const drawer = html.slice(html.indexOf('role="dialog"')).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(drawer).toContain("Ruth Calloway Specialist cardiac rehabilitation nurse New connection");
  });

  it("an alert about a request declined on an earlier visit leads to the 'not now', with its Undo", () => {
    held.memory = memory({ answers: { michael: "declined" } });
    const { links } = draw(createElement(AlertsPanel, { onClose: noop, anchor: null, over: FEED, fallbackFocus: () => null }), "/community");
    const michael = hrefOf(links.find(item => String(item.props["aria-label"]).startsWith("Michael Chau wants to connect"))!);
    expect(michael).toBe("/community?panel=friends");
    const { html } = draw(createElement(Community), michael);
    const drawer = html.slice(html.indexOf('role="dialog"'));
    expect(drawer).toContain("You chose not now for Dr Michael Chau.");
    expect(drawer).toContain("show Dr Michael Chau&#x27;s request again");
  });

  it("a link to the view already showing replaces the address, so Back isn't given the same page twice", () => {
    const replaces = (links: Seen[], href: string) => links.filter(item => hrefOf(item) === href).map(item => item.props.replace === true);
    // On the page itself nothing links to the Safety page any more (the toolbar is gone); the profile panel's
    // My Network row opens the drawer over the feed, as a new address.
    const safety = draw(createElement(Community), "/community?space=safety").links;
    expect(replaces(safety, "/community?space=safety")).not.toContain(false);
    const panel = draw(createElement(SettingsContext.Provider, { value: noop, children: createElement(ProfilePanel) }), "/community").links;
    expect(replaces(panel, "~/community?panel=friends")).toEqual([false]);
    // The spaces' tabs are at the top of every page (SiteTabs); their links start with "~". There is no lounge tab.
    const feed = draw(createElement(SiteTabs), "/community").links;
    expect(feed.map(hrefOf)).not.toContain("~/community?space=lounge");
    expect(replaces(feed, "~/community")).toEqual([true]);
    expect(replaces(feed, "~/community?space=circle")).toEqual([false]);
    const sessions = draw(createElement(SiteTabs), "/community?space=circle").links;
    expect(replaces(sessions, "~/community?space=circle")).toEqual([true]);
    expect(replaces(sessions, "~/community")).toEqual([false]);

    // Alerts: the circle alert while on the circle, and Quiet time's Change while on Settings.
    const circle: CommunityPlace = { space: "circle", group: null };
    const onCircle = draw(createElement(AlertsPanel, { onClose: noop, anchor: null, over: circle, fallbackFocus: () => null }), "/community?space=circle").links;
    expect(replaces(onCircle, "/community?space=circle")).toEqual([true]);
    expect(replaces(onCircle, "/community?space=groups&group=garden")).toEqual([false]);
    const settings: CommunityPlace = { space: "settings", group: null };
    const onSettings = draw(createElement(AlertsPanel, { onClose: noop, anchor: null, over: settings, fallbackFocus: () => null }), "/community?space=settings").links;
    expect(replaces(onSettings, "/community?space=settings&section=quiet")).toEqual([true]);

    // "See my reports" from a sheet on the Safety page.
    const sheet = (path: string) => draw(createElement(SafetySheetSteps, { target: { who: "hannah", postId: "p-hannah" }, name: "Zak", titleId: "t", onClose: noop, start: { step: "sent", reason: "money", outcome: { blocked: true, postHidden: false } } }), path).links;
    expect(replaces(sheet("/community?space=safety"), "/community?space=safety")).toEqual([true]);
    expect(replaces(sheet("/community"), "/community?space=safety")).toEqual([false]);
  });
});
