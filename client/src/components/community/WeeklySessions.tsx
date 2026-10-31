import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Link, useSearch } from "wouter";
import { CalendarPlus, MessageSquare, Settings2, Users, Video } from "lucide-react";
import { clockText, sessionOpen, sessionPriceText, type GroupSession } from "@/content/clinicians";
import { sessionRoom, useCreatedSessions, usePlaces, useSessionQuestions } from "@/lib/consultations";
import { useMe } from "@/lib/me";
import { useMinute } from "../clinicians/GroupSessions";
import {
  SCHEDULE_HREF, STATUS_TEXT, hostedSessions, organisedCount, patientGroupText, sessionStatus, sessionViewHref, timeRangeText,
  type SessionStatus,
} from "./weekly-sessions-model";
import "./weekly-sessions.css";

// Group weekly sessions (/community?space=circle, comments 13 and 20): the signed-in clinician's weekly Q&A sessions
// with patients. A list of the sittings to come, each with its date, time and title; picking one (or a link with
// `&session=<id>`) opens its details beside the list: topics, date and time, length, places, the host action and the
// questions patients sent in advance. Nothing is open until one is picked. Sessions are set up in the clinician portal
// (Schedule a session); the host joins through the same video room as a consultation (/clinicians/meet/<room>?as=clinician),
// which opens ten minutes before the start.

const STATUS_CLASS: Record<SessionStatus, string> = { upcoming: "", soon: " is-accent", live: " is-live", finished: " ws-pill-done" };

function StatusPill({ status }: { status: SessionStatus }) {
  return <span className={`cx-pill${STATUS_CLASS[status]}`}>{STATUS_TEXT[status]}</span>;
}

const countText = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** One sitting in the list: the date on the left, then its status, time and title. */
function SessionRow({ session, now, selected, questions, onPick }: { session: GroupSession; now: number; selected: boolean; questions: number; onPick: () => void }) {
  const start = new Date(session.start);
  const status = sessionStatus(session, now);
  return (
    <li>
      <Link href={sessionViewHref(session)} className={`ws-row${status === "finished" ? " is-done" : ""}`} aria-current={selected ? "true" : undefined} onClick={onPick}>
        <span className="ws-date" aria-hidden="true">
          <span>{start.toLocaleDateString("en-GB", { weekday: "short" })}</span>
          <strong>{start.getDate()}</strong>
          <span>{start.toLocaleDateString("en-GB", { month: "short" })}</span>
        </span>
        <span className="ws-row-main">
          {/* The date is in the block on the left (hidden from screen readers), so it is said here in full for them. The
              list is headed "Coming up", so only "Opens soon" and "Live now" get a label. */}
          <span className="ws-row-top">{status !== "upcoming" && <StatusPill status={status} />}<span><span className="cm-sr">{start.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}, </span>{timeRangeText(session)}</span></span>
          <b className="ws-row-title">{session.title}</b>
        </span>
        <span className="ws-row-q"><MessageSquare size={14} aria-hidden="true" />{countText(questions, "question", "questions")}</span>
      </Link>
    </li>
  );
}

