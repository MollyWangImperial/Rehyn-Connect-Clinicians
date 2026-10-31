import { useEffect, useState, type ReactNode } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { BellRing, CalendarDays, CreditCard, House, Inbox, UserRound, Users, Video, X } from "lucide-react";
import { alertable, type Clinician } from "@/content/clinicians";
import { updateClinician, useClinicians, useOwnClinician, useRole } from "@/lib/clinician-portal";
import { URGENT_WAIT_MS, answer, setPortalClinician, updateConsultation, useConsultations, usePortalClinician, type Consultation } from "@/lib/consultations";
import { meId as signedInId } from "@/lib/me";
import { PreviewNote } from "./parts";
import { PortalConsultations, PortalEarnings, PortalRequests, PortalSessions, PortalToday } from "./portal/pages";
import PortalSchedule from "./portal/Schedule";
import PortalProfile from "./portal/ProfileEditor";
import "./portal/portal.css";
import "./portal/portal-clinician.css";

// The clinician portal (/clinicians/portal), from the design canvas "Rehyn Clinician Portal": Today, Requests,
// Schedule, Consultations, Group sessions, Earnings and Profile & pricing, with urgent requests popping up on every page.
// A clinician who joined on this device sees their own; anyone can try it as one of the example clinicians. It reads
// the same consultations as the patient's side on this device (lib/consultations.ts).

/** Ticks every few seconds, for countdowns and "starts in". */
export function useNow(every = 5000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), every); return () => window.clearInterval(timer); }, [every]);
  return now;
}

const NAV: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/", label: "Today", icon: <House size={18} aria-hidden="true" /> },
  { href: "/requests", label: "Requests", icon: <Inbox size={18} aria-hidden="true" /> },
  { href: "/schedule", label: "Schedule", icon: <CalendarDays size={18} aria-hidden="true" /> },
  { href: "/consultations", label: "Consultations", icon: <Video size={18} aria-hidden="true" /> },
  { href: "/sessions", label: "Group sessions", icon: <Users size={18} aria-hidden="true" /> },
  { href: "/earnings", label: "Earnings", icon: <CreditCard size={18} aria-hidden="true" /> },
  { href: "/profile", label: "Profile & pricing", icon: <UserRound size={18} aria-hidden="true" /> },
];

/** An urgent request, popping up on every portal page: answer within five minutes, then see whether the patient chooses you. */
function UrgentAlert({ me, list, now }: { me: Clinician; list: Consultation[]; now: number }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const hide = (key: string) => setHidden(current => [...current, key]);
  const reachable = me.listed !== false && alertable(me, new Date(now));
  const waiting = reachable ? list.find(item => item.urgent && ["matching", "escalated"].includes(item.status) && !item.answered.includes(me.id) && !hidden.includes(item.id)) : undefined;
  const answered = list.find(item => item.urgent && item.answered.includes(me.id) && ["matching", "matched", "escalated"].includes(item.status) && !hidden.includes(`${item.id}:answered`));
  const chosen = list.find(item => item.urgent && item.status === "scheduled" && item.clinicianId === me.id && !hidden.includes(`${item.id}:chosen`));

  if (chosen) {
    return (
      <section className="pt-urgent is-chosen" role="alertdialog" aria-labelledby="pt-urgent-title">
        <p className="pt-urgent-kicker">Urgent request · ref {chosen.ref}</p>
        <h2 className="pt-urgent-title" id="pt-urgent-title">The patient chose you.</h2>
        <p>£{chosen.price} is held on their card and paid to you when you finish the consultation. They're waiting in the room.</p>
        {chosen.questions && <p className="pt-urgent-quote">“{chosen.questions.split("\n")[0]}”</p>}
        <div className="pt-urgent-actions">
          <Link href={`~/clinicians/meet/${chosen.room}?as=clinician`} className="pt-urgent-main" onClick={() => hide(`${chosen.id}:chosen`)}>Join the call now</Link>
          <button type="button" className="pt-urgent-later" onClick={() => hide(`${chosen.id}:chosen`)}>Later</button>
        </div>
      </section>
    );
  }
  if (waiting) {
    const left = URGENT_WAIT_MS - (now - (waiting.alertedAt ?? now));
    const share = Math.max(0, Math.min(1, left / URGENT_WAIT_MS));
    const seconds = Math.max(0, Math.ceil(left / 1000));
    return (
      <section className="pt-urgent" role="alertdialog" aria-labelledby="pt-urgent-title">
        <div className="pt-urgent-top">
          <span className="pt-ring" style={{ background: `conic-gradient(var(--cx-danger) 0 ${share * 100}%, var(--cx-line) ${share * 100}% 100%)` }}>
            <span>{waiting.status === "escalated" ? "Team told" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}</span>
          </span>
          <p className="pt-urgent-kicker"><BellRing size={16} aria-hidden="true" />Urgent request · ref {waiting.ref}</p>
          <button type="button" className="pt-urgent-close" aria-label="Not now" onClick={() => hide(waiting.id)}><X size={18} aria-hidden="true" /></button>
        </div>
        <h2 className="pt-urgent-title" id="pt-urgent-title">{waiting.questions ? `“${waiting.questions}”` : "Someone needs to talk to a clinician today."}</h2>
        <p>{me.urgentAlerts === "always" ? "You asked for every urgent request, even when you're busy." : "You're free in the next 48 hours, so you were alerted."} If you answer, the patient sees your profile and chooses whether to go ahead.</p>
        <div className="pt-urgent-actions">
          <button type="button" className="pt-urgent-main" onClick={() => updateConsultation(waiting.id, item => answer(item, me.id))}>Answer</button>
          <button type="button" className="pt-urgent-later" onClick={() => hide(waiting.id)}>Not now</button>
        </div>
      </section>
    );
  }
  if (answered) {
    const mine = answered.clinicianId === me.id;
    return (
      <section className="pt-urgent is-quiet" role="status">
        <p className="pt-urgent-kicker">Urgent request · ref {answered.ref}</p>
        <p><strong>{mine ? "You answered first." : "You answered."}</strong> {mine ? "The patient is looking at your profile and choosing whether to go ahead." : "The patient is looking at another clinician for now, and may still choose you."}</p>
        <button type="button" className="pt-urgent-close" aria-label="Hide" onClick={() => hide(`${answered.id}:answered`)}><X size={18} aria-hidden="true" /></button>
      </section>
    );
  }
  return null;
}

