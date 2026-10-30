import { Link } from "wouter";
import { Video } from "lucide-react";
import { CONSULTATION_MINUTES, dayText, clockText } from "@/content/clinicians";
import { previewConsultations } from "@/content/consultation-preview";
import { useConsultations } from "@/lib/consultations";
import { useMe } from "@/lib/me";
import { useMinute } from "../clinicians/GroupSessions";
import "./consultations-card.css";

/** An appointment on the card: who with, when, and where its details are. */
export type Appointment = { id: string; patient: string; at: number; urgent: boolean; preview: boolean; href: string };

/** How long after its start a consultation still counts as coming up (it may be running). */
const RUNNING_MS = 30 * 60_000;

/**
 * The signed-in clinician's upcoming patient consultations, soonest first: the confirmed ones kept on this device
 * (lib/consultations.ts, the same list the clinician portal shows), then, for the demo profile, the preview's example
 * appointments (content/consultation-preview.ts). The card shows both alike; the portal labels the examples.
 */
export function useMyConsultations(): Appointment[] {
  const me = useMe();
  const list = useConsultations();
  const now = useMinute();
  const stored = list
    .filter(item => item.clinicianId === me.clinician.id && item.status === "scheduled" && item.at !== null && item.at + RUNNING_MS > now)
    .map(item => ({ id: item.id, patient: item.patientName ?? `Patient · ref ${item.ref}`, at: item.at as number, urgent: item.urgent, preview: false, href: `/clinicians/portal/consultations#c-${item.id}` }));
  const examples = previewConsultations(me.clinician.id, now)
    .filter(item => (item.at ?? 0) + RUNNING_MS > now)
    .map(item => ({ id: item.id, patient: item.patientName, at: item.at as number, urgent: false, preview: true, href: `/clinicians/portal/consultations#c-${item.id}` }));
  return [...stored, ...examples].sort((a, b) => a.at - b.at);
}

/**
 * My Consultations, in the feed's right lane where the patient edition has the Library card (comment 9): the next
 * few patient appointments, each linking to its consultation in the clinician portal, or a short note when none are
 * booked.
 */
export default function ConsultationsCard() {
  const appointments = useMyConsultations();
  const now = new Date();
  const shown = appointments.slice(0, 4);
  return (
    <section className="cx-card cc-card" aria-labelledby="cc-title">
      <div className="cc-head">
        <h2 className="cc-title" id="cc-title">My Consultations</h2>
        <Link className="cc-all" href="~/clinicians/portal/consultations">See all<span className="cm-sr"> consultations</span></Link>
      </div>
      {shown.length === 0 ? (
        <p className="cc-empty">No upcoming patient appointments. Confirmed requests appear here.</p>
      ) : (
        <ul className="cc-list">
          {shown.map(item => (
            <li key={item.id}>
              <Link className="cc-row" href={`~${item.href}`}>
                <span className="cc-when"><b>{dayText(new Date(item.at), now)}</b><span>{clockText(new Date(item.at))}</span></span>
                <span className="cc-who">
                  <b>{item.patient}</b>
                  {/* Every consultation is by video, so the card gives only its length (and urgency). */}
                  <span>{item.urgent ? `Urgent · ${CONSULTATION_MINUTES} min` : `${CONSULTATION_MINUTES} min`}</span>
                </span>
                <Video size={16} aria-hidden="true" className="cc-icon" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
