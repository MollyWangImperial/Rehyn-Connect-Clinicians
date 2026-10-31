// The Clinicians tab: people who work with the conditions in the Library, to browse by condition and the kind of care,
// each with a profile and a way to book a consultation. From the design canvas "Rehyn Clinicians Tab" (artboards 1, the
// directory with filters, 2, start from a condition, and 3, the clinician profile). Every consultation is online, by
// video on Rehyn itself. The clinicians are examples while the directory is set up, as the page says: there are no
// real registrations, fees or bookings behind them yet, so the profile names the register each profession belongs to
// rather than a number, and the prices, experience and hours are examples too.
// Each clinician's conditions are Library conditions ([group id, condition id]), so the directory's filters are the
// Library's own sections and groups and a profile's conditions lead to their Library pages.

import { librarySections, type LibraryGroup, type LibrarySection } from "./library";

export type ClinicianType = "doctor" | "physio" | "slt" | "ot" | "psych" | "nurse" | "diet";

/** When they take consultations: on these days of the week (0 is Sunday), from one hour to another (24-hour clock). */
export type Hours = { days: number[]; from: number; to: number };
/** Days away, from one moment to another, with a label ("Holiday"). */
export type TimeOff = { from: number; to: number; label: string };
/** When urgent requests reach them: whenever they're free in the next 48 hours, only when free today, or never. */
/** When urgent requests reach a clinician: always (even when busy), when free in the next 48 hours, only when free today, or never. */
export type UrgentAlerts = "always" | "free48" | "today" | "never";

export type Clinician = {
  /** In the address: /clinicians/amara-osei. */
  id: string;
  name: string;
  /** "Amara", for "About Amara" and "Amara will choose…". */
  first: string;
  initials: string;
  role: string;
  type: ClinicianType;
  /** "Consultant", "Senior" or "Specialist": shown with their years of experience. */
  level: string;
  years: number;
  /** Consultation hours they have given, all told. */
  hours: number;
  /** The price of one 30-minute consultation, in pounds. */
  price: number;
  /** The Library conditions they work with, as [group id, condition id]; the first one sets the profile's colours. */
  conditions: [string, string][];
  languages: string[];
  schedule: Hours[];
  /** "How I can help": short lines. */
  help: string[];
  /** "About": a short, plain-English introduction. */
  about: string;
  timeOff?: TimeOff[];
  urgentAlerts?: UrgentAlerts;
  /** False hides them from the directory (their booked consultations stay booked). */
  listed?: boolean;
  /** A clinician who signed up on this device: their registration number, not yet checked by Rehyn. */
  own?: boolean;
  registration?: string;
  verified?: boolean;
  /** Rehyn Connect for clinicians: their portrait, where they work and a short professional summary for colleagues. */
  photo?: string;
  org?: string;
  place?: string;
  summary?: string;
};

export const CLINICIAN_TYPES: { id: ClinicianType; label: string }[] = [
  { id: "doctor", label: "Doctors & consultants" },
  { id: "physio", label: "Physiotherapists" },
  { id: "slt", label: "Speech & language therapists" },
  { id: "ot", label: "Occupational therapists" },
  { id: "psych", label: "Psychologists & counsellors" },
  { id: "nurse", label: "Specialist nurses" },
  { id: "diet", label: "Dietitians" },
];

/** The UK register each profession is on: doctors with the GMC, nurses with the NMC, the others with the HCPC. */
export const REGISTER: Record<ClinicianType, string> = {
  doctor: "GMC", nurse: "NMC", physio: "HCPC", slt: "HCPC", ot: "HCPC", psych: "HCPC", diet: "HCPC",
};

const WEEKDAYS = [1, 2, 3, 4, 5];

