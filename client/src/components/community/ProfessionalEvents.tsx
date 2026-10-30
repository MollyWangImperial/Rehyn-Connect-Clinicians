import { useId } from "react";
import { Link } from "wouter";
import { CalendarCheck, MapPin, Monitor, Users } from "lucide-react";
import { people } from "@/content/community-samples";
import { PROFESSIONAL_EVENTS, eventStart, isJoined, setJoined, useEventChoices, type ProfessionalEvent } from "@/content/professional-events";
import { useMinute } from "../clinicians/GroupSessions";
import { Face } from "./parts";
import "./professional-events.css";

const dateText = (date: Date) => date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const timeText = (date: Date) => date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const lengthText = (minutes: number) => (minutes >= 120 ? `${Math.round(minutes / 60)} hours` : `${minutes} min`);

/** One event, as a ticket-like row: the date block, what and who, where, and joining or leaving. */
function EventCard({ event, joined, now }: { event: ProfessionalEvent; joined: boolean; now: number }) {
  const titleId = useId();
  const start = eventStart(event, now);
  const end = new Date(start.getTime() + event.minutes * 60_000);
  return (
    <article className="cx-card pe-card" aria-labelledby={titleId}>
      <div className="pe-date" aria-hidden="true">
        <span>{start.toLocaleDateString("en-GB", { month: "short" })}</span>
        <strong>{start.getDate()}</strong>
        <span>{start.toLocaleDateString("en-GB", { weekday: "short" })}</span>
      </div>
      <div className="pe-main">
        <p className="pe-kind"><span className="cx-pill">{event.kind}</span><span>{event.cpd} CPD {event.cpd === 1 ? "hour" : "hours"}</span></p>
        <h3 className="pe-title" id={titleId}>{event.title}</h3>
        <p className="pe-line"><CalendarCheck size={15} aria-hidden="true" />{`${dateText(start)}, ${timeText(start)}–${timeText(end)} · ${lengthText(event.minutes)}`}</p>
        <p className="pe-line">{event.format === "Online" ? <Monitor size={15} aria-hidden="true" /> : <MapPin size={15} aria-hidden="true" />}{`${event.format} · ${event.venue}`}</p>
        <p className="pe-line pe-organiser">
          Organised by{" "}
          {event.organiser.who
            ? <Link href={`~/clinicians/${people[event.organiser.who].clinicianId}`}>{event.organiser.name}</Link>
            : <span>{event.organiser.name}</span>}
        </p>
        <p className="pe-about">{event.about}</p>
        <div className="pe-foot">
          <span className="pe-going">
            <span className="pe-faces" aria-hidden="true">{event.going.slice(0, 4).map(who => <Face key={who} who={who} size={26} />)}</span>
            <Users size={15} aria-hidden="true" />{`${event.going.length} from your network${joined ? " and you" : ""} going · ${event.places} places`}
          </span>
          {joined
            ? <button type="button" className="cx-btn" onClick={() => setJoined(event.id, false)}>Leave<span className="cm-sr">{` ${event.title}`}</span></button>
            : <button type="button" className="cx-btn cx-btn-primary" onClick={() => setJoined(event.id, true)}>Join event<span className="cm-sr">{`: ${event.title}`}</span></button>}
        </div>
      </div>
    </article>
  );
}

/**
 * My professional events (/community?space=events, comment 4): the peer events the clinician has joined with other
 * clinicians in the network, soonest first, and more events from the network to join. Patient consultations and the
 * weekly patient Q&A sessions have their own pages.
 */
export default function ProfessionalEventsView() {
  const saved = useEventChoices();
  const now = useMinute();
  const live = PROFESSIONAL_EVENTS.filter(event => eventStart(event, now).getTime() + event.minutes * 60_000 > now)
    .sort((a, b) => eventStart(a, now).getTime() - eventStart(b, now).getTime());
  const joined = live.filter(event => isJoined(event, saved));
  const more = live.filter(event => !isJoined(event, saved));
  return (
    <div className="pe-page">
      <header className="pe-head">
        <h1 className="pe-h1" tabIndex={-1} data-view-heading>My professional events</h1>
        <p className="pe-intro">Conferences, journal clubs, MDT meetings and workshops you have joined with other clinicians in your network. Patient appointments are in <Link href="~/clinicians/portal/consultations">My consultations</Link>, and your Q&A sessions with patients in <Link href="/community?space=circle">Group weekly sessions</Link>.</p>
        <p className="pe-preview">Preview: these events are examples, and joining one is kept on this device.</p>
      </header>
      <section aria-labelledby="pe-joined">
        <h2 className="pe-h2" id="pe-joined">Joined <span className="cx-pill">{joined.length}</span></h2>
        {joined.length ? <div className="pe-list">{joined.map(event => <EventCard key={event.id} event={event} joined now={now} />)}</div>
          : <p className="pe-empty">You haven't joined any upcoming events. Events from your network are below.</p>}
      </section>
      {more.length > 0 && (
        <section aria-labelledby="pe-more">
          <h2 className="pe-h2" id="pe-more">More events from your network</h2>
          <div className="pe-list">{more.map(event => <EventCard key={event.id} event={event} joined={false} now={now} />)}</div>
        </section>
      )}
    </div>
  );
}
