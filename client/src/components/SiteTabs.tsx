import { Link, useLocation, useRouter, useSearch } from "wouter";
import { BookOpen, CalendarClock, Home as HomeIcon, MessageCircle, Stethoscope, UsersRound } from "lucide-react";
import { communityHref, communityViewFromQuery, leadsHere, unreadCount, useCommunity, type CommunitySpace } from "@/lib/community-store";
import { unreadMessages } from "./community/messages-model";

export type SiteTab = "feed" | "library" | "clinicians" | "circle" | "groups" | "messages";
const COMMUNITY_TABS: SiteTab[] = ["feed", "circle", "groups", "messages"];

/** Which top tab an address belongs to, if any: Safety, Settings and the Care team have none. */
export function siteTabFor(pathname: string, search: string): SiteTab | null {
  if (pathname === "/library" || pathname.startsWith("/library/")) return "library";
  if (pathname === "/clinicians" || pathname.startsWith("/clinicians/")) return "clinicians";
  if (pathname !== "/community") return null;
  const space = communityViewFromQuery(search).space;
  if (space === "start") return "groups";
  if (space === "friends") return null;
  return COMMUNITY_TABS.find(tab => tab === space) ?? null;
}

/** The real path, also inside a nested route (the Library's "/" is "/library"). */
export function usePathname(): string {
  const { base } = useRouter();
  const [location] = useLocation();
  if (location.startsWith("~")) return location.slice(1);
  return base && location === "/" ? base : `${base}${location}`;
}

/** A count on a tab. The tab's own words say it too, for a screen reader. */
const Count = ({ count, what }: { count: number; what: string }) =>
  count > 0 ? <span className="site-tab-count"><span aria-hidden="true">{count}</span><span className="cm-sr">{`, ${count} ${what}`}</span></span> : null;

/**
 * The tabs at the top right of every page in Rehyn Connect for clinicians: the Feed (home), the Library, the clinician
 * directory, the clinician's group weekly sessions with patients (comment 13), professional groups and Messages. The
 * lounge has gone for both editions (comment 12), and the patient edition's poker night is not here. The links start
 * with "~" so they lead to the same place from the Library's nested pages; a tab for the view already showing doesn't
 * add it to Back again.
 */
export default function SiteTabs(_: { here?: number }) {
  const search = useSearch();
  const memory = useCommunity();
  const pathname = usePathname();
  const current = siteTabFor(pathname, search);
  const tab = (target: SiteTab, href: string) => ({
    href: `~${href}`,
    replace: pathname === "/community" && target !== "library" && leadsHere(href, search),
    className: `site-tab ${current === target ? "is-active" : ""}`,
    "aria-current": current === target ? ("page" as const) : undefined,
  });
  const space = (target: CommunitySpace & SiteTab) => tab(target, communityHref(target));

  return (
    <nav className="site-tabs" aria-label="Main">
      <Link {...space("feed")}><span className="site-tab-icon"><HomeIcon size={20} /></span><span>Feed</span></Link>
      <Link {...tab("library", "/library")}><span className="site-tab-icon"><BookOpen size={20} /></span><span>Library</span></Link>
      <Link {...tab("clinicians", "/clinicians")}><span className="site-tab-icon"><Stethoscope size={20} /></span><span>Clinicians</span></Link>
      <Link {...space("circle")}><span className="site-tab-icon"><CalendarClock size={20} /></span><span>Sessions</span></Link>
      <Link {...space("groups")}><span className="site-tab-icon"><UsersRound size={20} />{current !== "groups" && <Count count={unreadCount(memory)} what="unread" />}</span><span>Groups</span></Link>
      <Link {...space("messages")}><span className="site-tab-icon"><MessageCircle size={20} /><Count count={unreadMessages(memory)} what="unread" /></span><span>Messages</span></Link>
    </nav>
  );
}