const BASE: Clinician[] = [
  {
    id: "amara-osei", name: "Dr Amara Osei", first: "Amara", initials: "AO", role: "Consultant stroke physician", type: "doctor",
    level: "Consultant", years: 14, hours: 1320, price: 85,
    conditions: [["stroke", "ischaemic"], ["stroke", "haemorrhagic"], ["stroke", "tia"], ["stroke", "under-50"], ["brain-spinal-injury", "traumatic-brain-injury"], ["blood-pressure", "high-blood-pressure"]],
    languages: ["English", "Twi"], schedule: [{ days: [1, 3, 5], from: 9, to: 17 }],
    help: ["Reviewing your recovery since leaving hospital", "Lowering the chance of another stroke", "Making sense of medicines and test results", "Pointing you to the right therapy next"],
    about: "Amara looks after people in the months after a stroke or a mini-stroke. A first consultation is a chance to go through what happened, how you are now and what would help next, at your pace.",
  },
  {
    id: "priya-raman", name: "Priya Raman", first: "Priya", initials: "PR", role: "Neurological physiotherapist", type: "physio",
    level: "Senior", years: 11, hours: 2140, price: 55,
    conditions: [["stroke", "ischaemic"], ["stroke", "haemorrhagic"], ["parkinsons", "parkinsons-disease"], ["multiple-sclerosis", "relapsing-remitting"], ["multiple-sclerosis", "progressive"]],
    languages: ["English", "Tamil"], schedule: [{ days: WEEKDAYS, from: 8, to: 14 }, { days: [6], from: 9, to: 12 }],
    help: ["Walking, balance and getting up from the floor", "Building strength in a weaker arm or leg", "A home exercise plan you can keep to", "Getting back to the things you enjoy"],
    about: "Priya works with people whose movement has changed after a stroke, or with Parkinson's or MS. The first consultation is mostly talking and watching how you move on camera, then agreeing one or two goals together.",
  },
  {
    id: "hannah-brooks", name: "Hannah Brooks", first: "Hannah", initials: "HB", role: "Speech & language therapist", type: "slt",
    level: "Specialist", years: 8, hours: 960, price: 50,
    conditions: [["stroke", "ischaemic"], ["stroke", "haemorrhagic"], ["dementia", "alzheimers"], ["dementia", "vascular"]],
    languages: ["English"], schedule: [{ days: WEEKDAYS, from: 9, to: 13 }, { days: [0, 6], from: 10, to: 16 }],
    help: ["Finding words and following conversations", "Speech that has become slurred or slow", "Swallowing safely at mealtimes", "Ideas for family on how to help"],
    about: "Hannah helps people with speech, language and swallowing after a stroke, and with communication when memory changes. A family member is welcome to join the call.",
  },
  {
    id: "kwame-mensah", name: "Dr Kwame Mensah", first: "Kwame", initials: "KM", role: "Clinical psychologist", type: "psych",
    level: "Senior", years: 12, hours: 1880, price: 75,
    conditions: [["depression", "depression"], ["depression", "after-stroke"], ["anxiety", "anxiety"], ["anxiety", "health-anxiety"], ["stroke", "ischaemic"]],
    languages: ["English"], schedule: [{ days: [1, 2, 3, 4, 5, 6], from: 17, to: 21 }],
    help: ["Low mood and worry after an illness", "Adjusting to changes in your life", "Fear of it happening again", "Talking therapies such as CBT"],
    about: "Kwame works with people whose mood has been knocked by a health scare or a long illness. The first consultation is about what has been hardest and what you would like to feel different.",
  },
  {
    id: "grace-whitlow", name: "Grace Whitlow", first: "Grace", initials: "GW", role: "Occupational therapist", type: "ot",
    level: "Senior", years: 9, hours: 1150, price: 50,
    conditions: [["stroke", "ischaemic"], ["stroke", "haemorrhagic"], ["brain-spinal-injury", "traumatic-brain-injury"], ["brain-spinal-injury", "spinal-cord"]],
    languages: ["English"], schedule: [{ days: [2, 4], from: 10, to: 18 }],
    help: ["Washing, dressing and cooking more easily", "Equipment and changes around the home", "Managing tiredness through the day", "Planning a return to work"],
    about: "Grace helps people get back to everyday tasks after a stroke or a brain or spinal injury. She often starts by asking about a normal day, then looks for the changes that would make the biggest difference.",
  },
  {
    id: "tomas-leal", name: "Dr Tomás Leal", first: "Tomás", initials: "TL", role: "Consultant cardiologist", type: "doctor",
    level: "Consultant", years: 16, hours: 1540, price: 90,
    conditions: [["heart-rhythm", "atrial-fibrillation"], ["heart-rhythm", "svt"], ["heart-attack", "coronary-heart-disease"], ["heart-attack", "heart-failure"]],
    languages: ["English", "Portuguese", "Spanish"], schedule: [{ days: [1, 2, 4], from: 13, to: 19 }],
    help: ["Understanding an irregular heartbeat", "Making sense of heart tests and scans", "Medicines, and what each one is for", "Living well with heart failure"],
    about: "Tomás sees people with heart rhythm problems and heart disease. A first consultation goes through your symptoms and results so far, and what the options are from here.",
  },
  {
    id: "ruth-calloway", name: "Ruth Calloway", first: "Ruth", initials: "RC", role: "Cardiac rehabilitation nurse", type: "nurse",
    level: "Specialist", years: 10, hours: 2300, price: 50,
    conditions: [["heart-attack", "heart-attack"], ["heart-attack", "angina"], ["blood-pressure", "high-blood-pressure"]],
    languages: ["English"], schedule: [{ days: [0, 1, 2, 3, 4, 5, 6], from: 8, to: 12 }],
    help: ["Getting active again after a heart attack", "Knowing which symptoms to act on", "Blood pressure checks at home", "Confidence for everyday life"],
    about: "Ruth supports people through the weeks and months after a heart attack or a diagnosis of angina. Partners are welcome to join the call too.",
  },
  {
    id: "michael-chau", name: "Dr Michael Chau", first: "Michael", initials: "MC", role: "Consultant diabetologist", type: "doctor",
    level: "Consultant", years: 13, hours: 1260, price: 85,
    conditions: [["diabetes", "type-2"], ["diabetes", "type-1"], ["diabetes", "prediabetes"], ["thyroid", "underactive"], ["thyroid", "overactive"]],
    languages: ["English", "Cantonese"], schedule: [{ days: [3, 5], from: 9, to: 15 }],
    help: ["Making sense of blood sugar results", "Medicines and insulin, step by step", "Thyroid tests and treatment", "Looking after your eyes, feet and kidneys"],
    about: "Michael looks after people with diabetes and thyroid conditions. A first consultation reviews your results and how things are day to day, and agrees what to focus on first.",
  },
  {
    id: "sophie-adair", name: "Sophie Adair", first: "Sophie", initials: "SA", role: "Specialist dietitian", type: "diet",
    level: "Specialist", years: 7, hours: 840, price: 55,
    conditions: [["diabetes", "type-2"], ["diabetes", "prediabetes"], ["weight", "obesity"], ["kidneys", "chronic-kidney-disease"]],
    languages: ["English"], schedule: [{ days: [2, 3, 4, 5, 6], from: 12, to: 18 }],
    help: ["Eating well with diabetes", "Weight, at a pace that suits you", "Food choices for kidney health", "Simple meals when energy is low"],
    about: "Sophie helps people find a way of eating that fits their condition and their life. Bring a rough idea of what you usually eat in a day.",
  },
  {
    id: "joseph-hartley", name: "Joseph Hartley", first: "Joseph", initials: "JH", role: "Musculoskeletal physiotherapist", type: "physio",
    level: "Senior", years: 9, hours: 1980, price: 55,
    conditions: [["back-neck", "back-pain"], ["back-neck", "neck-pain"], ["joint-replacement", "hip-replacement"], ["joint-replacement", "knee-replacement"]],
    languages: ["English"], schedule: [{ days: WEEKDAYS, from: 16, to: 20 }],
    help: ["Back and neck pain that keeps coming back", "Getting moving after a hip or knee replacement", "Exercises you can do at home", "Getting back to work and hobbies"],
    about: "Joseph works with people with back and neck pain and after joint replacements. The first consultation includes a look at how you move on camera and a few exercises to start with.",
  },
  {
    id: "sarah-whitfield", name: "Dr Sarah Whitfield", first: "Sarah", initials: "SW", role: "Clinical oncologist", type: "doctor",
    level: "Consultant", years: 15, hours: 1100, price: 90,
    conditions: [["common-cancers", "breast"], ["common-cancers", "bowel"], ["after-treatment", "cancer-fatigue"], ["after-treatment", "late-effects"]],
    languages: ["English"], schedule: [{ days: [2, 5], from: 10, to: 16 }],
    help: ["Questions about your treatment plan", "Side effects and how to manage them", "Tiredness and other effects after treatment", "What follow-up looks like"],
    about: "Sarah treats people with breast and bowel cancer and supports them after treatment ends. A first consultation is a chance to ask the questions that did not fit into a busy clinic.",
  },
  {
    id: "elena-rossi", name: "Dr Elena Rossi", first: "Elena", initials: "ER", role: "Consultant nephrologist", type: "doctor",
    level: "Consultant", years: 12, hours: 1020, price: 85,
    conditions: [["kidneys", "chronic-kidney-disease"], ["kidneys", "kidney-failure-dialysis"], ["kidneys", "kidney-transplant"], ["liver", "fatty-liver"]],
    languages: ["English", "Italian"], schedule: [{ days: [1, 4], from: 9, to: 13 }],
    help: ["Understanding your kidney results", "Slowing kidney disease down", "Choices about dialysis and transplant", "Medicines that are kind to the kidneys"],
    about: "Elena looks after people with kidney disease at every stage. A first consultation goes through your results and what they mean, and what can help protect your kidneys.",
  },
  {
    id: "arjun-mehta", name: "Dr Arjun Mehta", first: "Arjun", initials: "AM", role: "Consultant neurologist", type: "doctor",
    level: "Consultant", years: 13, hours: 980, price: 90,
    conditions: [["parkinsons", "parkinsons-disease"], ["multiple-sclerosis", "relapsing-remitting"], ["multiple-sclerosis", "progressive"], ["stroke", "ischaemic"]],
    languages: ["English", "Hindi", "Gujarati"], schedule: [{ days: [1, 3], from: 9, to: 15 }],
    help: ["Making sense of a new Parkinson's diagnosis", "Medicines and how to time them", "Changes in movement, sleep or mood", "What to ask at your next review"],
    about: "Arjun looks after people with Parkinson's and other movement disorders. A first consultation goes through how things are day to day and what would make the biggest difference.",
  },
  {
    id: "imani-clarke", name: "Imani Clarke", first: "Imani", initials: "IC", role: "Stroke nurse specialist", type: "nurse",
    level: "Senior", years: 8, hours: 1610, price: 50,
    conditions: [["stroke", "ischaemic"], ["stroke", "haemorrhagic"], ["stroke", "tia"], ["blood-pressure", "high-blood-pressure"]],
    languages: ["English"], schedule: [{ days: [1, 2, 3, 4, 5], from: 8, to: 16 }],
    help: ["The first weeks home after a stroke", "Medicines and blood pressure checks", "Knowing which symptoms to act on", "Support for family and carers"],
    about: "Imani supports people and their families in the weeks after a stroke. A first consultation is a chance to go through medicines, warning signs and what comes next.",
  },
];

