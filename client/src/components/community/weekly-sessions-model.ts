// The signed-in clinician's group weekly sessions with patients (comments 18 and 20): which sittings they host, where
// each one stands, and the plain words the session view and the feed's card show for them. The sittings themselves
// come from content/clinicians.ts (the weekly series and sessions set up in the portal, lib/consultations.ts).

import { clockText, dayText, groupPlace, sessionGroupIds, upcomingSessions, type GroupSession } from "@/content/clinicians";

export type SessionStatus = "upcoming" | "soon" | "live" | "finished";

const MINUTE = 60_000;
const WEEK = 7 * 86_400_000;
/** A sitting "opens soon" in the hour before it starts (its room opens ten minutes before: clinicians.ts sessionOpen). */
export const SOON_MINUTES = 60;

export const STATUS_TEXT: Record<SessionStatus, string> = { upcoming: "Upcoming", soon: "Opens soon", live: "Live now", finished: "Finished" };

export const sessionEnd = (session: GroupSession) => session.start + session.minutes * MINUTE;

export function sessionStatus(session: GroupSession, now: number): SessionStatus {
  if (now >= sessionEnd(session)) return "finished";
  if (now >= session.start) return "live";
  if (now >= session.start - SOON_MINUTES * MINUTE) return "soon";
  return "upcoming";
}

export type HostedSessions = { coming: GroupSession[]; finished: GroupSession[] };

/** A clinician's sittings: those still to come or running (soonest first), and those that finished in the last week
 *  (latest first). A weekly one's previous sitting is the one that was next a week ago, with the same id it had then. */
export function hostedSessions(created: GroupSession[], clinicianId: string, now: number): HostedSessions {
  const mine = (session: GroupSession) => session.clinicianId === clinicianId;
  const coming = upcomingSessions(created, new Date(now)).filter(mine);
  const finished = upcomingSessions(created, new Date(now - WEEK))
    .filter(session => mine(session) && sessionEnd(session) <= now)
    .sort((a, b) => b.start - a.start);
  return { coming, finished };
}

/** The Library groups a session is listed with, as patients know them: "Stroke, Blood pressure". */
export function patientGroupText(session: GroupSession): string {
  const titles = sessionGroupIds(session).map(id => groupPlace(id)?.group.title).filter((title): title is string => !!title);
  return titles.length ? titles.join(", ") : "Open to all patients";
}

/** "18:00–18:45". */
export const timeRangeText = (session: GroupSession) => `${clockText(new Date(session.start))}–${clockText(new Date(sessionEnd(session)))}`;

/** "Thu 5 Nov, 18:00–18:45", or "Today, 18:00–18:45". */
export const scheduleText = (session: GroupSession, now: number) => `${dayText(new Date(session.start), new Date(now))}, ${timeRangeText(session)}`;

/** The session view, with one sitting open: /community?space=circle&session=<id>. */
export const sessionViewHref = (session?: Pick<GroupSession, "id"> | null) =>
  session ? `/community?space=circle&session=${encodeURIComponent(session.id)}` : "/community?space=circle";

/** Where a clinician schedules and manages sessions. */
export const SCHEDULE_HREF = "/clinicians/portal/sessions";
