import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import RecoveryShell from "@/components/RecoveryShell";
import FeedView from "@/components/community/Feed";
import FriendsDrawer from "@/components/community/FriendsDrawer";
import GroupsView from "@/components/community/Groups";
import { BackIcon } from "@/components/community/icons";
import MessagesView from "@/components/community/Messages";
import ProfessionalEventsView from "@/components/community/ProfessionalEvents";
import WeeklySessionsView from "@/components/community/WeeklySessions";
import PostMenu from "@/components/community/PostMenu";
import { useOptionalSettings } from "@/components/AccountSettings";
import SafetyView from "@/components/community/SafetyView";
import StartGroupView from "@/components/community/StartGroup";
import { type FriendsTab } from "@/content/community-samples";
import { useAlertsPanel } from "@/lib/alerts-panel";
import { communityHref, communityViewFromQuery, useCommunity, type CommunitySpace, type SafetyTarget } from "@/lib/community-store";
import { fastCheckPath } from "@/lib/fast-check";
import { useMe } from "@/lib/me";
import { todayLabel } from "./Welcome";
import "./community.css";
import "./community-spaces.css";
import "./community-start.css";
import "./community-friends.css";
import "./community-settings.css";
import "./community-safety.css";
import "./community-alerts.css";
import "./community-messages.css";
import "./community-circle.css";
import "./community-daily.css";
import "./community-picture.css";
import "./community-poker.css";

// Rehyn Connect for clinicians: a feed of other clinicians' posts, with the clinician's group weekly sessions with
// patients, professional groups and messages as tabs in the top bar; My Network and My professional events are rows
// in the profile panel on the left. A little Messages window waits at the bottom right of every page (the shell draws
// it). It is a preview: the people in it are example clinicians, and nothing leaves the device.
// The address says which view is open, so every button that opens a page is a link and Back works:
//   /community                           the feed
//   /community?space=circle              group weekly sessions (the clinician's Q&A sessions with patients)
//   /community?space=events              my professional events (peer events with other clinicians)
//   /community?space=lounge, =poker      retired: they open the feed (the lounge is gone for both editions)
//   /community?space=groups&group=walk   my groups, with one open
//   /community?space=messages&chat=grace  messages, with a conversation open
//   /community?space=start               start a group
//   /community?space=settings            retired: it opens Settings → Your profile over the feed (&section= names a part)
//   /community?space=friends             retired: the same
//   /community?space=safety              safety: reports, blocked and hidden people
//   ...&panel=friends&tab=sent           the Friends drawer, open over any of these
// Alerts and the hide, block or report sheet (a post's ··· button) open on the page itself.
/** The spaces that use the full width, without the profile panel on the left (review comments C77, C80). */
const NO_PANEL = new Set<CommunitySpace>(["groups", "messages", "start"]);