// The portraits are real photographs from Unsplash (free to use under the Unsplash License), kept in
// public/photos/clinicians and cropped to the face. Each clinician is an example profile: the photo is a model, not the
// clinician named. Photographers and photo pages (unsplash.com/photos/<id>): Amara, Christina @ wocintechchat.com
// (_5_CBVCLBsY); Priya, Ocho Artex Media (rm7rZYdl3rY); Hannah, Christina @ wocintechchat.com (SJvDxw0azqw); Kwame,
// Bruno Rodrigues (279xIHymPYY); Grace, Beatriz Mendez (_4xStiTXY1o); Tomás, Roy K (PukoW35U8JA); Ruth, Jonathan Borba
// (4mUk_DFImbI); Michael, Dalton Ngangi (ZCztndOWdjs); Sophie, Md Ishak Rahman (niyAwrzx8jc); Joseph, Abu Saied
// (-dntKy_x8qo); Sarah, Eros Reyes Cabrera (RtakOBTTdvY); Elena, Humberto Chávez (FVh_yqLR9eA); Arjun, Usman Yousaf
// (SakqLf78KVo); Imani, Joecalih (1l6UeCc9P9o).
const photo = (id: string) => `/photos/clinicians/${id}.jpg`;

/** What colleagues see in the clinician network: where they work and a short professional summary. */
const NETWORK: Record<string, Pick<Clinician, "org" | "place" | "summary">> = {
  "amara-osei": { org: "Royal Lambeth Hospital", place: "London", summary: "Stroke physician leading the hyperacute stroke unit's early supported discharge pathway. Interested in secondary prevention and stroke in younger adults." },
  "priya-raman": { org: "Northfield Neuro Rehab Centre", place: "Leeds", summary: "Neuro physio working across stroke, Parkinson's and MS. Runs the centre's balance and falls clinic and teaches on the MSc neuro rehab module." },
  "hannah-brooks": { org: "Bath Community Therapy Service", place: "Bath", summary: "Speech and language therapist specialising in aphasia and dysphagia after stroke, and communication support in dementia." },
  "kwame-mensah": { org: "Southbank Clinical Psychology", place: "London", summary: "Clinical psychologist working with adjustment, low mood and fear of recurrence after stroke and cardiac events. CBT and ACT." },
  "grace-whitlow": { org: "Riverside Community Neuro Team", place: "Bristol", summary: "Occupational therapist in community neuro rehab: return to work, fatigue management and home adaptations after stroke and brain injury." },
  "tomas-leal": { org: "St Bartholomew Heart Centre", place: "London", summary: "Cardiologist with an interest in atrial fibrillation and stroke prevention, and in joint cardiology and stroke clinics." },
  "ruth-calloway": { org: "Whitby Cardiac Rehabilitation", place: "Whitby", summary: "Cardiac rehab nurse leading the community programme after heart attack and angina, including blood pressure self-monitoring." },
  "michael-chau": { org: "Manchester Diabetes Centre", place: "Manchester", summary: "Diabetologist running the joint diabetes and vascular clinic, with an interest in cardiovascular risk after stroke." },
  "sophie-adair": { org: "Leicester Nutrition and Dietetics", place: "Leicester", summary: "Specialist dietitian in diabetes, weight and kidney health; group education programmes and dysphagia diets with SLT colleagues." },
  "joseph-hartley": { org: "Cardiff MSK Physiotherapy", place: "Cardiff", summary: "MSK physiotherapist: persistent back and neck pain, and rehab after hip and knee replacement." },
  "sarah-whitfield": { org: "Northern Cancer Centre", place: "Newcastle", summary: "Clinical oncologist in breast and colorectal cancer with an interest in late effects and survivorship care." },
  "elena-rossi": { org: "Birmingham Renal Unit", place: "Birmingham", summary: "Nephrologist across chronic kidney disease, dialysis and transplant, with a research interest in kidney health after stroke." },
  "arjun-mehta": { org: "Midlands Movement Disorders Service", place: "Nottingham", summary: "Neurologist leading the movement disorders clinic: Parkinson's, atypical parkinsonism and device-aided therapies." },
  "imani-clarke": { org: "Royal Lambeth Hospital", place: "London", summary: "Stroke specialist nurse on the early supported discharge team: secondary prevention, medicines and family support." },
};

