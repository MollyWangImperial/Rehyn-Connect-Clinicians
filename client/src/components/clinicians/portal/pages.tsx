import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, Video } from "lucide-react";
import {
  MAX_SESSION_PRICE, REHYN_SHARE, WINDOW_HOURS, clinicianGroups, clinicianShare, clockText, freeTimes, poundsText, sessionPriceText, shareText,
  upcomingSessions, whenText, works, type Clinician,
} from "@/content/clinicians";
import { previewConsultations } from "@/content/consultation-preview";
import { librarySections } from "@/content/library";
import { profileGaps, registerText } from "@/lib/clinician-portal";
import {
  accept, addSession, busyTimes, decline, expire, hasExpired, newSession, questionLines, removeSession, suggest, updateConsultation,
  useConsultations, useCreatedSessions, usePlaces, useSessionQuestions, type Consultation,
} from "@/lib/consultations";
import { Timeline, Transcript } from "../parts";
import { SessionCard, useMinute } from "../GroupSessions";

// The clinician portal's pages (ClinicianPortal.tsx holds the side menu and the urgent alert): Today, Requests,
// Consultations, Group sessions and Earnings. Schedule and Profile & pricing have their own files.

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();
const startOfWeek = (now: number) => { const date = new Date(now); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return date.getTime(); };
const pounds = (amount: number) => `£${amount.toLocaleString("en-GB")}`;
const ref = (item: Consultation) => `ref ${item.ref}`;

/** Requests whose times have all passed end by themselves, and their holds are released. */
function useExpiry(list: Consultation[], now: number) {
  useEffect(() => { list.filter(item => hasExpired(item, now)).forEach(item => updateConsultation(item.id, current => expire(current, now))); }, [list, now]);
}

