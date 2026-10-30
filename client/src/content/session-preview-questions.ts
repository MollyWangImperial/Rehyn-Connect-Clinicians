// Example patient questions for the Group weekly sessions view (components/community/WeeklySessions.tsx), as a preview
// fixture. Patients send their questions from the patient edition of Rehyn Connect, which is a separate deployment with
// no shared backend yet, so no real question reaches a clinician here unless it was sent on this device
// (lib/consultations.ts askInAdvance). These show how questions will look. They are never added to the real list: the
// view shows them on their own, under an "Example questions (preview)" label, and only while a session has no real ones.

import type { GroupSession } from "./clinicians";

/** By weekly series id (content/clinicians.ts WEEKLY_SESSIONS). */
const BY_SERIES: Record<string, string[]> = {
  "stroke-prevention-qa": [
    "My blood pressure is fine at the GP but high at home. Which reading should I trust?",
    "I was started on a statin and apixaban. How long will I need to take them?",
    "Is it safe to fly six weeks after a TIA?",
  ],
  "young-stroke-qa": [
    "I'm 42 and they never found a cause. Does that make another stroke more likely?",
    "When can I talk to my employer about a phased return, and what should I ask for?",
    "How do I explain the fatigue to my children?",
  ],
  "moving-after-stroke": [
    "My leg gives way on stairs when I'm tired. What can I practise at home?",
    "Should I use my stick indoors, or will that slow my recovery?",
  ],
  "low-mood-after-illness": [
    "Everyone says I've done well, so why do I feel worse now than in hospital?",
    "Is it normal to be frightened every time I get a headache?",
  ],
  "diabetes-questions": [
    "My HbA1c went from 58 to 64. What usually causes a jump like that?",
    "Do I need to check my sugar before exercise on metformin?",
  ],
  "heart-recovery": [
    "How do I know if chest tightness on a walk is angina or just being unfit?",
    "When can I go back to swimming?",
  ],
  "words-and-swallowing": [
    "My husband finishes my sentences. How can he help without taking over?",
    "Are thickened drinks forever, or can swallowing improve?",
  ],
};

/** For a session set up in the portal, which has no series of its own. */
const GENERAL = [
  "What should I keep a note of before my next review?",
  "Which symptoms mean I should call 999 rather than wait?",
];

/** The weekly series a dated sitting belongs to: "stroke-prevention-qa-20261105" is "stroke-prevention-qa". */
const seriesOf = (session: Pick<GroupSession, "id">) => session.id.replace(/-\d{8}$/, "");

/** Example questions for a session (preview only, never real patients' words). */
export const previewQuestions = (session: Pick<GroupSession, "id">): string[] => BY_SERIES[seriesOf(session)] ?? GENERAL;