export const CLINICIANS: Clinician[] = BASE.map(clinician => ({ ...clinician, photo: photo(clinician.id), ...NETWORK[clinician.id] }));

/** "Often seen by", on each Library section's card on the by-condition page (artboard 2), keyed by section id. */
export const SEEN_BY: Record<string, string> = {
  "brain-nervous-system": "Neurologists, stroke physicians, neuro physios, speech & language therapists",
  "heart-lungs": "Cardiologists, respiratory physicians, cardiac rehab nurses",
  "diabetes-metabolism": "Diabetologists, endocrinologists, dietitians, diabetes nurses",
  "bones-joints-muscles": "Rheumatologists, orthopaedic surgeons, MSK physios, OTs",
  "cancer-recovery": "Oncologists, haematologists, specialist cancer nurses, palliative care",
  "mind-mood": "Psychologists, psychiatrists, counsellors, mental health nurses",
  "kidneys-liver-digestion": "Nephrologists, hepatologists, gastroenterologists, urologists",
};

/** The directory, already narrowed to a Library section and, optionally, one of its groups: "/?area=heart-lungs&group=heart-rhythm". */
export const directoryHref = (sectionId?: string, groupId?: string) => {
  const query = new URLSearchParams();
  if (sectionId) query.set("area", sectionId);
  if (groupId) query.set("group", groupId);
  const text = query.toString();
  return text ? `/?${text}` : "/";
};

