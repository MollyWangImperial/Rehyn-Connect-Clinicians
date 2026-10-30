import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useSearch } from "wouter";
import { Menu, Settings, X } from "lucide-react";
import { useSettings } from "./AccountSettings";
import AlertsPanel from "./community/AlertsPanel";
import { useMediaQuery } from "./community/hooks";
import MessagesDock from "./community/MessagesDock";
import HeartRateMark from "./HeartRateMark";
import ProfilePanel from "./ProfilePanel";
import SiteTabs, { usePathname } from "./SiteTabs";
import { alertsPanel, useAlertsPanel } from "@/lib/alerts-panel";
import { communityViewFromQuery, placeOf } from "@/lib/community-store";
import { useDisplayPrefs } from "@/lib/display-prefs";
import "./site-shell.css";
import "./site-shell-clinician.css";

type ViewName = "Library" | "Clinicians" | "My Community" | "Care Team";

type RecoveryShellProps = {
  active: ViewName;
  children: ReactNode;
  dateLabel?: string;
  className?: string;
  /** How many are in the lounge now, for its tab (My community keeps it live). */
  loungeHere?: number;
  /** Whether the profile panel is drawn down the left. Some pages use the full width instead. */
  panel?: boolean;
};

/** Below this width the profile panel leaves the page and slides in from the left instead. */
const NARROW = "(max-width: 1179px)";

/**
 * Every page: a top bar with the logo on the left and the tabs and Settings on the right; your
 * profile panel down the left (ProfilePanel), unless the page asks for the full width; the page
 * itself; and the little Messages window at the bottom right. The Feed is the home page. The shell
 * also wraps nested routes (the Library lives under /library), so all its links are absolute ("~").
 */
export default function RecoveryShell({ active, children, dateLabel = "THURSDAY, 24 SEPTEMBER", className = "", loungeHere, panel = true }: RecoveryShellProps) {
  const [, navigate] = useLocation();
  const { largeText, strongContrast } = useDisplayPrefs();
  const openSettings = useSettings();
  const narrow = useMediaQuery(NARROW);
  const [panelOpen, setPanelOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const aside = useRef<HTMLElement>(null);
  const drawer = panel && narrow && panelOpen;
  // The Messages window stays out of the way on Messages itself and while a group is being started.
  const search = useSearch();
  const pathname = usePathname();
  const space = pathname === "/community" ? communityViewFromQuery(search).space : "feed";
  // The clinician portal is a workspace of its own: no community tabs and no Messages window there.
  const portal = pathname === "/clinicians/portal" || pathname.startsWith("/clinicians/portal/");
  // Alerts: opened from the profile panel's row, closed by its Close button, Escape or a new address.
  const alerts = useAlertsPanel();
  useEffect(() => { alertsPanel.close(); }, [search]);
  /** Where the focus goes when the panel closes: its row in the profile panel, or the view's heading when the row is out of sight. */
  const headingNow = () => {
    const row = document.querySelector<HTMLElement>('#site-panel:not([inert]) [data-cm-tool="alerts"]');
    if (row && row.getClientRects().length) return row;
    return document.querySelector<HTMLElement>("[data-space]:not([hidden]) [data-view-heading]") ?? document.querySelector<HTMLElement>("[data-page-heading], main h1") ?? null;
  };

  // The slide-in panel: Escape closes it, and the focus goes into it and back to the menu button.
  useEffect(() => {
    if (!drawer) return;
    aside.current?.querySelector<HTMLElement>("a, button, input")?.focus();
    // (Escape closes the Alerts panel first when it is open over the drawer: that one is the dialog's.)
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.defaultPrevented && !alertsPanel.get().open) { setPanelOpen(false); menuButton.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);
  const closePanel = () => { if (!drawer) return; setPanelOpen(false); menuButton.current?.focus(); };
  useEffect(() => { if (!narrow) setPanelOpen(false); }, [narrow]);

  return (
    <div className={`recovery-shell site-shell ${panel ? "" : "no-panel"} ${largeText ? "recovery-large-text" : ""} ${strongContrast ? "recovery-strong-contrast" : ""} ${drawer ? "has-drawer" : ""} ${className}`}>
      <header className="site-top">
        <div className="site-top-start">
          {panel && (
            <button ref={menuButton} type="button" className="site-menu" aria-label={panelOpen ? "Close your panel" : "Open your panel"} aria-expanded={drawer} aria-controls="site-panel" onClick={() => setPanelOpen(!panelOpen)}>
              {drawer ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
          {/* The clinician edition says so under the brand, on its own line, at every width (comment 3). */}
          <button type="button" className="site-brand" onClick={() => navigate("~/community")} aria-label="Rehyn: Connect for clinicians, go to the Feed">
            <span className="site-brand-mark"><HeartRateMark size={22} /></span>
            <span className="site-brand-words">
              <span className="site-brand-name">Rehyn<em>: Connect</em></span>
              <span className="site-brand-edition">for clinicians</span>
            </span>
          </button>
        </div>
        {!portal && <SiteTabs here={loungeHere} />}
        <div className="site-top-tools">
          <button type="button" className="site-settings" aria-label="Settings" aria-haspopup="dialog" title="Settings" onClick={event => openSettings(event.currentTarget)}><Settings size={20} /><span>Settings</span></button>
        </div>
      </header>

      <div className="site-body">
        {drawer && <button type="button" className="site-scrim" aria-label="Close your panel" tabIndex={-1} onClick={closePanel} />}
        {panel && (
          <aside ref={aside} id="site-panel" className={`site-panel ${drawer ? "is-open" : ""}`} aria-label="Your panel" inert={narrow && !panelOpen ? true : undefined}>
            <ProfilePanel careTeam={active === "Care Team"} onNavigate={closePanel} />
          </aside>
        )}
        <main className="site-main">{children}</main>
      </div>

      {/* The Messages window and the Alerts panel, on every page, over everything else. */}
      {!portal && <div className="cm-layer site-dock"><MessagesDock space={space} /></div>}
      {/* In a layer of its own, so it sits above the slide-in panel it opened from. */}
      {alerts.open && <div className="cm-layer"><AlertsPanel onClose={alertsPanel.close} anchor={alerts.anchor} over={placeOf(communityViewFromQuery(search))} fallbackFocus={headingNow} /></div>}
    </div>
  );
}
