import { useState } from "react";
import { CONSULTATION_MINUTES, upcomingSessions, works, type Clinician, type Hours, type UrgentAlerts } from "@/content/clinicians";
import { updateClinician } from "@/lib/clinician-portal";
import { busyTimes, useConsultations, useCreatedSessions } from "@/lib/consultations";

// Schedule & availability in the clinician portal: this week at a glance, the usual week (which days, from when to
// when), time off, and when urgent requests reach you. Patients can only ask for hours that are open here.

const DAYS: [number, string, string][] = [[1, "Mon", "Monday"], [2, "Tue", "Tuesday"], [3, "Wed", "Wednesday"], [4, "Thu", "Thursday"], [5, "Fri", "Friday"], [6, "Sat", "Saturday"], [0, "Sun", "Sunday"]];
const FIRST_HOUR = 7;
const LAST_HOUR = 21;
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, index) => FIRST_HOUR + index);
const hourText = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

type Day = { on: boolean; from: number; to: number };

/** The usual week, one range a day, from the clinician's hours. */
export function weekFromSchedule(schedule: Hours[]): Record<number, Day> {
  const week: Record<number, Day> = {};
  for (const [day] of DAYS) {
    const hours = schedule.find(entry => entry.days.includes(day));
    week[day] = hours ? { on: true, from: hours.from, to: hours.to } : { on: false, from: 9, to: 17 };
  }
  return week;
}

/** Back to hours: days with the same times share one entry. */
export function scheduleFromWeek(week: Record<number, Day>): Hours[] {
  const byTimes = new Map<string, Hours>();
  for (const [day] of DAYS) {
    const entry = week[day];
    if (!entry?.on || entry.to <= entry.from) continue;
    const key = `${entry.from}-${entry.to}`;
    const hours = byTimes.get(key) ?? { days: [], from: entry.from, to: entry.to };
    hours.days.push(day);
    byTimes.set(key, hours);
  }
  return Array.from(byTimes.values());
}

/** The week in a few lines: neighbouring days with the same hours share a line ("Mon – Fri", "Sat, Sun"). */
export function summariseWeek(week: Record<number, Day>): { days: string; hours: string }[] {
  const keyOf = (day: number) => (week[day]?.on && week[day].to > week[day].from ? `${week[day].from}-${week[day].to}` : "off");
  const runs: { key: string; names: string[] }[] = [];
  for (const [day, short] of DAYS) {
    const key = keyOf(day);
    const last = runs[runs.length - 1];
    if (last && last.key === key) last.names.push(short); else runs.push({ key, names: [short] });
  }
  return runs.map(({ key, names }) => {
    const days = names.length > 2 ? `${names[0]} – ${names[names.length - 1]}` : names.join(", ");
    if (key === "off") return { days, hours: "Not working" };
    const [from, to] = key.split("-").map(Number);
    return { days, hours: `${hourText(from)} – ${hourText(to)}` };
  });
}

const URGENT: [UrgentAlerts, string][] = [
  ["always", "Always, even when I'm busy"],
  ["free48", "When I'm free in the next 48 hours"],
  ["today", "Only when I'm free today"],
  ["never", "Never"],
];