/** The directory's starting filters from its address: a known section, and only the groups that belong to it. */
export function directoryFilters(search: string): { area: string; groups: string[] } {
  const query = new URLSearchParams(search);
  const section = librarySections.find(item => item.id === query.get("area"));
  if (!section) return { area: "all", groups: [] };
  return { area: section.id, groups: query.getAll("group").filter(id => section.groups.some(group => group.id === id)) };
}

// --------------------------------------------------------------------------------- clinical areas (directory)

/**
 * The directory's Clinical expertise filter: professional clinical areas rather than the Library's patient-facing
 * sections. A clinician is in an area when the conditions on their profile fall in it (their Library groups) or their
 * own specialty names it (their role); a profile can be in several. Areas are areas of practice, never a qualification:
 * a physiotherapist who works with Parkinson's is in Neurology without being called a neurologist.
 */
export type ClinicalArea = { id: string; label: string; groups: string[]; roles: RegExp };
export const CLINICAL_AREAS: ClinicalArea[] = [
  { id: "neurology", label: "Neurology", groups: ["parkinsons", "multiple-sclerosis", "dementia", "brain-spinal-injury"], roles: /neurolog/i },
  { id: "stroke", label: "Stroke care and rehabilitation", groups: ["stroke"], roles: /stroke/i },
  { id: "cardiology", label: "Cardiology", groups: ["heart-rhythm", "heart-attack", "blood-pressure", "cholesterol"], roles: /cardi/i },
  { id: "respiratory", label: "Respiratory medicine", groups: ["long-term-lung", "sleep-breathing"], roles: /respirat|pulmon/i },
  { id: "endocrinology", label: "Endocrinology and diabetes", groups: ["diabetes", "thyroid", "weight", "hormones"], roles: /diabet|endocrin/i },
  { id: "msk", label: "Musculoskeletal medicine and rehabilitation", groups: ["back-neck", "joint-replacement", "muscles", "feet-tendons", "injuries", "bone-health", "gout-vitamins"], roles: /musculoskeletal|orthopaed|rheumat/i },
  { id: "oncology", label: "Oncology and cancer rehabilitation", groups: ["common-cancers", "blood-cancers", "womens-cancers", "mens-cancers", "digestive-cancers", "other-cancers", "rarer-cancers", "after-treatment", "advanced-cancer"], roles: /oncolog|haematolog/i },
  { id: "mental-health", label: "Mental health", groups: ["depression", "anxiety", "sleep", "bipolar-psychosis", "stress-grief", "alcohol", "eating-disorders", "adhd-autism"], roles: /psycholog|psychiatr|mental health/i },
  { id: "nephrology", label: "Nephrology", groups: ["kidneys"], roles: /nephrolog|renal/i },
  { id: "gastro", label: "Gastroenterology and hepatology", groups: ["liver", "stomach", "gut", "ibd"], roles: /gastro|hepatolog/i },
];

