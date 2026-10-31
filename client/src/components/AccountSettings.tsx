import { useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useLocation } from "wouter";
import { ChevronRight, Eye, FileText, HeartPulse, LogOut, Settings, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { logOut, useRole } from "@/lib/clinician-portal";
import PictureDialog from "./community/PictureDialog";
import CommunitySettingsView from "./community/SettingsView";
import type { SettingsSection } from "./community/settings-model";
import DataPermissions from "./DataPermissions";
import { firstName } from "@/lib/community-store";
import { profileName, useProfile } from "@/lib/profile";
import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, PRIVACY_INTRO, PRIVACY_SECTIONS, TERMS_INTRO, TERMS_SECTIONS, type LegalSection } from "@/content/legal-content";
import { setDisplayPrefs, useDisplayPrefs } from "@/lib/display-prefs";
import { AgreementLine, HealthConsentPanel } from "./HealthConsent";
import { SettingsContext, type OpenSettings, type SettingsView } from "./settings-context";
import "@/pages/community.css";
import "@/pages/community-settings.css";
import "@/pages/community-picture.css";
import "./account-settings.css";
import "./account-settings-clinician.css";

export type { SettingsView } from "./settings-context";
/**
 * The old address of Community settings. It still works: My community opens Settings → Your profile
 * for it (and `&section=` names a part of it), over the feed.
 */
export const PROFILE_PATH = "/community?space=settings&section=profile";
// The health information consent has its own entry, apart from the Privacy Notice and the Terms of Use. Your profile
// has no entry of its own (the main page has it), but links from Data and permissions and the old address still open it.
const sections = [
  { id: "display", label: "Display", icon: Eye },
  { id: "privacy", label: "Privacy Notice", icon: ShieldCheck },
  { id: "terms", label: "Terms of Use", icon: FileText },
  { id: "health", label: "Health information consent", icon: HeartPulse },
  { id: "data", label: "Data and permissions", icon: SlidersHorizontal },
  { id: "logout", label: "Log out", icon: LogOut },
] as const;

/** Log out of this device, then the Join page opens: join again as a patient (or carer) or as a clinician. */
function LogOutPanel({ onDone }: { onDone: () => void }) {
  const role = useRole();
  const [, navigate] = useLocation();
  const leave = () => { onDone(); logOut(); navigate("/"); };
  return (
    <div className="settings-logout">
      <p>{role === "clinician" ? "You're signed in as a clinician." : "You're signed in as a patient or carer."} Logging out takes you back to the Join page, where you can join again as a patient or as a clinician.</p>
      <p>Your posts, consultations and saved places stay on this device. A clinician profile made here is removed.</p>
      <button type="button" className="settings-logout-button" onClick={leave}><LogOut size={18} aria-hidden="true" />Log out</button>
    </div>
  );
}

/** Display: larger text and stronger contrast, which used to be buttons in the top bar. */
function DisplaySettings() {
  const { largeText, strongContrast } = useDisplayPrefs();
  const row = (label: string, note: string, on: boolean, change: (on: boolean) => void) => (
    <div className="settings-display-row">
      <span><b>{label}</b><span>{note}</span></span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className="settings-display-switch" onClick={() => change(!on)}><span /></button>
    </div>
  );
  return (
    <div className="settings-display">
      {row("Larger text", "Makes the words on every page bigger.", largeText, on => setDisplayPrefs({ largeText: on }))}
      {row("Stronger contrast", "Darker text and lines, for easier reading.", strongContrast, on => setDisplayPrefs({ strongContrast: on }))}
    </div>
  );
}

export function useSettings() {
  const openSettings = useContext(SettingsContext);
  if (!openSettings) throw new Error("Settings must be used inside SettingsProvider");
  return openSettings;
}

/** For pages that can also render on their own (in tests): null outside SettingsProvider. */
export function useOptionalSettings(): OpenSettings | null {
  return useContext(SettingsContext);
}

