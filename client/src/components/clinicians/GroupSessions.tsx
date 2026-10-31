import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Bookmark, Users, Video } from "lucide-react";
import { findClinician, groupPlace, mainSection, professionalTitle, sessionGroupIds, sessionOpen, sessionPriceText, upcomingSessions, whenText, type GroupSession } from "@/content/clinicians";
import { useClinicians } from "@/lib/clinician-portal";
import { askInAdvance, sessionRoom, togglePlace, useCreatedSessions, usePlaces } from "@/lib/consultations";
import { hueStyle } from "./parts";

// Weekly group sessions, on the Clinicians tab: open sessions where a clinician answers questions, which they set up in
// the clinician portal to meet people and show how they work. Free unless the host set a price for a place. The room opens ten minutes before the start.

/** Ticks once a minute, so a session's Join button appears on time. */
export function useMinute() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  return now;
}

/** A question for the host, sent ahead of a session someone saved a place in (only the words reach the host). */
function AskAhead({ session }: { session: GroupSession }) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  if (sent) return <p className="cl-small" role="status">Sent. The host sees your question without your name.</p>;
  return (
    <form className="cl-ask-ahead" onSubmit={event => { event.preventDefault(); askInAdvance(session.id, text); setSent(true); }}>
      <label className="cl-sr" htmlFor={`ask-${session.id}`}>A question for the session</label>
      <input id={`ask-${session.id}`} className="cl-text" value={text} maxLength={300} placeholder="Send a question in advance (optional)" onChange={event => setText(event.target.value)} />
      <button type="submit" className="cl-btn is-light" disabled={!text.trim()}>Send</button>
    </form>
  );
}

export function SessionCard({ session, now, host = false }: { session: GroupSession; now: number; host?: boolean }) {
  const clinician = findClinician(session.clinicianId);
  const saved = usePlaces().includes(session.id);
  const open = sessionOpen(session, now);
  if (!clinician) return null;
  const live = now >= session.start;
  const titles = sessionGroupIds(session).map(id => groupPlace(id)?.group.title).filter((title): title is string => !!title);
  const listedWith = titles.length > 2 ? `${titles[0]} and ${titles.length - 1} more` : titles.length ? titles.join(" and ") : undefined;
  return (
    <article className="cl-session" style={hueStyle(mainSection(clinician).hue)}>
      <p className="cl-session-when">{live && open ? <span className="cl-live">Live now</span> : whenText(new Date(session.start), new Date(now))} · {session.minutes} min · {sessionPriceText(session)}</p>
      <h3 className="cl-session-title">{session.title}</h3>
      <p className="cl-session-about">{session.about}{listedWith ? ` · ${listedWith}` : ""}</p>
      <p className="cl-session-host"><span className="cl-avatar is-small" aria-hidden="true">{clinician.initials}</span><span><strong>{clinician.name}</strong>{professionalTitle(clinician)}</span></p>
      <div className="cl-card-actions">
        {open
          ? <Link href={`~/clinicians/meet/${sessionRoom(session)}${host ? "?as=clinician" : ""}`} className="cl-btn"><Video size={18} aria-hidden="true" />{host ? "Start the session" : "Join the session"}</Link>
          : !host && <button type="button" className="cl-btn is-light" aria-pressed={saved} onClick={() => togglePlace(session.id)}><Bookmark size={16} fill={saved ? "currentColor" : "none"} aria-hidden="true" />{saved ? "Place saved" : `Save my place · ${session.spaces} places`}</button>}
      </div>
      {!host && saved && !open && <AskAhead session={session} />}
    </article>
  );
}

export default function GroupSessions() {
  const now = useMinute();
  useClinicians();
  const sessions = upcomingSessions(useCreatedSessions(), new Date(now)).slice(0, 4);
  return (
    <section className="cl-sessions" aria-labelledby="cl-sessions-title">
      <div className="cl-sessions-head">
        <div>
          <h2 className="cl-h2" id="cl-sessions-title"><Users size={22} aria-hidden="true" />Weekly group sessions</h2>
          <p className="cl-small">Open sessions where a clinician answers questions from everyone who joins. Many are free, and each shows its price. Listen in, or ask your own.</p>
        </div>
      </div>
      <div className="cl-session-grid">{sessions.map(session => <SessionCard key={session.id} session={session} now={now} />)}</div>
    </section>
  );
}