/** The clinical areas a clinician works in, from their profile's conditions and their role. */
export function clinicalAreasOf(clinician: Pick<Clinician, "conditions" | "role">): ClinicalArea[] {
  const groups = new Set(clinician.conditions.map(([groupId]) => groupId));
  return CLINICAL_AREAS.filter(area => area.groups.some(id => groups.has(id)) || area.roles.test(clinician.role));
}

/** The area the directory's address asks for: `?expertise=<area>`, or the area of an older link's `?group=<library group>`. */
export function clinicalAreaFromQuery(search: string): string {
  const query = new URLSearchParams(search);
  const asked = query.get("expertise");
  if (asked && CLINICAL_AREAS.some(area => area.id === asked)) return asked;
  const group = query.getAll("group").find(id => CLINICAL_AREAS.some(area => area.groups.includes(id)));
  return group ? CLINICAL_AREAS.find(area => area.groups.includes(group))!.id : "all";
}

export type GroupPlace = { section: LibrarySection; group: LibraryGroup };

/** Where a Library group sits: its section, for the colours and the condition-area filter. */
export function groupPlace(groupId: string): GroupPlace | undefined {
  for (const section of librarySections) {
    const group = section.groups.find(item => item.id === groupId);
    if (group) return { section, group };
  }
  return undefined;
}

/** A clinician's Library groups, in their order, once each. */
export function clinicianGroups(clinician: Clinician): GroupPlace[] {
  const seen = new Set<string>();
  return clinician.conditions.flatMap(([groupId]) => {
    if (seen.has(groupId)) return [];
    seen.add(groupId);
    const place = groupPlace(groupId);
    return place ? [place] : [];
  });
}

/** The section a clinician's profile takes its colours from: the one of their first condition. */
export const mainSection = (clinician: Clinician): LibrarySection => clinicianGroups(clinician)[0]?.section ?? librarySections[0];

// Everyone, as this device knows them: the examples with any changes made to them in the clinician portal here, and a
// clinician who signed up on this device (lib/clinician-portal.ts keeps those and sets the list).
let everyone: Clinician[] = CLINICIANS;
export const allClinicians = () => everyone;
export const setAllClinicians = (list: Clinician[]) => { everyone = list; };
/** Those in the directory: everyone not paused. */
export const listedClinicians = () => everyone.filter(clinician => clinician.listed !== false);

export const findClinician = (id: string | null | undefined) => everyone.find(clinician => clinician.id === id);

/** Their specific professional title: the level and the role together, "Senior neurological physiotherapist" or
 *  "Specialist speech & language therapist", and the role alone when it already starts with the level ("Consultant
 *  stroke physician"). A level on its own ("Specialist") says too little about who someone is. */
export function professionalTitle(clinician: Pick<Clinician, "level" | "role">) {
  const role = clinician.role.trim() || "Clinician";
  if (!clinician.level || role.toLowerCase().startsWith(clinician.level.toLowerCase())) return role;
  const keepCase = /^[A-Z]{2,}\b/.test(role);
  return `${clinician.level} ${keepCase ? role : role.charAt(0).toLowerCase() + role.slice(1)}`;
}
/** "14 years' experience". */
export const experienceText = (clinician: Pick<Clinician, "years">) =>
  clinician.years > 0 ? `${clinician.years} ${clinician.years === 1 ? "year's" : "years'"} experience` : "Less than a year's experience";
/** Whether a time is later today: their next free time shows as "Available now" rather than as a time. */
export const isToday = (date: Date, now = new Date()) => date.toDateString() === now.toDateString();
/** "1,320 consultation hours", or "New on Rehyn". */
export const hoursText = (clinician: Clinician) =>
  clinician.hours > 0 ? `${clinician.hours.toLocaleString("en-GB")} consultation ${clinician.hours === 1 ? "hour" : "hours"}` : "New on Rehyn";
/** "£85". */
export const priceText = (price: number) => `£${price}`;

/** The suggested price range for a 30-minute consultation, in pounds, in line with the market rate. A clinician can ask
 *  for a price outside it; every change of price is a request that Rehyn's administrator approves. */
