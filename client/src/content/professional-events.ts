// My professional events (comment 4): peer events with other clinicians in the network (conferences, journal clubs,
// MDT meetings, CPD workshops), the way Eventbrite lists the events you have registered for. These are not patient
// consultations (My consultations) or the clinician's weekly Q&A sessions with patients (Group weekly sessions).
// The events are preview examples: there is no events service yet, so which ones the clinician has joined is kept on
// this device (rehyn.clinician.events.v1), starting with the ones marked `joined`.

import { useSyncExternalStore } from "react";
import type { PersonId } from "./community-samples";

export type ProfessionalEvent = {
  id: string;
  title: string;
  /** Who runs it: a clinician in the network, or an organisation. */
  organiser: { who?: PersonId; name: string };
  kind: "Conference" | "Journal club" | "MDT meeting" | "Workshop" | "Webinar";
  format: "Online" | "In person" | "Hybrid";
  venue: string;
  /** Days from today, and the start time (24-hour clock). */
  inDays: number;
  hour: number;
  minute: number;
  minutes: number;
  about: string;
  cpd: number;
  /** Network clinicians going. */
  going: PersonId[];
  places: number;
  /** Joined when the preview starts. */
  joined: boolean;
};

export const PROFESSIONAL_EVENTS: ProfessionalEvent[] = [
  { id: "stroke-forum", title: "Regional Stroke Forum: early supported discharge", organiser: { who: "hannah", name: "Hannah Brooks" }, kind: "Conference", format: "Hybrid", venue: "Royal Lambeth Hospital education centre, London, and online", inDays: 2, hour: 9, minute: 30, minutes: 360, about: "Service models, outcome data and workforce for seven-day early supported discharge, with case presentations from five stroke units.", cpd: 5, going: ["hannah", "grace", "imani", "kwame"], places: 120, joined: true },
  { id: "jc-thrombectomy", title: "Stroke Research Journal Club: thrombectomy beyond 24 hours", organiser: { who: "tomas", name: "Dr Tomás Leal" }, kind: "Journal club", format: "Online", venue: "Online (video link sent to attendees)", inDays: 4, hour: 13, minute: 0, minutes: 60, about: "Critical appraisal of the latest late-window thrombectomy trial, with a reflective CPD note template.", cpd: 1, going: ["tomas", "michael", "elena"], places: 40, joined: true },
  { id: "pd-mdt", title: "Movement Disorders virtual MDT", organiser: { who: "arjun", name: "Dr Arjun Mehta" }, kind: "MDT meeting", format: "Online", venue: "Online", inDays: 8, hour: 16, minute: 0, minutes: 90, about: "Monthly case discussion for complex Parkinson's and atypical parkinsonism. Members of the Parkinson's Clinical Network can bring cases.", cpd: 1.5, going: ["arjun", "priya", "kwame"], places: 30, joined: true },
  { id: "dysphagia-workshop", title: "IDDSI and dysphagia screening workshop", organiser: { name: "Aphasia and Dysphagia Practice Group" }, kind: "Workshop", format: "In person", venue: "Bath Community Therapy Service, Bath", inDays: 12, hour: 10, minute: 0, minutes: 180, about: "Hands-on session on texture-modified diets and nurse-led bedside swallow screening.", cpd: 3, going: ["hannah", "sophie"], places: 24, joined: false },
  { id: "af-webinar", title: "AF and stroke prevention: joint cardiology–stroke clinics", organiser: { name: "St Bartholomew Heart Centre" }, kind: "Webinar", format: "Online", venue: "Online", inDays: 15, hour: 18, minute: 30, minutes: 75, about: "How three trusts set up joint AF and stroke clinics: referral criteria, anticoagulation timing and outcomes.", cpd: 1, going: ["tomas", "ruth"], places: 200, joined: false },
  { id: "rehab-conference", title: "UK Neurorehabilitation Conference 2026", organiser: { name: "British Neurorehabilitation Society (example)" }, kind: "Conference", format: "In person", venue: "Manchester Central, Manchester", inDays: 26, hour: 9, minute: 0, minutes: 480, about: "Two days of plenaries and workshops across stroke, brain injury, MS and Parkinson's rehabilitation.", cpd: 12, going: ["priya", "grace", "joseph", "michael"], places: 800, joined: false },
];

/** When an event starts, from today. */
export function eventStart(event: ProfessionalEvent, now = Date.now()): Date {
  const day = new Date(now);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + event.inDays, event.hour, event.minute);
}

// ------------------------------------------------------------------------------------- kept on this device

const KEY = "rehyn.clinician.events.v1";
type Choices = Record<string, boolean>;
const listeners = new Set<() => void>();
const read = (): Choices => { try { return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Choices; } catch { return {}; } };
let choices: Choices = typeof window === "undefined" ? {} : read();
const NONE: Choices = {};

export const isJoined = (event: ProfessionalEvent, saved: Choices = choices) => saved[event.id] ?? event.joined;
/** Join an event, or leave one. */
export function setJoined(id: string, on: boolean) {
  choices = { ...choices, [id]: on };
  try { window.localStorage.setItem(KEY, JSON.stringify(choices)); } catch { /* Kept for this visit only. */ }
  listeners.forEach(listener => listener());
}
export const useEventChoices = () => useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => choices, () => NONE);

/** The events the clinician has joined that haven't finished, soonest first. */
export function joinedEvents(now = Date.now(), saved: Choices = choices) {
  return PROFESSIONAL_EVENTS.filter(event => isJoined(event, saved) && eventStart(event, now).getTime() + event.minutes * 60_000 > now)
    .sort((a, b) => eventStart(a, now).getTime() - eventStart(b, now).getTime());
}