export default function Community() {
  const search = useSearch();
  const [location, navigate] = useLocation();
  const openSettings = useOptionalSettings();
  const asked = communityViewFromQuery(search);
  // Community settings (and the retired Friends page) live in Settings → Your profile now (review):
  // their addresses open that window over the feed, at the section named (`&section=quiet`), and a
  // `panel=friends` address keeps its drawer instead.
  const toSettings = asked.space === "settings" || asked.space === "friends";
  const view = toSettings ? { ...asked, space: "feed" as const } : asked;
  useEffect(() => {
    if (!toSettings) return;
    navigate(communityHref("feed", null, { panel: asked.panel ?? null, tab: asked.tab ?? null }), { replace: true });
    if (!asked.panel) openSettings?.(null, "profile", asked.section ?? undefined);
  }, [toSettings, asked.panel, asked.tab, asked.section, navigate, openSettings]);
  // The signed-in clinician, the same everywhere (comment 21).
  const name = useMe().name;
  const memory = useCommunity();
  // A space stays as it was left once it has been opened in this visit.
  const [visited, setVisited] = useState<CommunitySpace[]>(() => [view.space]);
  // Alerts opens from the profile panel's row; the shell draws the panel (lib/alerts-panel.ts).
  const alertsOpen = useAlertsPanel().open;
  const [menu, setMenu] = useState<{ target: SafetyTarget; opener: HTMLElement; startAt?: "block" } | null>(null);
  const page = useRef<HTMLDivElement>(null);
  const firstView = useRef(true);
  const lastSpace = useRef(view.space);
  const viewNow = useRef(view);
  viewNow.current = view;
  const friendsOpen = view.panel === "friends";
  const overlayOpen = friendsOpen || alertsOpen || menu !== null;
  const overlayWasOpen = useRef(overlayOpen);
  // Whether the drawer was opened during this visit, so closing it can step Back rather than add a page.
  const friendsOpenedHere = useRef(false);
  const lastPanel = useRef(view.panel);
  const isOpen = (space: CommunitySpace) => space === view.space || visited.includes(space);

  useEffect(() => { setVisited(list => (list.includes(view.space) ? list : [...list, view.space])); }, [view.space]);

  // Each new space starts at the top of the page; another group or conversation brings its chat into
  // view. If what was pressed has gone from sight (or was in a drawer or panel that has closed), the
  // focus moves to the new view's heading, so a keyboard or screen reader carries on from there.
  useEffect(() => {
    if (firstView.current) { firstView.current = false; return; }
    const root = page.current;
    if (!root) return;
    if (lastSpace.current !== view.space) window.scrollTo({ top: 0, behavior: "instant" });
    else {
      const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      root.querySelector<HTMLElement>(`[data-space="${view.space}"] :is(.cm-chat, .cm-dm)`)?.scrollIntoView({ block: "nearest", behavior: still ? "instant" : "smooth" });
    }
    lastSpace.current = view.space;
    const focused = document.activeElement as HTMLElement | null;
    // On a phone, the conversation list hides once a conversation opens: what was pressed is out of sight.
    if (overlayWasOpen.current || !focused || focused === document.body || !root.contains(focused) || focused.closest("[hidden]") || !focused.getClientRects().length) {
      const heading = root.querySelector<HTMLElement>(`[data-space="${view.space}"] [data-view-heading]`) ?? root.querySelector<HTMLElement>("[data-page-heading]");
      heading?.focus({ preventScroll: true });
    }
  }, [view.space, view.group, view.chat]);

  // After the effect above, so it can tell that a drawer or panel was open before this change.
  useEffect(() => { overlayWasOpen.current = overlayOpen; });

  useEffect(() => {
    if (view.panel === "friends" && lastPanel.current !== "friends") friendsOpenedHere.current = true;
    if (view.panel !== "friends") friendsOpenedHere.current = false;
    lastPanel.current = view.panel;
  }, [view.panel]);

  // A new address (a link, or the browser's Back button) closes the panels and the sheets.
  useEffect(() => { setMenu(null); }, [search]);

  /** The heading of the view showing now: where the focus goes when what opened a dialog has gone. */
  const headingNow = useCallback(() => {
    const root = page.current;
    return root?.querySelector<HTMLElement>(`[data-space="${viewNow.current.space}"] [data-view-heading]`) ?? root?.querySelector<HTMLElement>("[data-page-heading]") ?? null;
  }, []);
  // The Friends row is in the profile panel (outside the page); on a phone it is in the closed drawer, so the heading instead.
  const friendsButton = useCallback(() => {
    const row = document.querySelector<HTMLElement>('#site-panel:not([inert]) [href="/community?panel=friends"]');
    return row && row.getClientRects().length ? row : headingNow();
  }, [headingNow]);

  const closeFriends = useCallback(() => {
    const current = viewNow.current;
    if (friendsOpenedHere.current && window.history.length > 1) window.history.back();
    else navigate(communityHref(current.space, current.group), { replace: true });
  }, [navigate]);
  const showTab = useCallback((tab: FriendsTab) => {
    const current = viewNow.current;
    navigate(communityHref(current.space, current.group, { panel: "friends", tab }), { replace: true });
  }, [navigate]);
  const openMenu = useCallback((target: SafetyTarget, opener: HTMLElement, startAt?: "block") => setMenu({ target, opener, startAt }), []);

  const textSize = memory.settings.textSize === "normal" ? "" : `cm-text-${memory.settings.textSize}`;

  return (
    <RecoveryShell active="My Community" dateLabel={todayLabel()} className="cm-shell" panel={!NO_PANEL.has(view.space)}>
      <div ref={page} className={`recovery-page cm-page cm-view-${view.space} ${textSize}`}>
        {/* The page's name for a screen reader, and where the focus lands when a view has no heading of its own. */}
        <h1 className="cm-sr" tabIndex={-1} data-page-heading>Rehyn Connect for clinicians</h1>

        {isOpen("feed") && <div className="cm-space" data-space="feed" hidden={view.space !== "feed"}><FeedView name={name} onMore={openMenu} openPostId={menu?.target.postId ?? null} /></div>}
        {isOpen("circle") && <div className="cm-space" data-space="circle" hidden={view.space !== "circle"}><WeeklySessionsView active={view.space === "circle"} /></div>}
        {isOpen("events") && <div className="cm-space" data-space="events" hidden={view.space !== "events"}><ProfessionalEventsView /></div>}
        {isOpen("groups") && <div className="cm-space" data-space="groups" hidden={view.space !== "groups"}><GroupsView active={view.space === "groups"} requested={view.group} /></div>}
        {isOpen("messages") && <div className="cm-space" data-space="messages" hidden={view.space !== "messages"}><MessagesView active={view.space === "messages"} chat={view.chat ?? null} onPersonMenu={openMenu} /></div>}
        {isOpen("safety") && <div className="cm-space" data-space="safety" hidden={view.space !== "safety"}><SafetyView name={name} warningSignsHref={fastCheckPath(location, search)} onPersonMenu={openMenu} /></div>}
        {isOpen("start") && (
          <div className="cm-space" data-space="start" hidden={view.space !== "start"}>
            <header className="cm-start-head">
              <Link className="cm-back" href={communityHref("groups")}><BackIcon size={18} /><span>Groups by condition</span></Link>
              <h1 className="cm-title" tabIndex={-1} data-view-heading>Start a group</h1>
              <p className="cm-start-intro">A professional group inside a condition network: private unless you choose otherwise, with a group chat for case discussion and shared resources.</p>
            </header>
            <StartGroupView name={name} />
          </div>
        )}
      </div>

      {/* Drawers, sheets and panels sit outside the page, over everything. The newest one is on top. */}
      <div className={`cm-layer ${textSize}`}>
        {friendsOpen && <FriendsDrawer tab={view.tab ?? "requests"} onTab={showTab} onClose={closeFriends} onPersonMenu={openMenu} fallbackFocus={friendsButton} name={name} />}
        {menu && <PostMenu target={menu.target} name={name} onClose={() => setMenu(null)} returnFocus={menu.opener} fallbackFocus={headingNow} startAt={menu.startAt} />}
      </div>
    </RecoveryShell>
  );
}