export const PRICE_MIN = 50;
export const PRICE_MAX = 100;
/** The prices a change can be requested for at all, in pounds. */
export const PRICE_REQUEST_MIN = 20;
export const PRICE_REQUEST_MAX = 300;
/** Rehyn's share of what a patient pays: the clinician receives the rest. 50% for now, as an example rate. */
export const REHYN_SHARE = 0.5;
/** What the clinician receives of an amount a patient pays, after Rehyn's share: "£25" of £50. */
export const clinicianShare = (amount: number) => Math.round(amount * (1 - REHYN_SHARE) * 100) / 100;
/** "£25", or "£27.50" when it isn't whole pounds. */
export const poundsText = (amount: number) => `£${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
/** "50%". */
export const shareText = (share: number) => `${Math.round(share * 100)}%`;
/** Added to the clinician's price for an urgent consultation, in pounds, and paid to them with it. */
export const URGENT_FEE = 20;
/** What a patient pays for an urgent consultation with this clinician. */
export const urgentPrice = (clinician: Pick<Clinician, "price">) => clinician.price + URGENT_FEE;

// ----------------------------------------------------------------------------------------------- free times

const HOUR_MS = 3_600_000;
/** How far ahead a consultation can be asked for, and how far ahead "free soon" looks: the next 48 hours. */
export const WINDOW_HOURS = 48;
/** How long a consultation is. */
export const CONSULTATION_MINUTES = 30;

/** Some of their hours are already taken by other people: the same ones each time, so the page doesn't jump about. */
function taken(clinician: Clinician, start: Date) {
  let hash = 0;
  for (const char of `${clinician.id}${Math.floor(start.getTime() / HOUR_MS)}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 3 === 0;
}

/** Whether an hour starting at `start` is in their usual hours and not in time off. */
export const works = (clinician: Clinician, start: Date) =>
  clinician.schedule.some(hours => hours.days.includes(start.getDay()) && start.getHours() >= hours.from && start.getHours() < hours.to)
  && !(clinician.timeOff ?? []).some(off => start.getTime() < off.to && start.getTime() + HOUR_MS > off.from);

/** The times they are free, on the hour, from at least an hour after `now` until `hours` hours on. `busy`: start times
 *  already booked with them on this device. An example clinician's other bookings are made up (`taken`); a clinician
 *  who signed up here has none but their own. */
export function freeTimes(clinician: Clinician, now = new Date(), hours = WINDOW_HOURS, busy: number[] = []): Date[] {
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  const end = now.getTime() + hours * HOUR_MS;
  const times: Date[] = [];
  for (let at = start.getTime() + 2 * HOUR_MS; at < end; at += HOUR_MS) {
    const time = new Date(at);
    if (works(clinician, time) && (clinician.own || !taken(clinician, time)) && !busy.some(booked => Math.abs(booked - at) < HOUR_MS)) times.push(time);
  }
  return times;
}

/** Whether they have any free time in the next 48 hours. */
export const freeSoon = (clinician: Clinician, now = new Date()) => freeTimes(clinician, now).length > 0;

/** Whether an urgent request reaches them now: always if they chose that, otherwise free in the next 48 hours (or today only), unless they switched alerts off. */
export function alertable(clinician: Clinician, now = new Date()) {
  const choice = clinician.urgentAlerts ?? "free48";
  if (choice === "never") return false;
  if (choice === "always") return true;
  const times = freeTimes(clinician, now);
  return choice === "today" ? times.some(time => time.toDateString() === now.toDateString()) : times.length > 0;
}