function Shell({ me, everyone, ownId }: { me: Clinician; everyone: Clinician[]; ownId: string | null }) {
  const [location] = useLocation();
  const now = useNow(1000);
  const list = useConsultations();
  const waiting = list.filter(item => item.clinicianId === me.id && item.status === "requested").length;
  const here = (href: string) => (href === "/" ? location === "/" || location === "" : location.startsWith(href));
  return (
    <div className="pt-portal">
      <nav className="pt-side" aria-label="Clinician portal">
        <p className="pt-side-brand">Clinician portal</p>
        <div className="pt-side-links">
          {NAV.map(item => (
            <Link key={item.href} href={item.href} className="pt-side-link" aria-current={here(item.href) ? "page" : undefined}>
              {item.icon}{item.label}{item.href === "/requests" && waiting > 0 && <span className="pt-badge">{waiting}</span>}
            </Link>
          ))}
        </div>
        <label className="pt-side-card pt-as">
          <span className="pt-side-label">{ownId === me.id ? "Signed in as" : "Using the demo profile of"}</span>
          <select value={me.id} onChange={event => setPortalClinician(event.target.value === ownId ? null : event.target.value)}>
            {everyone.map(person => <option key={person.id} value={person.id}>{person.id === ownId ? `${person.name} (you)` : `${person.name} · demo profile`}</option>)}
          </select>
        </label>
      </nav>
      <main className="pt-main">
        <UrgentAlert me={me} list={list} now={now} />
        <Switch>
          <Route path="/"><PortalToday me={me} now={now} /></Route>
          <Route path="/requests"><PortalRequests me={me} now={now} /></Route>
          <Route path="/schedule"><PortalSchedule me={me} /></Route>
          <Route path="/consultations"><PortalConsultations me={me} /></Route>
          <Route path="/sessions"><PortalSessions me={me} /></Route>
          <Route path="/earnings"><PortalEarnings me={me} /></Route>
          <Route path="/profile"><PortalProfile key={me.id} me={me} /></Route>
          <Route><PortalToday me={me} now={now} /></Route>
        </Switch>
      </main>
    </div>
  );
}

export default function ClinicianPortal() {
  const everyone = useClinicians();
  const own = useOwnClinician();
  const role = useRole();
  const picked = usePortalClinician();
  // Rehyn Connect for clinicians: the portal is always the signed-in clinician's (lib/me.ts), the demo profile when
  // nobody has joined on this device, so it matches the sidebar, the feed and the weekly sessions.
  const me = everyone.find(person => person.id === signedInId(picked, own?.id ?? null, everyone));
  if (me) return <Shell me={me} everyone={everyone} ownId={own?.id ?? null} />;
  return (
    <div className="cl-page cl-narrow">
      <p className="cl-kicker"><span aria-hidden="true" />Clinician portal</p>
      <h1 className="cl-h1" data-page-heading>For clinicians<span aria-hidden="true">.</span></h1>
      <p className="cl-lead">Set your hours and prices, answer requests and urgent alerts, meet patients by video and host group sessions.</p>
      <PreviewNote>{role === "patient"
        ? "You joined as a patient or carer, so there's no portal of your own. To see how it works, try it as one of the example clinicians."
        : "Clinicians join from the sign-up page. To see how it works, try it as one of the example clinicians."}</PreviewNote>
      <label className="cl-field cl-portal-as">
        <span className="cl-label">Try the portal as</span>
        <select className="cl-text" value="" onChange={event => setPortalClinician(event.target.value || null)}>
          <option value="">Choose a clinician…</option>
          {everyone.map(clinician => <option key={clinician.id} value={clinician.id}>{clinician.name} · {clinician.role}</option>)}
        </select>
      </label>
      <p className="cl-small">Tip: Ruth and Hannah are free most days, so they get urgent alerts.</p>
    </div>
  );
}