/** The open sitting: what it is, when, for whom, the host's way in, and the patients' questions. */
function SessionDetail({ session, now, questions, saved, headingRef }: { session: GroupSession; now: number; questions: string[]; saved: boolean; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const titleId = useId();
  const status = sessionStatus(session, now);
  const start = new Date(session.start);
  const open = sessionOpen(session, now);
  return (
    <section className="cx-card ws-detail" aria-labelledby={titleId}>
      <h2 className="ws-detail-title" id={titleId} ref={headingRef} tabIndex={-1}>{session.title}</h2>
      <p className="ws-detail-about">{session.about}</p>
      <dl className="ws-facts">
        <div><dt>Topics</dt><dd>{patientGroupText(session)}</dd></div>
        <div><dt>Date</dt><dd>{start.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</dd></div>
        <div><dt>Time</dt><dd>{timeRangeText(session)}</dd></div>
        <div><dt>Duration</dt><dd>{session.minutes} minutes</dd></div>
        <div><dt>Places</dt><dd>{countText(session.spaces, "place", "places")}{saved ? " · 1 saved on this device" : ""}</dd></div>
        <div><dt>Price</dt><dd>{sessionPriceText(session)}</dd></div>
        <div><dt>Repeats</dt><dd>{session.weekly ? "Every week" : "One-off"}</dd></div>
        <div><dt>Format</dt><dd>Live video Q&A on Rehyn</dd></div>
      </dl>
      <div className="ws-actions">
        {status === "finished"
          ? <p className="ws-note">This session has finished.</p>
          : open
            ? <Link href={`/clinicians/meet/${sessionRoom(session)}?as=clinician`} className="cx-btn cx-btn-primary"><Video size={16} aria-hidden="true" />{status === "live" ? "Join as host" : "Start the session"}</Link>
            : <p className="ws-note">The room opens at {clockText(new Date(session.start - 10 * 60_000))}.</p>}
        <Link href={SCHEDULE_HREF} className="cx-btn"><Settings2 size={16} aria-hidden="true" />Manage in the portal</Link>
      </div>
      <div className="ws-questions">
        <h3 className="ws-h3">Patient questions sent in advance <span className="cx-pill">{questions.length}</span></h3>
        {/* The questions patients sent, and nothing in their place when there are none. */}
        <ol className="ws-q-list">{questions.map((question, index) => <li key={index}>{question}</li>)}</ol>
      </div>
    </section>
  );
}

export default function WeeklySessionsView({ active }: { active: boolean }) {
  const me = useMe();
  const now = useMinute();
  const search = useSearch();
  const created = useCreatedSessions();
  const asked = useSessionQuestions();
  const places = usePlaces();
  const { coming, finished } = hostedSessions(created, me.clinician.id, now);
  const all = [...coming, ...finished];

  // The open sitting comes from the address while this view is showing, and stays as it was while another space is.
  const [requested, setRequested] = useState<string | null>(() => (active ? new URLSearchParams(search).get("session") : null));
  useEffect(() => { if (active) setRequested(new URLSearchParams(search).get("session")); }, [active, search]);
  // Nothing is open until a sitting is picked or the address names one.
  const selected = all.find(session => session.id === requested) ?? null;
  const missing = requested !== null && !all.some(session => session.id === requested);

  // Picking a sitting in the list moves the focus to its details (beside the list, or below it on a phone).
  const picked = useRef(false);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!picked.current) return;
    picked.current = false;
    detailHeading.current?.focus();
  }, [selected?.id]);

  const row = (session: GroupSession) => (
    <SessionRow key={session.id} session={session} now={now} selected={session.id === selected?.id} questions={asked[session.id]?.length ?? 0} onPick={() => { picked.current = true; }} />
  );

  return (
    <section className="ws" aria-labelledby="ws-title">
      <header className="ws-head">
        <div>
          <p className="cx-kicker">Patient Q&A · {me.name}</p>
          <h1 className="ws-title" id="ws-title" tabIndex={-1} data-view-heading>Group weekly sessions</h1>
        </div>
        <Link href={SCHEDULE_HREF} className="cx-btn cx-btn-primary ws-schedule"><CalendarPlus size={16} aria-hidden="true" />Schedule a session</Link>
      </header>

      {all.length === 0 ? (
        <section className="cx-card ws-empty" aria-labelledby="ws-empty-title">
          <span className="ws-empty-icon" aria-hidden="true"><Users size={22} /></span>
          <h2 className="ws-h2" id="ws-empty-title">You're not hosting any group sessions</h2>
          <p className="ws-note">Schedule a weekly Q&A in the clinician portal. Patients with the conditions you choose can save a place and send questions before it starts.</p>
          <Link href={SCHEDULE_HREF} className="cx-btn cx-btn-primary"><CalendarPlus size={16} aria-hidden="true" />Schedule a session</Link>
        </section>
      ) : (
        <>
          <dl className="ws-stats">
            <div className="cx-card"><dt>Coming up</dt><dd>{coming.length}</dd></div>
            <div className="cx-card"><dt>Total sessions organized</dt><dd>{organisedCount({ coming, finished })}</dd></div>
          </dl>
          {missing && <p className="ws-notice" role="status">That session is no longer listed. Pick one below to see its details.</p>}
          <div className={`ws-layout${selected ? " has-detail" : ""}`}>
            <div className="ws-lists">
              <section className="cx-card ws-list" aria-labelledby="ws-coming">
                <h2 className="ws-h2" id="ws-coming">Coming up</h2>
                {coming.length
                  ? <ul role="list">{coming.map(row)}</ul>
                  : <p className="ws-note">Nothing scheduled. <Link href={SCHEDULE_HREF}>Schedule a session</Link> in the portal.</p>}
              </section>
            </div>
            {selected && <SessionDetail key={selected.id} session={selected} now={now} questions={asked[selected.id] ?? []} saved={places.includes(selected.id)} headingRef={detailHeading} />}
          </div>
        </>
      )}
    </section>
  );
}