/** Their first free time in the next fortnight. */
export const nextFree = (clinician: Clinician, now = new Date()): Date | undefined => freeTimes(clinician, now, 24 * 14)[0];

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "Today", "Tomorrow" or "Wed 4 Nov". */
export function dayText(date: Date, now = new Date()) {
  const days = Math.round((dayStart(date) - dayStart(now)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** "14:00". */
export const clockText = (date: Date) => date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** "Today, 14:00". */
export const whenText = (date: Date, now = new Date()) => `${dayText(date, now)}, ${clockText(date)}`;

// ------------------------------------------------------------------------------------------- group sessions

/** A free weekly group session a clinician hosts to answer questions. The title is the question people actually ask,
 *  so it is clear at a glance who it is for; `about` says what you come away with. */
export type WeeklySession = { id: string; clinicianId: string; title: string; about: string; day: number; hour: number; minute: number; minutes: number; spaces: number; groupIds?: string[] };

export const WEEKLY_SESSIONS: WeeklySession[] = [
  { id: "stroke-prevention-qa", clinicianId: "amara-osei", title: "How do I lower my risk of another stroke?", about: "A stroke physician answers patients' questions on blood pressure, cholesterol, AF and the medicines that cut the risk of a second stroke.", day: 4, hour: 18, minute: 0, minutes: 45, spaces: 20, groupIds: ["stroke", "blood-pressure"] },
  { id: "young-stroke-qa", clinicianId: "amara-osei", title: "Stroke under 50: returning to work and family life", about: "Open Q&A for younger stroke survivors and their families: causes, driving, work and what recovery can look like.", day: 1, hour: 19, minute: 0, minutes: 60, spaces: 25, groupIds: ["stroke"] },
  { id: "moving-after-stroke", clinicianId: "priya-raman", title: "How do I walk further without falling?", about: "A neuro physio shows balance exercises you can do at home after a stroke, then takes your questions on walking, stairs and falls.", day: 1, hour: 17, minute: 0, minutes: 45, spaces: 12 },
  { id: "low-mood-after-illness", clinicianId: "kwame-mensah", title: "Why do I feel low now the worst is over?", about: "Many people feel flat or anxious weeks after an illness or treatment ends. A psychologist explains why, and the small steps that help.", day: 2, hour: 18, minute: 30, minutes: 60, spaces: 15 },
  { id: "diabetes-questions", clinicianId: "michael-chau", title: "What is my HbA1c really telling me?", about: "Bring your latest results. A diabetologist explains HbA1c, highs and lows, and what to ask at your next diabetes review.", day: 3, hour: 19, minute: 0, minutes: 45, spaces: 20 },
  { id: "heart-recovery", clinicianId: "ruth-calloway", title: "How active can I be after a heart attack?", about: "A cardiac rehab nurse on building up activity step by step, which chest symptoms to act on, and getting back to everyday life.", day: 4, hour: 12, minute: 30, minutes: 45, spaces: 15 },
  { id: "words-and-swallowing", clinicianId: "hannah-brooks", title: "When the words won't come: help with aphasia", about: "A speech and language therapist shares ways to make talking and swallowing easier after a stroke, for you and the family who help.", day: 6, hour: 11, minute: 0, minutes: 45, spaces: 10 },
];

/** One sitting of a group session: a weekly one on a given day, or one a clinician set up in their portal (which may
 *  repeat weekly too). `groupIds` are the Library groups it is listed with (`groupId` is the single group older saved
 *  sessions have). `price` is what the host charges for a place, in pounds: set by the clinician, free when missing or 0. */
export type GroupSession = { id: string; clinicianId: string; title: string; about: string; start: number; minutes: number; spaces: number; weekly: boolean; groupIds?: string[]; groupId?: string; price?: number };

/** The Library groups a session is listed with, from either the list or an older saved session's single group. */
export const sessionGroupIds = (session: Pick<GroupSession, "groupIds" | "groupId">): string[] => session.groupIds ?? (session.groupId ? [session.groupId] : []);

/** The most a clinician can charge for one place in a group session, in pounds. */
export const MAX_SESSION_PRICE = 200;

/** "Free" or "£10 a place". */
export const sessionPriceText = (session: Pick<GroupSession, "price">) => (session.price && session.price > 0 ? `£${session.price} a place` : "Free");

/** The next sitting of each weekly session (one still running counts), as dated sessions. */
export function nextWeeklySessions(now = new Date()): GroupSession[] {
  return WEEKLY_SESSIONS.map(series => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), series.hour, series.minute);
    start.setDate(start.getDate() + ((series.day - start.getDay() + 7) % 7));
    if (start.getTime() + series.minutes * 60_000 <= now.getTime()) start.setDate(start.getDate() + 7);
    const stamp = `${start.getFullYear()}${String(start.getMonth() + 1).padStart(2, "0")}${String(start.getDate()).padStart(2, "0")}`;
    return { id: `${series.id}-${stamp}`, clinicianId: series.clinicianId, title: series.title, about: series.about, start: start.getTime(), minutes: series.minutes, spaces: series.spaces, weekly: true, ...(series.groupIds ? { groupIds: series.groupIds } : {}) };
  });
}

/** The group sessions to list: the weekly ones and any set up in the portal that haven't finished, soonest first. */
export function upcomingSessions(created: GroupSession[], now = new Date()): GroupSession[] {
  const week = 7 * 86_400_000;
  const current = created.map(session => {
    if (!session.weekly || session.start + session.minutes * 60_000 > now.getTime()) return session;
    // A repeating one moves on a week at a time; each sitting has its own id (and room).
    const weeks = Math.ceil((now.getTime() - (session.start + session.minutes * 60_000)) / week);
    return { ...session, start: session.start + weeks * week, id: `${session.id}-w${weeks}` };
  });
  return [...nextWeeklySessions(now), ...current.filter(session => session.start + session.minutes * 60_000 > now.getTime())]
    .filter(session => findClinician(session.clinicianId))
    .sort((a, b) => a.start - b.start);
}

/** The room opens ten minutes before a session starts and closes when it ends. */
export const sessionOpen = (session: GroupSession, now = Date.now()) => now >= session.start - 10 * 60_000 && now < session.start + session.minutes * 60_000;
