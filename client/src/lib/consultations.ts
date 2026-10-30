// Consultations with clinicians, as a preview: the clinicians are examples, so a request, the payment hold and the
// transcript are kept on this device only (localStorage), and the clinician portal on the same device answers them.
// Every tab on the device sees the same list, so a request sent in one tab shows up in the portal open in another.
//
// The two ways a consultation goes:
//   Not urgent: the patient picks the times that suit them in the next 48 hours and writes their questions, the payment
//     is held, and the request goes to the clinician they chose. The clinician picks one of the times (or declines, and
//     the hold is released). After the call the clinician finishes it, and only then is the payment taken.
//   Urgent: every clinician free in the next 48 hours is alerted. The first to answer is matched; the patient can move
//     on to the next free clinician instead. Then the payment is held and the call starts. If no one answers in five
//     minutes, the Rehyn team is told (server/urgent-alert.ts), with no health details.
// Payments are not taken yet: "held" and "paid" are what will happen through Stripe, and the page says so.

import { useSyncExternalStore } from "react";
import { URGENT_FEE, alertable, allClinicians, findClinician, urgentPrice, type Clinician, type GroupSession } from "@/content/clinicians";

export type Status = "requested" | "scheduled" | "declined" | "matching" | "matched" | "escalated" | "done" | "cancelled";
export type Payment = "none" | "held" | "paid" | "released";
export type Speaker = "patient" | "clinician";
export type TranscriptLine = { at: number; who: Speaker; name: string; text: string };
export type Step = { at: number; what: string };

export type Consultation = {
  id: string;
  /** Six letters and numbers, for the patient and the team to refer to it (and the only thing the team's alert holds). */
  ref: string;
  /** The meeting room's address: /clinicians/meet/<room>. */
  room: string;
  urgent: boolean;
  /** Who it is with; null while an urgent request waits for an answer. */
  clinicianId: string | null;
  price: number;
  /** The times the patient could meet (not urgent). */
  times: number[];
  questions: string;
  status: Status;
  /** When it happens, once agreed. */
  at: number | null;
  payment: Payment;
  /** Urgent: the clinicians who answered, in order. */
  answered: string[];
  /** Urgent: when the clinicians were alerted, and when the team was told no one had answered. */
  alertedAt: number | null;
  escalatedAt: number | null;
  createdAt: number;
  steps: Step[];
  transcript: TranscriptLine[];
  /** Other times the clinician offered when none of the patient's suited them. */
  suggested?: number[];
  /** The clinician's own: which questions they ticked off in the call (by line), and private notes. */
  ticked?: number[];
  notes?: string;
  /** What the clinician sent the patient at the end, and whether they suggested a follow-up. */
  summary?: string;
  followUp?: boolean;
  /** The name the patient shows the clinician. Requests made before it existed have none (shown by reference). */
  patientName?: string;
};

/** The patient's questions, one per line. */
export const questionLines = (consultation: Consultation) => consultation.questions.split("\n").map(line => line.trim()).filter(Boolean);

/** How long an urgent request waits for a clinician before the Rehyn team is told. */
export const URGENT_WAIT_MS = 5 * 60_000;