export function SettingsButton({ mobile = false }: { mobile?: boolean }) {
  const openSettings = useSettings();
  return (
    <button className={`settings-launcher ${mobile ? "settings-launcher-mobile" : "settings-launcher-sidebar"}`} aria-label="Open settings" aria-haspopup="dialog" title="Settings" onClick={event => openSettings(event.currentTarget)}>
      <Settings size={21} aria-hidden="true" />
      {!mobile && <><span>Settings</span><ChevronRight size={16} aria-hidden="true" /></>}
    </button>
  );
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<SettingsView>("display");
  const [focus, setFocus] = useState<string | undefined>();
  const opener = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLElement>(null);
  // "Choose your picture", opened from Your profile: the button that opened it, for the focus to return to.
  const [pictureFrom, setPictureFrom] = useState<HTMLElement | null>(null);
  const profile = useProfile();
  const title = view === "profile" ? "Your profile" : sections.find(section => section.id === view)!.label;

  const openSettings: OpenSettings = (source, nextView = "display", nextFocus) => {
    opener.current = source;
    setView(nextView);
    setFocus(nextFocus);
    setOpen(true);
  };
  const show = (next: SettingsView, nextFocus?: string) => { setView(next); setFocus(nextFocus); };
  // A link inside Your profile (to the Friends drawer, to Safety) leaves Settings for that page.
  const onPanelClick = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("a[href]")) setOpen(false);
  };
  /** When what opened Settings has gone or is out of reach (it opened from an address, or from the closed drawer), the page's heading takes the focus. */
  const closeFocus = () => {
    const source = opener.current;
    const usable = !!source && source.isConnected && !source.closest("[inert], [hidden]") && source.getClientRects().length > 0;
    const target = usable ? source : document.querySelector<HTMLElement>("[data-space]:not([hidden]) [data-view-heading], [data-page-heading], main h1");
    target?.focus({ preventScroll: true });
  };

  return (
    <SettingsContext.Provider value={openSettings}>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="account-settings-backdrop" />
          <Dialog.Content className="account-settings-dialog" aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); closeFocus(); }} onEscapeKeyDown={event => { if (pictureFrom) { event.preventDefault(); setPictureFrom(null); } }}>
            <header className="account-settings-header">
              <span className="account-settings-mark"><Settings size={22} aria-hidden="true" /></span>
              <Dialog.Title>Settings</Dialog.Title>
              <Dialog.Close className="account-settings-close" aria-label="Close settings"><X size={21} /></Dialog.Close>
            </header>
            <div className="account-settings-layout">
              <nav className="account-settings-nav" aria-label="Settings sections">
                {sections.map(({ id, label, icon: Icon }) => (
                  <button key={id} aria-pressed={view === id} aria-controls="account-settings-panel" onClick={() => show(id)}>
                    <Icon size={19} aria-hidden="true" /><span>{label}</span><ChevronRight size={15} aria-hidden="true" />
                  </button>
                ))}
              </nav>
              <section key={view} ref={panel} id="account-settings-panel" className={`account-settings-panel ${view === "profile" ? "cm-layer is-profile" : ""}`} aria-labelledby="account-settings-panel-title" tabIndex={0} onClick={onPanelClick}>
                <h2 id="account-settings-panel-title">{title}</h2>
                {view === "profile" ? (
                  <>
                    <CommunitySettingsView embedded name={firstName(profileName(profile))} section={(focus as SettingsSection | undefined) ?? "profile"} onChangePicture={setPictureFrom} />
                    {pictureFrom && <PictureDialog onClose={() => setPictureFrom(null)} returnFocus={pictureFrom} fallbackFocus={() => panel.current} />}
                  </>
                ) : view === "display" ? <DisplaySettings /> : view === "privacy" ? (
                  <><AgreementLine document="privacy" /><SettingsDocument intro={PRIVACY_INTRO} sections={PRIVACY_SECTIONS} focus={focus} /></>
                ) : view === "terms" ? (
                  <><AgreementLine document="terms" /><SettingsDocument intro={TERMS_INTRO} sections={TERMS_SECTIONS} focus={focus} /></>
                ) : view === "health" ? (
                  <HealthConsentPanel onReadPrivacy={() => show("privacy", "4.")} />
                ) : view === "logout" ? (
                  <LogOutPanel onDone={() => setOpen(false)} />
                ) : (
                  <DataPermissions onOpenDocument={(which, focus) => show(which, focus)} onOpenProfile={() => show("profile")} onClose={() => setOpen(false)} />
                )}
              </section>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </SettingsContext.Provider>
  );
}

function SettingsDocument({ intro, sections, focus }: { intro: string; sections: LegalSection[]; focus?: string }) {
  const headings = useRef<(HTMLHeadingElement | null)[]>([]);
  // Opened at a section ("How we use your information" is section 4 of the Privacy Notice).
  useEffect(() => {
    if (!focus) return;
    const heading = headings.current[sections.findIndex(section => section.title.startsWith(focus))];
    heading?.scrollIntoView({ block: "start" });
    heading?.focus({ preventScroll: true });
  }, [focus, sections]);
  return (
    <article className="settings-document">
      <p className="settings-document-version">{`Version ${LEGAL_VERSION} · Effective date: ${LEGAL_EFFECTIVE_DATE} · Rehyn Ltd, company number 17417716 · info@rehyn.com`}</p>
      <p className="settings-document-intro">{intro}</p>
      <label className="settings-section-jump">Jump to a section
        <select defaultValue="" onChange={event => {
          const heading = headings.current[Number(event.currentTarget.value)];
          heading?.scrollIntoView({ block: "start" });
          heading?.focus({ preventScroll: true });
        }}>
          <option value="" disabled>Choose a section</option>
          {sections.map((section, index) => <option key={section.title} value={index}>{section.title}</option>)}
        </select>
      </label>
      {sections.map((section, index) => (
        <section className="settings-document-section" key={section.title}>
          <h3 tabIndex={-1} ref={element => { headings.current[index] = element; }}>{section.title}</h3>
          {section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
          {section.bullets && <ul>{section.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}</ul>}
          {section.after?.map((paragraph, paragraphIndex) => <p key={`after-${paragraphIndex}`}>{paragraph}</p>)}
        </section>
      ))}
    </article>
  );
}