function Head({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="pt-head">
      <div>
        <p className="cl-kicker"><span aria-hidden="true" />{kicker}</p>
        <h1 className="cl-h1" data-page-heading>{title}<span aria-hidden="true">.</span></h1>
      </div>
      {children && <div className="pt-head-actions">{children}</div>}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------- today

type Slot = { at: number; key: string; node: ReactNode };

export function PortalToday({ me, now }: { me: Clinician; now: number }) {
  const list = useConsultations();
  const created = useCreatedSessions();
  useExpiry(list, now);
  const mine = list.filter(item => item.clinicianId === me.id);
  const requests = mine.filter(item => item.status === "requested");
  const upcoming = mine.filter(item => item.status === "scheduled" && item.at !== null && item.at > now - 30 * 60_000).sort((a, b) => a.at! - b.at!);
  const next = upcoming[0];
  const sessions = upcomingSessions(created, new Date(now)).filter(session => session.clinicianId === me.id);
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const gaps = profileGaps(me);
  const week = startOfWeek(now);
  const paid = mine.filter(item => item.payment === "paid" && (item.at ?? item.createdAt) >= week).reduce((sum, item) => sum + item.price, 0);
  const held = mine.filter(item => item.payment === "held").reduce((sum, item) => sum + item.price, 0);

  const slots: Slot[] = [];
  for (const item of mine.filter(entry => entry.at !== null && sameDay(entry.at, now) && ["scheduled", "done"].includes(entry.status))) {
    const done = item.status === "done";
    slots.push({ at: item.at!, key: item.id, node: (
      <li className={`pt-slot ${done ? "is-done" : "is-booked"}`}>
        <span className="pt-slot-time">{clockText(new Date(item.at!))}</span>
        <span className="pt-slot-text"><strong>{item.urgent ? "Urgent consultation" : "Consultation"} · {ref(item)}</strong><span>{done ? `Finished · £${item.price} paid${item.transcript.length ? " · transcript saved for you both" : ""}` : `${questionLines(item).length} question${questionLines(item).length === 1 ? "" : "s"} sent · £${item.price} held`}</span></span>
        {done ? <span className="pt-chip is-ok"><Check size={14} aria-hidden="true" />Done</span> : <Link href={`~/clinicians/meet/${item.room}?as=clinician`} className="pt-chip is-go">Open the room</Link>}
      </li>
    ) });
  }
  for (const session of sessions.filter(entry => sameDay(entry.start, now))) {
    slots.push({ at: session.start, key: session.id, node: (
      <li className="pt-slot">
        <span className="pt-slot-time">{clockText(new Date(session.start))}</span>
        <span className="pt-slot-text"><strong>Group session · {session.title}</strong><span>Free · {session.minutes} min · {session.spaces} places</span></span>
        <Link href="/sessions" className="pt-chip">Prepare</Link>
      </li>
    ) });
  }
  const free = freeTimes(me, new Date(now), 24, busyTimes(list, me.id)).filter(time => sameDay(time.getTime(), now));
  if (free.length) {
    slots.push({ at: free[0].getTime(), key: "free", node: (
      <li className="pt-slot is-free">
        <span className="pt-slot-time">{clockText(free[0])}</span>
        <span className="pt-slot-text"><strong>Free · {free.map(time => clockText(time)).join(", ")}</strong><span>Open to requests and urgent alerts.</span></span>
      </li>
    ) });
  }
  slots.sort((a, b) => a.at - b.at);

  return (
    <div className="pt-page">
      <Head kicker={`Your day with patients · ${new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`} title={`${greeting}, ${me.first}`}>
        {next && <Link href={`~/clinicians/meet/${next.room}?as=clinician`} className="cl-btn pt-join"><Video size={18} aria-hidden="true" />Join {whenText(new Date(next.at!), new Date(now))}</Link>}
      </Head>
      <p className="cl-lead">{upcoming.length ? `${upcoming.length} consultation${upcoming.length === 1 ? "" : "s"} coming up.` : "No consultations booked yet."} {requests.length ? `${requests.length} request${requests.length === 1 ? " is" : "s are"} waiting for a time.` : ""}</p>

      {me.own && !me.verified && (
        <Link href="/profile" className="pt-nudge">
          <span><strong>{registerText(me)}</strong>We check your registration number ({me.registration}) before patients outside this device can book you.{gaps.length ? ` Meanwhile, add ${gaps.join(", ")}.` : ""}</span>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      )}
      {(!me.own || me.verified) && gaps.length > 0 && <Link href="/profile" className="pt-nudge"><span><strong>Finish your profile</strong>Add {gaps.join(", ")}.</span><ArrowRight size={18} aria-hidden="true" /></Link>}

      <div className="pt-cols">
        <section className="pt-card pt-wide" aria-labelledby="pt-today">
          <div className="pt-card-head"><h2 className="cl-h2" id="pt-today">Today</h2><Link href="/schedule" className="cl-link">Edit my hours</Link></div>
          {slots.length ? <ol className="pt-slots">{slots.map(slot => <Fragment key={slot.key}>{slot.node}</Fragment>)}</ol> : <p className="cl-small">Nothing today: you're not working, or every hour is free and nobody has asked yet.</p>}
        </section>
        <div className="pt-stack">
          <section className="pt-card" aria-labelledby="pt-waiting">
            <h2 className="cl-h2" id="pt-waiting">Waiting for a time</h2>
            {requests.length === 0 ? <p className="cl-small">No requests waiting.</p> : requests.slice(0, 3).map(item => (
              <Link key={item.id} href="/requests" className="pt-mini">
                <strong>{questionLines(item)[0] ?? "No questions written"}</strong>
                <span>{item.times.length} time{item.times.length === 1 ? "" : "s"} offered · first {whenText(new Date(item.times[0]), new Date(now))}</span>
              </Link>
            ))}
            {requests.length > 0 && <Link href="/requests" className="cl-link">See all requests</Link>}
          </section>
          <section className="pt-card is-dark" aria-labelledby="pt-week">
            <h2 className="cl-h2" id="pt-week">This week</h2>
            <div className="pt-money">
              <p><span>Paid</span><strong>{pounds(paid)}</strong></p>
              <p><span>Held, paid when finished</span><strong>{pounds(held)}</strong></p>
            </div>
            <Link href="/earnings" className="cl-link">Earnings and payouts</Link>
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------- requests

type Tab = "waiting" | "confirmed" | "closed";

export function PortalRequests({ me, now }: { me: Clinician; now: number }) {
  const list = useConsultations();
  useExpiry(list, now);
  const [tab, setTab] = useState<Tab>("waiting");
  const mine = list.filter(item => item.clinicianId === me.id && !item.urgent);
  const lists: Record<Tab, Consultation[]> = {
    waiting: mine.filter(item => item.status === "requested"),
    confirmed: mine.filter(item => ["scheduled", "done"].includes(item.status)),
    closed: mine.filter(item => ["declined", "cancelled"].includes(item.status)),
  };
  const shown = lists[tab];
  const [openId, setOpenId] = useState<string | null>(null);
  const open = shown.find(item => item.id === openId) ?? shown[0];
  return (
    <div className="pt-page">
      <Head kicker="Patients asking for your time" title="Requests">
        <div className="pt-tabs" role="group" aria-label="Show">
          {([["waiting", "Waiting"], ["confirmed", "Confirmed"], ["closed", "Declined or expired"]] as [Tab, string][]).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={tab === id} onClick={() => { setTab(id); setOpenId(null); }}>{label} · {lists[id].length}</button>
          ))}
        </div>
      </Head>
      {shown.length === 0 ? (
        <div className="cl-empty"><p className="cl-empty-title">Nothing here</p><p>{tab === "waiting" ? "When a patient asks for a consultation, their times and questions appear here." : "Nothing yet."}</p></div>
      ) : (
        <div className="pt-cols">
          <ul className="pt-list" aria-label="Requests">
            {shown.map(item => (
              <li key={item.id}>
                <button type="button" className="pt-list-item" aria-pressed={item.id === open?.id} onClick={() => setOpenId(item.id)}>
                  <strong>{questionLines(item)[0] ?? "No questions written"}</strong>
                  <span>{ref(item)} · {item.times.length} time{item.times.length === 1 ? "" : "s"} · £{item.price} {item.payment === "held" ? "held" : item.payment}</span>
                </button>
              </li>
            ))}
            {tab === "waiting" && <li className="pt-note">A request ends when its last time passes, and the patient's payment hold is released.</li>}
          </ul>
          {open && <RequestDetail key={open.id} me={me} item={open} list={list} now={now} />}
        </div>
      )}
    </div>
  );
}

function RequestDetail({ me, item, list, now }: { me: Clinician; item: Consultation; list: Consultation[]; now: number }) {
  const busy = busyTimes(list, me.id);
  const options = item.times.map(at => {
    const time = new Date(at);
    const passed = at <= now;
    const clash = busy.some(booked => Math.abs(booked - at) < 3_600_000);
    const outside = !works(me, time);
    return { at, passed, clash, outside, note: passed ? "Passed" : clash ? "Clashes with another consultation" : outside ? "Outside your usual hours" : "Fits your hours" };
  });
  const firstGood = options.find(option => !option.passed && !option.clash && !option.outside) ?? options.find(option => !option.passed && !option.clash);
  const [picked, setPicked] = useState<number | null>(firstGood?.at ?? null);
  const [suggesting, setSuggesting] = useState(false);
  const ownFree = useMemo(() => freeTimes(me, new Date(now), WINDOW_HOURS, busy), [me, now, busy.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const [offer, setOffer] = useState<number[]>([]);
  const waiting = item.status === "requested";
  return (
    <article className="pt-card pt-detail" aria-label={`Request ${item.ref}`}>
      <div className="pt-detail-top">
        <div>
          <h2 className="pt-detail-title">Request · {item.ref}</h2>
          <p className="cl-small">Sent {whenText(new Date(item.createdAt), new Date(now))} · {waiting ? "waiting for you" : item.status}</p>
        </div>
        <p className="cl-price"><strong>£{item.price}</strong><span>{item.payment === "held" ? "held on the patient's card" : item.payment}</span></p>
      </div>
      <section aria-label="Questions">
        <h3 className="cl-h3">What they'd like to ask</h3>
        {questionLines(item).length ? <ol className="pt-questions">{questionLines(item).map((line, index) => <li key={index}>{line}</li>)}</ol> : <p className="cl-small">No questions written: they'll ask on the call.</p>}
      </section>
      {waiting && <>
        <section aria-label="Their times">
          <h3 className="cl-h3">Choose one of their times</h3>
          <div className="pt-times">
            {options.map(option => (
              <button key={option.at} type="button" aria-pressed={picked === option.at} disabled={option.passed || option.clash} className={option.outside ? "is-outside" : ""} onClick={() => setPicked(option.at)}>
                <strong>{whenText(new Date(option.at), new Date(now))}</strong><span>{option.note}</span>
              </button>
            ))}
          </div>
        </section>
        <div className="pt-actions">
          <button type="button" className="cl-request" disabled={picked === null} onClick={() => picked !== null && updateConsultation(item.id, current => accept(current, picked))}><Check size={18} aria-hidden="true" />{picked ? `Confirm ${whenText(new Date(picked), new Date(now))}` : "Choose a time"}</button>
          <button type="button" className="cl-btn is-light" aria-expanded={suggesting} onClick={() => setSuggesting(!suggesting)}>Suggest other times</button>
          <button type="button" className="cl-clear" onClick={() => updateConsultation(item.id, current => decline(current))}>Decline · hold released</button>
        </div>
        {suggesting && (
          <section className="pt-suggest" aria-label="Suggest other times">
            <p className="cl-small">Pick up to three of your free times. The patient chooses one; their hold stays in place meanwhile.</p>
            <div className="pt-times is-small">
              {ownFree.length === 0 ? <p className="cl-small">You have no free times in the next {WINDOW_HOURS} hours.</p> : ownFree.slice(0, 12).map(time => (
                <button key={time.getTime()} type="button" aria-pressed={offer.includes(time.getTime())} disabled={!offer.includes(time.getTime()) && offer.length >= 3}
                  onClick={() => setOffer(current => (current.includes(time.getTime()) ? current.filter(at => at !== time.getTime()) : [...current, time.getTime()]))}>
                  <strong>{whenText(time, new Date(now))}</strong>
                </button>
              ))}
            </div>
            <button type="button" className="cl-btn" disabled={!offer.length} onClick={() => { updateConsultation(item.id, current => suggest(current, offer)); setSuggesting(false); }}>Send {offer.length || ""} time{offer.length === 1 ? "" : "s"}</button>
          </section>
        )}
        {item.suggested?.length ? <p className="cl-notice">You suggested {item.suggested.map(at => whenText(new Date(at), new Date(now))).join("; ")}. Waiting for the patient to choose.</p> : null}
        <p className="cl-small">The patient gets a confirmation with the room link straight away. Their £{item.price} stays held and is only taken when you finish the consultation.</p>
      </>}
      {!waiting && <Timeline consultation={item} />}
    </article>
  );
}

// ----------------------------------------------------------------------------------------------- consultations

export function PortalConsultations({ me }: { me: Clinician }) {
  const list = useConsultations();
  const mine = list.filter(item => item.clinicianId === me.id);
  const upcoming = mine.filter(item => item.status === "scheduled").sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  const finished = mine.filter(item => item.status === "done").sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  // The demo profile's example appointments (content/consultation-preview.ts), kept apart from the real list.
  const examples = previewConsultations(me.id);
  // The feed's My Consultations card links here at #c-<id>: bring that consultation into view.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: "center" });
  }, []);
  return (
    <div className="pt-page">
      <Head kicker="Your video calls with patients" title="Consultations" />
      <section className="pt-section" aria-labelledby="pt-coming">
        <h2 className="cl-h2" id="pt-coming">Coming up</h2>
        {upcoming.length === 0 ? <p className="cl-small">Nothing booked yet. Confirmed requests and urgent consultations appear here.</p> : upcoming.map(item => (
          <article key={item.id} id={`c-${item.id}`} className="pt-card pt-row">
            <div className="pt-row-text">
              {item.patientName && <p className="pt-patient">{item.patientName}</p>}
              <p className="cl-label">{item.urgent ? "Urgent · " : ""}{item.at ? whenText(new Date(item.at)) : "Now"} · {ref(item)} · £{item.price} held</p>
              {questionLines(item).length ? <ol className="pt-questions">{questionLines(item).map((line, index) => <li key={index}>{line}</li>)}</ol> : <p className="cl-small">No questions written.</p>}
            </div>
            <Link href={`~/clinicians/meet/${item.room}?as=clinician`} className="cl-btn pt-join"><Video size={18} aria-hidden="true" />Open the room</Link>
          </article>
        ))}
      </section>
      {examples.length > 0 && (
        <section className="pt-section" aria-labelledby="pt-examples">
          <h2 className="cl-h2" id="pt-examples">Example appointments (preview)</h2>
          <p className="cl-small">These show the demo profile how booked consultations look. They are not real patients: patients book in the separate patient app, which isn't linked to this preview yet.</p>
          {examples.map(item => (
            <article key={item.id} id={`c-${item.id}`} className="pt-card pt-row">
              <div className="pt-row-text">
                <p className="pt-patient">{item.patientName} <span className="cl-small">· example</span></p>
                <p className="cl-label">{item.at ? whenText(new Date(item.at)) : "Now"} · ref {item.ref} · 30 min video</p>
                <ol className="pt-questions">{questionLines(item).map((line, index) => <li key={index}>{line}</li>)}</ol>
              </div>
            </article>
          ))}
        </section>
      )}
      <section className="pt-section" aria-labelledby="pt-done">
        <h2 className="cl-h2" id="pt-done">Finished</h2>
        {finished.length === 0 ? <p className="cl-small">Finished consultations, with their transcripts and your notes, are kept here.</p> : finished.map(item => (
          <article key={item.id} className="pt-card">
            <p className="cl-label">{item.at ? whenText(new Date(item.at)) : ""} · {ref(item)} · £{item.price} paid</p>
            {item.summary && <p className="pt-summary"><strong>Your summary for the patient</strong>{item.summary}</p>}
            {item.notes && <p className="pt-summary is-private"><strong>Your notes (only you)</strong>{item.notes}</p>}
            <Transcript lines={item.transcript} name={`Rehyn consultation ${item.ref}`} />
          </article>
        ))}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- group sessions

export function PortalSessions({ me }: { me: Clinician }) {
  const now = useMinute();
  const created = useCreatedSessions();
  const asked = useSessionQuestions();
  const places = usePlaces();
  const sessions = upcomingSessions(created, new Date(now)).filter(session => session.clinicianId === me.id);
  const groups = clinicianGroups(me).length ? clinicianGroups(me).map(place => place.group) : librarySections.flatMap(section => section.groups);
  const times = useMemo(() => freeTimes(me, new Date(now), 24 * 14), [me]); // eslint-disable-line react-hooks/exhaustive-deps
  const [title, setTitle] = useState("");
  const [about, setAbout] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>(groups[0] ? [groups[0].id] : []);
  const toggleGroup = (id: string) => setGroupIds(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]));
  const [start, setStart] = useState("now");
  const [minutes, setMinutes] = useState(45);
  const [spaces, setSpaces] = useState(15);
  const [weekly, setWeekly] = useState(false);
  const [price, setPrice] = useState("");
  const [done, setDone] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const checkHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (confirming) checkHeading.current?.focus(); }, [confirming]);
  const at = start === "now" ? null : Number(start);
  const pounds = Math.min(MAX_SESSION_PRICE, Math.max(0, Math.round(Number(price) || 0)));
  const chosenGroups = groups.filter(group => groupIds.includes(group.id));
  const create = () => {
    addSession({ ...newSession({ clinicianId: me.id, title: title.trim(), about: about.trim() || "Bring your questions.", start: at ?? Date.now() + 60_000, minutes, spaces, groupIds: chosenGroups.map(group => group.id), price: pounds }), weekly });
    setTitle(""); setAbout(""); setPrice(""); setConfirming(false); setDone(true);
  };
  return (
    <div className="pt-page">
      <Head kicker="Meet more patients at once" title="Group sessions" />
      <p className="cl-lead">Answer questions for a group to grow your reach. Your sessions are listed on the Clinicians tab, so new patients can find you and see how you work before they book a consultation. You set the price: keep it free, or charge for each place.</p>
      <div className="pt-cols">
        <section className="pt-section pt-wide" aria-labelledby="pt-up">
          <h2 className="cl-h2" id="pt-up">Coming up</h2>
          {sessions.length === 0 ? <p className="cl-small">No sessions yet. Start one on the right.</p> : sessions.map(session => {
            const questions = asked[session.id] ?? [];
            return (
              <div key={session.id} className="pt-session">
                <SessionCard session={session} now={now} host />
                <div className="pt-session-extra">
                  <p className="cl-small">{places.includes(session.id) ? "1 place saved on this device" : "No places saved on this device yet"} · {session.spaces} places in all{session.weekly ? " · repeats weekly" : ""}</p>
                  {questions.length > 0 && <div className="pt-asked"><p className="cl-label">Sent in advance · names hidden</p>{questions.map((question, index) => <p key={index}>“{question}”</p>)}</div>}
                  {!session.id.startsWith("s-") ? null : <button type="button" className="cl-clear" onClick={() => removeSession(session.id.replace(/-w\d+$/, ""))}>Cancel {session.weekly ? "every week" : "this session"}</button>}
                </div>
              </div>
            );
          })}
        </section>
        {confirming ? (
          <section className="pt-card pt-form" aria-labelledby="pt-check">
            <h2 className="cl-h2" id="pt-check" ref={checkHeading} tabIndex={-1}>Check your session</h2>
            <p className="cl-small">This is how patients will see it on the Clinicians tab.</p>
            <div className="pt-listing">
              <span className="cl-label">How it will be listed</span>
              <strong>{title.trim()}</strong>
              {about.trim() && <span>{about.trim()}</span>}
              <span>{at ? whenText(new Date(at), new Date(now)) : "Starting now"} · {minutes} min · {sessionPriceText({ price: pounds })} · {weekly ? "every week" : "one-off"}</span>
              <span>{spaces} places · listed with {chosenGroups.map(group => group.title).join(", ")}</span>
            </div>
            <button type="button" className="cl-request" onClick={create}>Confirm and add</button>
            <button type="button" className="cl-btn is-light" onClick={() => setConfirming(false)}>Go back and edit</button>
          </section>
        ) : (
        <form className="pt-card pt-form" onSubmit={event => { event.preventDefault(); if (title.trim() && groupIds.length) { setDone(false); setConfirming(true); } }}>
          <h2 className="cl-h2">Start a new session</h2>
          <label className="cl-field"><span className="cl-label">Title</span><input className="cl-text" value={title} maxLength={80} onChange={event => { setTitle(event.target.value); setDone(false); }} placeholder="Your questions about…" required /></label>
          <label className="cl-field"><span className="cl-label">What it's about</span><input className="cl-text" value={about} maxLength={160} onChange={event => setAbout(event.target.value)} placeholder="One line on who it's for" /></label>
          <div className="cl-field" role="group" aria-labelledby="pt-listed-with">
            <span className="cl-label" id="pt-listed-with">Listed with · choose one or more</span>
            <div className="pt-pick">{groups.map(group => <button key={group.id} type="button" aria-pressed={groupIds.includes(group.id)} onClick={() => toggleGroup(group.id)}>{group.title}</button>)}</div>
          </div>
          <div className="cl-form-row">
            <label className="cl-field"><span className="cl-label">When</span>
              <select className="cl-text" value={start} onChange={event => setStart(event.target.value)}>
                <option value="now">Now (to try it out)</option>
                {times.map(time => <option key={time.getTime()} value={time.getTime()}>{whenText(time, new Date(now))}</option>)}
              </select>
            </label>
            <label className="cl-field"><span className="cl-label">Length</span>
              <select className="cl-text" value={minutes} onChange={event => setMinutes(Number(event.target.value))}>{[30, 45, 60].map(value => <option key={value} value={value}>{value} minutes</option>)}</select>
            </label>
            <label className="cl-field"><span className="cl-label">Places</span>
              <select className="cl-text" value={spaces} onChange={event => setSpaces(Number(event.target.value))}>{[5, 8, 15, 20].map(value => <option key={value} value={value}>{value}</option>)}</select>
            </label>
          </div>
          <label className="cl-field pt-price-field"><span className="cl-label">Price per place</span>
            <span className="pt-price-input"><strong aria-hidden="true">£</strong><input type="number" inputMode="numeric" min={0} max={MAX_SESSION_PRICE} step={1} value={price} placeholder="0" aria-label="Price per place in pounds" aria-describedby="pt-price-hint" onChange={event => setPrice(event.target.value)} /></span>
            <span className="cl-small" id="pt-price-hint">Leave it at 0 to make the session free.</span>
          </label>
          <label className="cl-check"><input type="checkbox" checked={weekly} onChange={() => setWeekly(!weekly)} />Repeat every week</label>
          <button type="submit" className="cl-request" disabled={!title.trim() || !groupIds.length}>Add the session</button>
          {!groupIds.length && <p className="cl-small">Choose at least one condition area to list it with.</p>}
          {done && <p className="cl-small" role="status">Added. It shows under Weekly group sessions on the Clinicians tab.</p>}
        </form>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------- earnings

type Money = "all" | "held" | "paid" | "released";
const MONEY_TEXT: Record<Consultation["payment"], string> = { none: "Not paid yet", held: "Held", paid: "Paid", released: "Released" };

export function PortalEarnings({ me }: { me: Clinician }) {
  const list = useConsultations();
  const [show, setShow] = useState<Money>("all");
  const now = Date.now();
  const mine = list.filter(item => item.clinicianId === me.id && item.payment !== "none");
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const held = mine.filter(item => item.payment === "held");
  const paidMonth = mine.filter(item => item.payment === "paid" && (item.at ?? item.createdAt) >= monthStart);
  const rows = mine.filter(item => show === "all" || item.payment === show).sort((a, b) => (b.at ?? b.createdAt) - (a.at ?? a.createdAt));
  return (
    <div className="pt-page">
      <Head kicker={new Date(now).toLocaleDateString("en-GB", { month: "long", year: "numeric" })} title="Earnings & payouts" />
      <div className="pt-stats">
        <p className="pt-stat"><span>Held now · yours</span><strong>{poundsText(clinicianShare(held.reduce((sum, item) => sum + item.price, 0)))}</strong><span>{held.length} booked, paid when you finish each one</span></p>
        <p className="pt-stat"><span>Paid this month · yours</span><strong>{poundsText(clinicianShare(paidMonth.reduce((sum, item) => sum + item.price, 0)))}</strong><span>{paidMonth.length} consultation{paidMonth.length === 1 ? "" : "s"}, after Rehyn's {shareText(REHYN_SHARE)} share</span></p>
      </div>
      <section className="pt-flow" aria-labelledby="pt-flow">
        <h2 className="cl-h2" id="pt-flow">How a payment moves</h2>
        <ol>
          <li><strong>1 · Patient books</strong>Their card is authorised and the amount held.</li>
          <li><strong>2 · You finish the call</strong>"Finish consultation" takes the held amount.</li>
          <li><strong>3 · Paid out on Friday</strong>Everything finished by Thursday night goes out that Friday.</li>
        </ol>
      </section>
      <section className="pt-card" aria-labelledby="pt-money-list">
        <div className="pt-card-head">
          <h2 className="cl-h2" id="pt-money-list">Consultations</h2>
          <div className="pt-tabs" role="group" aria-label="Show">
            {([["all", "All"], ["held", "Held"], ["paid", "Paid"], ["released", "Released"]] as [Money, string][]).map(([id, label]) => <button key={id} type="button" aria-pressed={show === id} onClick={() => setShow(id)}>{label}</button>)}
          </div>
        </div>
        {rows.length === 0 ? <p className="cl-small">Nothing here yet.</p> : (
          <div className="pt-table-wrap">
            <table className="pt-table">
              <thead><tr><th>When</th><th>Reference</th><th>Kind</th><th>Patient paid</th><th>Yours</th><th>Status</th></tr></thead>
              <tbody>{rows.map(item => (
                <tr key={item.id}>
                  <td>{item.at ? whenText(new Date(item.at)) : whenText(new Date(item.createdAt))}</td>
                  <td>{item.ref}</td>
                  <td>{item.urgent ? "Urgent" : "Consultation"}</td>
                  <td className="pt-amount">£{item.price}</td>
                  <td className="pt-amount">{poundsText(clinicianShare(item.price))}</td>
                  <td><span className={`pt-chip is-${item.payment}`}>{MONEY_TEXT[item.payment]}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      <p className="cl-small">Rehyn's share is {shareText(REHYN_SHARE)} of what each patient pays; you receive the other {shareText(1 - REHYN_SHARE)}, shown as "Yours".</p>
    </div>
  );
}
