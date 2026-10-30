// Example patient appointments for the demo clinician (Dr Amara Osei), so My Consultations has something to show in the
// preview. Patients book in the patient edition, which is a separate site with its own browser storage, so their real
// requests can't reach this one until there is a shared consultations service. These examples are kept apart from the
// consultations stored on this device (lib/consultations.ts) and are always labelled as examples where they appear.

import type { Consultation } from "@/lib/consultations";

export type PreviewConsultation = Consultation & { patientName: string; preview: true };

const HOUR = 3_600_000;

/** Today and the next few days, on the hour or half hour, from `now`. */
function at(now: number, days: number, hour: number, minute = 0) {
  const day = new Date(now);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + days, hour, minute).getTime();
}

export function previewConsultations(clinicianId: string, now = Date.now()): PreviewConsultation[] {
  if (clinicianId !== "amara-osei") return [];
  // The first one later today in clinic hours, or tomorrow morning once today's clinic is over.
  const soon = at(now, 0, 16) - HOUR > now ? at(now, 0, 16) : at(now, 1, 9, 30);
  const rows: [string, string, number, string][] = [
    ["preview-c1", "Margaret H.", soon, "Is my blood pressure low enough now?\nCan I stop the clopidogrel after 3 months?"],
    ["preview-c2", "David K.", at(now, 1, 11), "When can I drive again after my TIA?"],
    ["preview-c3", "Priya S.", at(now, 3, 14, 30), "My hand is still weak. Should I ask for more physio?\nIs it normal to feel this tired?"],
  ];
  return rows.map(([id, patientName, when, questions], index) => ({
    id, ref: `EX${index + 1}AMR`, room: `${id}-room`, urgent: false, clinicianId, price: 85, times: [when], questions, status: "scheduled", at: when,
    payment: "held", answered: [], alertedAt: null, escalatedAt: null, createdAt: now - 86_400_000, steps: [], transcript: [], patientName, preview: true,
  }));
}