const randomText = (length: number, letters: string) => {
  const values = new Uint32Array(length);
  globalThis.crypto.getRandomValues(values);
  return Array.from(values, value => letters[value % letters.length]).join("");
};
const newRef = () => randomText(6, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
const newRoom = () => randomText(20, "abcdefghijklmnopqrstuvwxyz0123456789");

function blank(now: number, fields: Partial<Consultation>): Consultation {
  return {
    id: randomText(12, "abcdefghijklmnopqrstuvwxyz0123456789"), ref: newRef(), room: newRoom(), urgent: false, clinicianId: null, price: 0,
    times: [], questions: "", status: "requested", at: null, payment: "none", answered: [], alertedAt: null, escalatedAt: null,
    createdAt: now, steps: [], transcript: [], ...fields,
  };
}

const step = (consultation: Consultation, what: string, now: number): Step[] => [...consultation.steps, { at: now, what }];

// ------------------------------------------------------------------------------------------ what can happen

/** Not urgent: the patient's times and questions go to the clinician, with the payment held. */
export function request(clinician: Clinician, times: number[], questions: string, now = Date.now()): Consultation {
  const sorted = Array.from(new Set(times)).sort((a, b) => a - b);
  return blank(now, {
    clinicianId: clinician.id, price: clinician.price, times: sorted, questions: questions.trim(), status: "requested", payment: "held",
    steps: [{ at: now, what: `Request sent to ${clinician.name}` }, { at: now, what: `£${clinician.price} held on your card` }],
  });
}

/** The clinician picks one of the patient's times. */
export function accept(consultation: Consultation, at: number, now = Date.now()): Consultation {
  if (consultation.status !== "requested" || !consultation.times.includes(at)) return consultation;
  return { ...consultation, status: "scheduled", at, steps: step(consultation, "Time confirmed", now) };
}

/** None of the patient's times suit: the clinician offers some of their own, and the hold stays while the patient picks. */
export function suggest(consultation: Consultation, times: number[], now = Date.now()): Consultation {
  if (consultation.status !== "requested" || !times.length) return consultation;
  return { ...consultation, suggested: Array.from(new Set(times)).sort((a, b) => a - b), steps: step(consultation, "The clinician suggested other times", now) };
}

/** The patient picks one of the clinician's suggested times. */
export function pickSuggested(consultation: Consultation, at: number, now = Date.now()): Consultation {
  if (consultation.status !== "requested" || !consultation.suggested?.includes(at)) return consultation;
  return { ...consultation, status: "scheduled", at, steps: step(consultation, "Time confirmed", now) };
}

/** The clinician can't make any of the times: the hold is released. */
export function decline(consultation: Consultation, now = Date.now()): Consultation {
  if (consultation.status !== "requested") return consultation;
  return { ...consultation, status: "declined", payment: "released", steps: [...step(consultation, "The clinician couldn't make these times", now), { at: now, what: "Payment hold released" }] };
}

/** Whether every time offered for a request has passed, so it can no longer go ahead. */
export const hasExpired = (consultation: Consultation, now = Date.now()) =>
  consultation.status === "requested" && [...consultation.times, ...(consultation.suggested ?? [])].every(at => at <= now);

/** A request whose times have all passed: it ends, and the hold is released. */
export function expire(consultation: Consultation, now = Date.now()): Consultation {
  if (!hasExpired(consultation, now)) return consultation;
  return { ...consultation, status: "declined", payment: "released", steps: [...step(consultation, "Request expired: none of its times are left", now), { at: now, what: "Payment hold released" }] };
}

/** The start times already booked with a clinician on this device, so they aren't offered again. */
export const busyTimes = (list: Consultation[], clinicianId: string) =>
  list.filter(item => item.clinicianId === clinicianId && item.status === "scheduled" && item.at !== null).map(item => item.at as number);

/** The patient cancels before the call: anything held is released. */
export function cancel(consultation: Consultation, now = Date.now()): Consultation {
  if (!["requested", "scheduled", "matching", "matched", "escalated"].includes(consultation.status)) return consultation;
  const steps = step(consultation, "Cancelled", now);
  return { ...consultation, status: "cancelled", payment: consultation.payment === "held" ? "released" : consultation.payment, steps: consultation.payment === "held" ? [...steps, { at: now, what: "Payment hold released" }] : steps };
}

/** Urgent: every clinician free in the next 48 hours is alerted. Nothing is paid until someone is matched. */
export function startUrgent(questions: string, now = Date.now()): Consultation {
  return blank(now, { urgent: true, questions: questions.trim(), status: "matching", alertedAt: now, steps: [{ at: now, what: "Clinicians alerted" }] });
}

/** Urgent: a clinician answers. The first one is matched; later ones wait their turn if the patient moves on. */
export function answer(consultation: Consultation, clinicianId: string, now = Date.now()): Consultation {
  const clinician = findClinician(clinicianId);
  if (!clinician || !["matching", "matched", "escalated"].includes(consultation.status) || consultation.answered.includes(clinicianId)) return consultation;
  const answered = [...consultation.answered, clinicianId];
  if (consultation.status === "matched") return { ...consultation, answered };
  return { ...consultation, answered, status: "matched", clinicianId, price: urgentPrice(clinician), steps: step(consultation, `${clinician.name} answered`, now) };
}

/** Who an urgent request is sent to: everyone it can reach now (free in the next 48 hours, alerts on, listed). */
export const alerted = (now = new Date()) => allClinicians().filter(clinician => clinician.listed !== false && alertable(clinician, now));

/** Urgent: who the patient can move on to, in order: those who answered, then everyone else alerted. */
export function urgentChoices(consultation: Consultation, now = new Date()): Clinician[] {
  const answered = consultation.answered.map(id => findClinician(id)).filter((item): item is Clinician => !!item);
  return [...answered, ...alerted(now).filter(clinician => !consultation.answered.includes(clinician.id))];
}

/** Urgent: the patient isn't happy with the match and moves on to the next free clinician (round to the first again). */
export function nextChoice(consultation: Consultation, now = new Date()): Consultation {
  if (consultation.status !== "matched") return consultation;
  const choices = urgentChoices(consultation, now);
  if (choices.length < 2) return consultation;
  const here = choices.findIndex(clinician => clinician.id === consultation.clinicianId);
  const next = choices[(here + 1) % choices.length];
  return { ...consultation, clinicianId: next.id, price: urgentPrice(next) };
}

/** Urgent: the patient chooses the clinician, the payment is held, and the call can start now. */
export function confirmUrgent(consultation: Consultation, now = Date.now()): Consultation {
  const clinician = findClinician(consultation.clinicianId);
  if (consultation.status !== "matched" || !clinician) return consultation;
  const price = urgentPrice(clinician);
  return { ...consultation, status: "scheduled", at: now, price, payment: "held", steps: [...step(consultation, `You chose ${clinician.name}`, now), { at: now, what: `£${price} held on your card, with the £${URGENT_FEE} urgent fee` }] };
}

/** Urgent: no one answered in five minutes, so the Rehyn team has been told. */
export function escalate(consultation: Consultation, now = Date.now()): Consultation {
  if (consultation.status !== "matching") return consultation;
  return { ...consultation, status: "escalated", escalatedAt: now, steps: step(consultation, "No clinician answered in 5 minutes: the Rehyn team was told", now) };
}

/** Whether an urgent request has waited long enough for the team to be told. */
export const waitedTooLong = (consultation: Consultation, now = Date.now()) =>
  consultation.status === "matching" && consultation.alertedAt !== null && now - consultation.alertedAt >= URGENT_WAIT_MS;

/** The clinician finishes the consultation: only now is the held payment taken. The transcript is kept with it. */
export function finish(consultation: Consultation, transcript: TranscriptLine[], now = Date.now(), wrapUp: { summary?: string; followUp?: boolean } = {}): Consultation {
  if (consultation.status !== "scheduled") return consultation;
  const summary = wrapUp.summary?.trim() || undefined;
  return {
    ...consultation, status: "done", payment: "paid", transcript: transcript.length ? transcript : consultation.transcript, summary, followUp: wrapUp.followUp,
    steps: [...step(consultation, "Consultation finished", now), { at: now, what: `£${consultation.price} paid` }, ...(summary ? [{ at: now, what: "Summary from the clinician" }] : [])],
  };
}

/** Keep the transcript so far (when someone leaves the call before it is finished). */
export const keepTranscript = (consultation: Consultation, transcript: TranscriptLine[]): Consultation =>
  transcript.length > consultation.transcript.length ? { ...consultation, transcript } : consultation;

/** The order a patient reads their list in: what needs them first, then the newest. */
export const isOpen = (consultation: Consultation) => ["requested", "scheduled", "matching", "matched", "escalated"].includes(consultation.status);

/** A transcript as plain text, to download. */
export const transcriptText = (lines: TranscriptLine[]) =>
  lines.map(line => `[${new Date(line.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}] ${line.name}: ${line.text}`).join("\n");

// ---------------------------------------------------------------------------------- kept on this device

const CONSULTATIONS_KEY = "rehyn.consultations.v1";
const SESSIONS_KEY = "rehyn.groupSessions.v1";
const PLACES_KEY = "rehyn.groupSessions.places";
const PORTAL_KEY = "rehyn.clinicians.portalAs";

function readJson<T>(key: string, fallback: T): T {
  try { const raw = window.localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function writeJson(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* Kept for this visit only. */ }
}

/** A list kept under one key, the same in every tab: a change in one tab reaches the others through the storage event. */
function createStore<T>(key: string, fallback: T) {
  const listeners = new Set<() => void>();
  let value: T = typeof window === "undefined" ? fallback : readJson(key, fallback);
  const notify = () => listeners.forEach(listener => listener());
  if (typeof window !== "undefined") {
    window.addEventListener("storage", event => {
      if (event.key !== key && event.key !== null) return;
      value = readJson(key, fallback);
      notify();
    });
  }
  return {
    get: () => value,
    set(next: T) { value = next; writeJson(key, next); notify(); },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    fallback,
  };
}

const consultationStore = createStore<Consultation[]>(CONSULTATIONS_KEY, []);
const sessionStore = createStore<GroupSession[]>(SESSIONS_KEY, []);
const placeStore = createStore<string[]>(PLACES_KEY, []);
const askedStore = createStore<Record<string, string[]>>("rehyn.groupSessions.questions", {});
const portalStore = createStore<string | null>(PORTAL_KEY, null);

const useStore = <T,>(store: ReturnType<typeof createStore<T>>) => useSyncExternalStore(store.subscribe, store.get, () => store.fallback);

export const useConsultations = () => useStore(consultationStore);
export const findConsultation = (list: Consultation[], idOrRoom: string | undefined) => list.find(item => item.id === idOrRoom || item.room === idOrRoom);

/** Add a consultation, or replace it with its changed self. */
export function saveConsultation(consultation: Consultation) {
  const list = consultationStore.get();
  consultationStore.set(list.some(item => item.id === consultation.id) ? list.map(item => (item.id === consultation.id ? consultation : item)) : [consultation, ...list]);
}

/** Change one consultation by id, reading the latest copy first (another tab may have changed it). */
export function updateConsultation(id: string, change: (consultation: Consultation) => Consultation) {
  const latest = readJson<Consultation[]>(CONSULTATIONS_KEY, consultationStore.get()).find(item => item.id === id) ?? consultationStore.get().find(item => item.id === id);
  if (latest) saveConsultation(change(latest));
}

export const useCreatedSessions = () => useStore(sessionStore);
export const addSession = (session: GroupSession) => sessionStore.set([...sessionStore.get(), session]);
export const removeSession = (id: string) => sessionStore.set(sessionStore.get().filter(session => session.id !== id));

/** The group sessions this person saved a place in. */
export const usePlaces = () => useStore(placeStore);
export const togglePlace = (id: string) => { const places = placeStore.get(); placeStore.set(places.includes(id) ? places.filter(item => item !== id) : [...places, id]); };

/** Questions sent in advance to group sessions, by session id (no names: the host sees only the words). */
export const useSessionQuestions = () => useStore(askedStore);
export const askInAdvance = (id: string, question: string) => {
  const text = question.trim().slice(0, 300);
  if (!text) return;
  const all = askedStore.get();
  askedStore.set({ ...all, [id]: [...(all[id] ?? []), text] });
};

/** Which example clinician the portal is being tried as. */
export const usePortalClinician = () => useStore(portalStore);
export const setPortalClinician = (id: string | null) => portalStore.set(id);

/** A new group session set up in the portal. */
export const newSession = (fields: Omit<GroupSession, "id" | "weekly">): GroupSession => ({ ...fields, id: `s-${newRoom().slice(0, 12)}`, weekly: false });

/** The room of a group session. */
export const sessionRoom = (session: GroupSession) => `group-${session.id}`;
