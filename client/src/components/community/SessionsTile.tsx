import { useId } from "react";
import { Link } from "wouter";
import { ArrowRight, Users } from "lucide-react";
import { useCreatedSessions } from "@/lib/consultations";
import { useMe } from "@/lib/me";
import { useMinute } from "../clinicians/GroupSessions";
import { STATUS_TEXT, hostedSessions, scheduleText, sessionStatus, sessionViewHref } from "./weekly-sessions-model";
import "./sessions-tile.css";

// "Group weekly sessions", in the feed's right-hand lane (comment 18): the next few patient Q&A sessions the signed-in
// clinician hosts, upcoming or live, each with its day, time range and title. Each opens that session in the
// Group weekly sessions view (/community?space=circle&session=<id>). A clinician hosting none sees no card at all.

const SHOWN = 3;

export default function SessionsTile() {
  const me = useMe();
  const now = useMinute();
  const titleId = useId();
  const sessions = hostedSessions(useCreatedSessions(), me.clinician.id, now).coming.slice(0, SHOWN);
  if (!sessions.length) return null;
  return (
    <section className="cx-card cm-sessions-tile" aria-labelledby={titleId}>
      <div className="cm-sessions-head">
        <span className="cm-sessions-icon" aria-hidden="true"><Users size={16} /></span>
        <span><b id={titleId}>Group weekly sessions</b><span>Your patient Q&A sessions</span></span>
      </div>
      <ul className="cm-sessions-list" role="list">
        {sessions.map(session => {
          const status = sessionStatus(session, now);
          return (
            <li key={session.id}>
              <Link href={sessionViewHref(session)} className="cm-session-row">
                <span className="cm-session-when">
                  {status === "upcoming" ? null : <span className={`cx-pill${status === "live" ? " is-live" : " is-accent"}`}>{STATUS_TEXT[status]}</span>}
                  {/* The time range already says how long it is; topics and places show once the session is open. */}
                  <span>{scheduleText(session, now)}</span>
                </span>
                <b className="cm-session-title">{session.title}</b>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link className="cm-sessions-all" href={sessionViewHref()}>See all your sessions<ArrowRight size={14} aria-hidden="true" /></Link>
    </section>
  );
}