export default function PortalSchedule({ me }: { me: Clinician }) {
  const list = useConsultations();
  const created = useCreatedSessions();
  const [week, setWeek] = useState(() => weekFromSchedule(me.schedule));
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Array.from({ length: 7 }, (_, index) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + index));
  const booked = busyTimes(list, me.id);
  const sessions = upcomingSessions(created, now).filter(session => session.clinicianId === me.id);
  const change = (day: number, patch: Partial<Day>) => {
    setWeek(current => {
      const next = { ...current[day], ...patch };
      if (next.to <= next.from) next.to = Math.min(next.from + 1, LAST_HOUR); // "to" always comes after "from"
      return { ...current, [day]: next };
    });
    setSaved(false);
  };
  const startEditing = () => { setWeek(weekFromSchedule(me.schedule)); setSaved(false); setEditing(true); };
  const cancel = () => { setWeek(weekFromSchedule(me.schedule)); setEditing(false); };
  const save = () => { updateClinician(me.id, { schedule: scheduleFromWeek(week) }); setSaved(true); setEditing(false); };
  const summary = summariseWeek(weekFromSchedule(me.schedule));
  const cell = (day: Date, hour: number) => {
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour).getTime();
    if (booked.some(start => Math.abs(start - at) < 3_600_000)) return { kind: "booked", text: "Booked" };
    const session = sessions.find(entry => entry.start >= at && entry.start < at + 3_600_000);
    if (session) return { kind: "session", text: "Group" };
    return works(me, new Date(at)) ? { kind: "open", text: "" } : { kind: "closed", text: "" };
  };

  return (
    <div className="pt-page">
      <div className="pt-head">
        <div>
          <p className="cl-kicker">When patients can book you</p>
          <h1 className="cl-h1" data-page-heading>Schedule &amp; availability</h1>
        </div>
        <div className="pt-head-actions"><button type="button" className="cl-btn is-light" disabled title="Coming soon">Connect Google or Outlook calendar · soon</button></div>
      </div>

      <div className="pt-cols">
        <section className="pt-card pt-wide" aria-labelledby="pt-week-h">
          <div className="pt-card-head">
            <h2 className="cl-h2" id="pt-week-h">The next 7 days</h2>
            <div className="pt-legend" aria-hidden="true"><span className="is-open">Open</span><span className="is-booked">Booked</span><span className="is-session">Group session</span></div>
          </div>
          <div className="pt-grid-wrap">
            <table className="pt-grid">
              <caption className="cl-sr">Your hours over the next 7 days</caption>
              <thead><tr><th scope="col"><span className="cl-sr">Time</span></th>{days.map(day => <th key={day.toDateString()} scope="col">{day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}</th>)}</tr></thead>
              <tbody>
                {HOURS.map(hour => (
                  <tr key={hour}>
                    <th scope="row">{hourText(hour)}</th>
                    {days.map(day => { const value = cell(day, hour); return <td key={day.toDateString()} className={`is-${value.kind}`}>{value.text}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="cl-small">Green hours are open for patients to book. Each consultation lasts {CONSULTATION_MINUTES} minutes and starts on the hour. Patients can only request times within the next 48 hours.</p>
        </section>

        <div className="pt-stack">
          <section className="pt-card" aria-labelledby="pt-usual">
            <h2 className="cl-h2" id="pt-usual">Hours I'm available each week</h2>
            {!editing ? <>
              <dl className="pt-week-summary">
                {summary.map(row => (
                  <div key={row.days} className={row.hours === "Not working" ? "is-off" : ""}><dt>{row.days}</dt><dd>{row.hours}</dd></div>
                ))}
              </dl>
              <button type="button" className="cl-btn is-light" onClick={startEditing}>Change hours</button>
              {saved && <p className="cl-small" role="status">Saved. Patients now see these hours. Anything already booked stays booked.</p>}
            </> : <>
              <p className="cl-small">Switch off any day you don't work.</p>
              <div className="pt-week-edit">
                {DAYS.map(([day, short, long]) => (
                  <div key={day} className={`pt-day${week[day].on ? "" : " is-off"}`}>
                    <label className="pt-dayswitch">
                      <input type="checkbox" role="switch" checked={week[day].on} aria-label={`Working on ${long}`} onChange={event => change(day, { on: event.target.checked })} />
                      <span className="pt-day-name" aria-hidden="true">{short}</span>
                    </label>
                    {week[day].on ? (
                      <span className="pt-day-hours">
                        <select aria-label={`${long} from`} value={week[day].from} onChange={event => change(day, { from: Number(event.target.value) })}>{HOURS.map(hour => <option key={hour} value={hour}>{hourText(hour)}</option>)}</select>
                        <span aria-hidden="true">to</span>
                        <select aria-label={`${long} to`} value={week[day].to} onChange={event => change(day, { to: Number(event.target.value) })}>{[...HOURS.slice(1), LAST_HOUR].filter(hour => hour > week[day].from).map(hour => <option key={hour} value={hour}>{hourText(hour)}</option>)}</select>
                      </span>
                    ) : <span className="pt-day-off">Not working</span>}
                  </div>
                ))}
              </div>
              <div className="pt-week-actions">
                <button type="button" className="cl-btn" onClick={save}>Save my hours</button>
                <button type="button" className="cl-btn is-light" onClick={cancel}>Cancel</button>
              </div>
            </>}
          </section>

          <section className="pt-card" aria-labelledby="pt-urgent-h">
            <h2 className="cl-h2" id="pt-urgent-h">Urgent requests</h2>
            <div className="pt-radios" role="radiogroup" aria-labelledby="pt-urgent-h">
              {URGENT.map(([value, label]) => (
                <label key={value} className="cl-check"><input type="radio" name="urgent" checked={(me.urgentAlerts ?? "free48") === value} onChange={() => updateClinician(me.id, { urgentAlerts: value })} />{label}</label>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
