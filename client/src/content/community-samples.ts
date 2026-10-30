// Sample content for Rehyn Connect for clinicians, a preview. Every person, post, group, message, connection request
// and number here is an example (demo profiles, marked as such on their profiles), and nothing a person does on the page
// leaves their device. The people are the example clinicians of the directory (content/clinicians.ts), with the same
// names and photographic portraits everywhere they appear. The ids ("hannah", "garden" …) are only internal keys.

import { CLINICIANS, professionalTitle } from "./clinicians";

// The pictures live in public/community-art: a folder called "community" would make the server
// redirect the /community page to /community/.
const art = (id: string) => `/community-art/${id}.svg`;

export type PersonId = "hannah" | "kwame" | "tomas" | "grace" | "priya" | "joseph" | "ruth" | "michael" | "sophie" | "sarah" | "elena" | "arjun" | "imani" | "amara";
/** Who someone is in the network: a clinician (posts in the feed are only ever theirs) or an account not yet verified. */
export type MemberRole = "clinician" | "unverified";
export type Person = { id: PersonId; name: string; face: string; tint: string; about: string; town: string; clinicianId: string; title: string; role: MemberRole };

/** Which directory clinician each network person is. */
export const PERSON_CLINICIAN: Record<PersonId, string> = {
  hannah: "hannah-brooks", kwame: "kwame-mensah", tomas: "tomas-leal", grace: "grace-whitlow", priya: "priya-raman", joseph: "joseph-hartley",
  ruth: "ruth-calloway", michael: "michael-chau", sophie: "sophie-adair", sarah: "sarah-whitfield", elena: "elena-rossi", arjun: "arjun-mehta",
  imani: "imani-clarke", amara: "amara-osei",
};
export const PERSON_IDS = Object.keys(PERSON_CLINICIAN) as PersonId[];
/** The network person a directory clinician is, if they are one. */
export const personOfClinician = (clinicianId: string): PersonId | undefined => PERSON_IDS.find(id => PERSON_CLINICIAN[id] === clinicianId);

const asPerson = (id: PersonId): Person => {
  const clinician = CLINICIANS.find(item => item.id === PERSON_CLINICIAN[id])!;
  const title = professionalTitle(clinician);
  return { id, name: clinician.name, face: clinician.photo ?? "", tint: "#E4E7EA", about: `${title} · ${clinician.org ?? ""}`, town: clinician.place ?? "", clinicianId: clinician.id, title, role: "clinician" };
};
export const people = Object.fromEntries(PERSON_IDS.map(id => [id, asPerson(id)])) as Record<PersonId, Person>;

/**
 * Everyone who can appear in the network: the example clinicians, and Gary, an unverified account that joined two days
 * ago with no photo (his picture is his initial). Gary is blocked when the preview starts.
 */
export type MemberId = PersonId | "gary";
export type Pronoun = "he" | "she" | "they";
export type Member = { id: MemberId; name: string; face: string | null; tint: string; ink: string; initial: string; about: string; pronoun: Pronoun; role: MemberRole };
const personPronoun: Record<PersonId, Pronoun> = {
  hannah: "she", kwame: "he", tomas: "he", grace: "she", priya: "she", joseph: "he", ruth: "she", michael: "he", sophie: "she", sarah: "she", elena: "she",
  arjun: "he", imani: "she", amara: "she",
};
const asMember = (person: Person): Member => ({ id: person.id, name: person.name, face: person.face, tint: person.tint, ink: "#1E2A26", initial: person.name.replace(/^Dr\.? /, "").slice(0, 1), about: person.about, pronoun: personPronoun[person.id], role: person.role });
export const members: Record<MemberId, Member> = {
  ...(Object.fromEntries(PERSON_IDS.map(id => [id, asMember(people[id])])) as Record<PersonId, Member>),
  gary: { id: "gary", name: "Gary", face: null, tint: "#DDD7CB", ink: "#4F5A55", initial: "G", about: "Unverified account · joined 2 days ago", pronoun: "he", role: "unverified" },
};
export const MEMBER_IDS: MemberId[] = [...PERSON_IDS, "gary"];
export const isPersonId = (id: MemberId): id is PersonId => id !== "gary";
/** Only verified clinicians' posts reach the clinician feed (comment 10): the feed filters on this, not on labels. */
export const isClinician = (id: MemberId): boolean => members[id]?.role === "clinician";
/**
 * Words for sentences about someone: "he won't be told", "unblock him any time", "they are blocked".
 * `is` and `was` agree with the pronoun ("they are"); after a name, always write "is" ("Li Wei is").
 */
export const pronounWords: Record<Pronoun, { subject: string; object: string; possessive: string; is: string; was: string }> = {
  he: { subject: "he", object: "him", possessive: "his", is: "is", was: "was" },
  she: { subject: "she", object: "her", possessive: "her", is: "is", was: "was" },
  they: { subject: "they", object: "them", possessive: "their", is: "are", was: "were" },
};

/** The drawn face the person can choose to show in My community, instead of a photo or an initial. */
export const myDrawnFace = { face: art("e927f84031712ed18b12258221414d71"), tint: "#E6E2DA" };

export type SamplePhoto = { src: string; alt: string; tint: string };
// The photos posted in the preview are real photographs from Unsplash (free to use under the Unsplash License), kept
// in public/photos: tomatoes in pots by Tom Jur (unsplash.com/photos/BQgNC4arlKY) and a golden retriever puppy by
// Florian Schindler (unsplash.com/photos/v-WVryDsM0I). Neither shows a person.
export const photos = {
  tomatoes: { src: "/photos/tomatoes-in-pots.jpg", alt: "Ripe red cherry tomatoes on plants in pots, in the sun", tint: "#E8EFE4" },
  dog: { src: "/photos/puppy-on-a-lead.jpg", alt: "A golden retriever puppy on a blue lead, walking on the grass in a park", tint: "#EFEBE2" },
} satisfies Record<string, SamplePhoto>;

/** The one-tap ways to join in, so nobody has to type to take part. */
export type ReactionKind = "love" | "welldone" | "metoo" | "withyou";
export const REACTION_KINDS: ReactionKind[] = ["love", "welldone", "metoo", "withyou"];
export const reactionLabels: Record<ReactionKind, string> = { love: "Like", welldone: "Insightful", metoo: "Agree", withyou: "Support" };

export type FeelingId = "hopeful" | "proud" | "calm" | "tired" | "low" | "frustrated";
export const feelings: { id: FeelingId; label: string }[] = [
  { id: "hopeful", label: "Hopeful" },
  { id: "proud", label: "Proud" },
  { id: "calm", label: "Calm" },
  { id: "tired", label: "Tired" },
  { id: "low", label: "Low" },
  { id: "frustrated", label: "Frustrated" },
];
export const FEELING_IDS: FeelingId[] = feelings.map(feeling => feeling.id);

/* ------------------------------------------------------------------ groups */

/**
 * One top-level group per condition. Members start smaller groups (subgroups) inside them. This
 * list is a placeholder until the real one is confirmed.
 */
export type ConditionId = "stroke" | "parkinsons" | "ms" | "brain" | "spine" | "joint";
/** A medical condition clinicians gather around: what its groups are for, and the expertise found in them. */
export type Condition = { id: ConditionId; name: string; short: string; members: string; tint: string; ink: string; purpose: string; expertise: string };
// One neutral tile colour for every condition (comment 22): the accent marks selection and membership instead.
const tile = { tint: "#F3F4F6", ink: "#1F2933" };
export const conditions: Condition[] = [
  { id: "stroke", name: "Stroke", short: "Stroke", members: "1,240 clinicians", ...tile, purpose: "Acute care, rehabilitation and secondary prevention after stroke and TIA.", expertise: "Stroke physicians, neuro physios, SLTs, OTs, stroke nurses" },
  { id: "parkinsons", name: "Parkinson's", short: "Parkinson's · 610", members: "610 clinicians", ...tile, purpose: "Diagnosis, medicines, movement and non-motor symptoms in Parkinson's.", expertise: "Neurologists, geriatricians, PD nurses, physios, SLTs" },
  { id: "ms", name: "Multiple sclerosis", short: "Multiple sclerosis · 480", members: "480 clinicians", ...tile, purpose: "Disease-modifying therapy, relapse care, fatigue and mobility in MS.", expertise: "Neurologists, MS nurses, physios, OTs" },
  { id: "brain", name: "Brain injury", short: "Brain injury · 350", members: "350 clinicians", ...tile, purpose: "Acquired and traumatic brain injury: cognition, behaviour and return to work.", expertise: "Neuropsychologists, rehab physicians, OTs, SLTs" },
  { id: "spine", name: "Spinal cord injury", short: "Spinal cord injury · 190", members: "190 clinicians", ...tile, purpose: "Spinal cord injury rehabilitation, bladder and bowel care, and seating.", expertise: "Spinal injury consultants, physios, OTs, specialist nurses" },
  { id: "joint", name: "Hip and knee", short: "Hip and knee · 720", members: "720 clinicians", ...tile, purpose: "Joint replacement pathways, prehab and rehab after hip and knee surgery.", expertise: "Orthopaedic surgeons, MSK physios, OTs" },
];
export const CONDITION_IDS: ConditionId[] = conditions.map(condition => condition.id);
/** The condition groups the person is in when the preview starts. */
export const startConditions: ConditionId[] = ["stroke", "parkinsons"];

/**
 * Who can see a subgroup. Private ones are invisible to anyone not in them: not listed, searched,
 * counted or suggested. Public ones can be found and joined by anyone in that condition.
 */
export type GroupVisibility = "private" | "public";
/** The line on a subgroup's card: a game on now, something coming up, or the last thing said. */
export type GroupActivity = { text: string; kind: "game" | "soon" | "chat" };

export type SampleGroupId = "garden" | "walk" | "cook" | "music";
export type SuggestedGroupId = "knit" | "book";
/** Subgroups started by other members, which the person is not in when the preview starts. */
export type ConditionGroupId =
  | "finding" | "young" | "tuesday-tea"
  | "dance" | "tremor" | "steps" | "pd-carers"
  | "fatigue" | "cool" | "yoga"
  | "memory" | "work"
  | "sport" | "owls"
  | "new-hip" | "knee";
export type CommunityGroupId = SampleGroupId | SuggestedGroupId | ConditionGroupId;
/** Groups that can be joined with one tap: the public ones the person isn't in yet. */
export type JoinableGroupId = SuggestedGroupId | ConditionGroupId;
export type ThemeId = "gardening" | "walking" | "cooking" | "music" | "books" | "family" | "crafts" | "chatting";

/** A cover is a drawing, or a colour with a letter or a theme's sign on it. */
export type GroupCover = { image?: string; tint: string; ink: string; initial?: string; icon?: ThemeId };
/** `minutesAgo` dates a message already there when the page opens (the lounge shows its time). */
export type GroupMessage = { id: string; who: PersonId; text: string; note?: string; photo?: SamplePhoto; hearts: number; minutesAgo?: number };
export type SampleGroup = {
  id: CommunityGroupId;
  name: string;
  /** A line about the group, under its name. */
  about: string;
  cover: GroupCover;
  /** The challenge strip's colour, and the ink drawn on it (dark enough to read on both). */
  tint: string;
  ink: string;
  members: number;
  online: number;
  faces: PersonId[];
  unread: number;
  /** Something is happening there now: a small live dot on its cover. */
  active: boolean;
  challenge: { text: string; done: number; total: number };
  messages: GroupMessage[];
  /** One message that arrives while the group is open, after a moment of "is writing". */
  incoming: GroupMessage;
  /** What the feed's "My groups" card shows under the name. */
  preview?: string;
  /** How long before the page opened its last message was said, for its row in Messages. */
  lastMinutesAgo: number;
  /** Why a group is suggested. */
  why?: string;
  /** The condition group it sits inside, and who can see it. */
  conditionId: ConditionId;
  visibility: GroupVisibility;
  /** The line on its card in "Inside {condition}". */
  activity: GroupActivity;
};

// The clinician's own groups: condition-focused professional networks of clinicians with relevant expertise (comments 8
// and 16). Covers are a quiet grey tile with the group's initials; the accent marks membership instead.
const neutral = { tint: "#EEF0F2", ink: "#27323D" };
const cover = (initial: string): GroupCover => ({ ...neutral, initial });

export const sampleGroups: SampleGroup[] = [
  {
    id: "garden", name: "Stroke Rehabilitation Network", lastMinutesAgo: 20, conditionId: "stroke", visibility: "private",
    activity: { text: "Case discussion: shoulder pain after stroke", kind: "chat" },
    about: "Stroke physicians, therapists and nurses sharing practice across the rehabilitation pathway: early supported discharge, upper limb recovery, spasticity and community follow-up.",
    cover: cover("SR"), ...neutral, members: 186, online: 9, faces: ["hannah", "ruth", "grace", "joseph"], unread: 3, active: true,
    challenge: { text: "This month: share one audit or service improvement from your unit", done: 41, total: 186 },
    messages: [
      { id: "g1", who: "grace", text: "Has anyone moved their ESD team to a seven-day service? Interested in how you staffed the weekend OT cover.", hearts: 4 },
      { id: "g2", who: "hannah", text: "We did in April. Happy to share our rota and the dysphagia screening changes we made alongside it.", hearts: 11 },
      { id: "g3", who: "ruth", text: "Same question from the cardiac side: our joint stroke–AF clinic started last month. Early numbers look good.", hearts: 5 },
    ],
    incoming: { id: "g4", who: "joseph", text: "Uploading the hemiplegic shoulder pathway we use to the Library tonight.", hearts: 3 },
    preview: "Hannah Brooks: Happy to share our rota",
  },
  {
    id: "walk", name: "Parkinson's Clinical Network", lastMinutesAgo: 150, conditionId: "parkinsons", visibility: "public",
    activity: { text: "Arjun Mehta: LCIG referral criteria?", kind: "chat" },
    about: "Neurologists, Parkinson's nurse specialists, physios and SLTs discussing diagnosis, medication timing in hospital, device-aided therapies and multidisciplinary care.",
    cover: cover("PC"), ...neutral, members: 142, online: 4, faces: ["arjun", "kwame", "priya", "michael"], unread: 0, active: false,
    challenge: { text: "This month: review time-critical medication on your ward", done: 23, total: 142 },
    messages: [
      { id: "w1", who: "arjun", text: "Updated our referral criteria for device-aided therapies. Does anyone else use a shared MDT review before referral?", hearts: 14 },
      { id: "w2", who: "priya", text: "Yes, physio and SLT both attend ours. It caught two people who were better served by a medication review first.", hearts: 6 },
    ],
    incoming: { id: "w3", who: "kwame", text: "Worth adding a mood and cognition screen to that MDT. Happy to share the one we use.", hearts: 4 },
    preview: "Arjun Mehta: referral criteria",
  },
  {
    id: "cook", name: "Aphasia and Dysphagia Practice Group", lastMinutesAgo: 1500, conditionId: "stroke", visibility: "public",
    activity: { text: "Hannah Brooks shared a screening tool", kind: "chat" },
    about: "Speech and language therapists and colleagues sharing assessment tools, therapy approaches and patient information for communication and swallowing after stroke.",
    cover: cover("AD"), ...neutral, members: 98, online: 2, faces: ["hannah", "sophie", "imani", "grace"], unread: 0, active: false,
    challenge: { text: "This month: share one accessible patient leaflet", done: 12, total: 98 },
    messages: [
      { id: "c1", who: "hannah", text: "Our bedside swallow screen with the IDDSI levels on one page, in case it helps anyone revising theirs.", hearts: 18 },
      { id: "c2", who: "sophie", text: "Thank you. We have been aligning our texture-modified menus with IDDSI too: happy to compare notes.", hearts: 9 },
    ],
    incoming: { id: "c3", who: "imani", text: "Could we use this on the stroke unit for nurse-led screening? Would value your view.", hearts: 1 },
  },
  {
    id: "music", name: "Young Stroke Clinicians", lastMinutesAgo: 2900, conditionId: "stroke", visibility: "private",
    activity: { text: "Journal club Thursday, 1 pm", kind: "soon" },
    about: "A private group for clinicians running services for people who have a stroke under 55: causes, return to work, driving and family life.",
    cover: cover("YS"), ...neutral, members: 37, online: 2, faces: ["kwame", "ruth", "tomas"], unread: 1, active: false,
    challenge: { text: "This month: bring one case to journal club", done: 6, total: 37 },
    messages: [
      { id: "m1", who: "tomas", text: "Paper for Thursday: PFO closure outcomes in under-60s. I'll bring the slides.", hearts: 12 },
      { id: "m2", who: "ruth", text: "Can we also cover return-to-work advice? Two of my patients asked this week.", hearts: 4 },
    ],
    incoming: { id: "m3", who: "kwame", text: "I can add ten minutes on adjustment and identity after a young stroke.", hearts: 2 },
  },
];

export const suggestedGroups: SampleGroup[] = [
  {
    id: "knit", name: "Spasticity Management Forum", why: "Priya Raman and 14 others", lastMinutesAgo: 300, conditionId: "stroke", visibility: "public",
    activity: { text: "Botulinum toxin pathways", kind: "chat" },
    about: "Rehab physicians and therapists comparing botulinum toxin pathways, splinting and goal setting for post-stroke spasticity.",
    cover: cover("SM"), ...neutral, members: 64, online: 1, faces: ["priya", "grace", "hannah"], unread: 0, active: false,
    challenge: { text: "This month: share a goal attainment example", done: 9, total: 64 },
    messages: [
      { id: "k1", who: "priya", text: "We now set GAS goals with the patient before every injection clinic. Uptake has been good.", hearts: 6 },
      { id: "k2", who: "grace", text: "Do you include an OT goal each time? We have found it helps with upper limb function.", hearts: 3 },
    ],
    incoming: { id: "k3", who: "hannah", text: "Sharing our splinting leaflet in the Library this week.", hearts: 2 },
  },
  {
    id: "book", name: "Stroke Research Journal Club", why: "Monthly, online", lastMinutesAgo: 4300, conditionId: "stroke", visibility: "public",
    activity: { text: "Next paper: thrombectomy beyond 24 hours", kind: "chat" },
    about: "A monthly online journal club appraising new stroke research, with CPD reflection notes.",
    cover: cover("JC"), ...neutral, members: 212, online: 1, faces: ["tomas", "michael", "elena"], unread: 0, active: false,
    challenge: { text: "This month: appraise one paper", done: 18, total: 212 },
    messages: [
      { id: "b1", who: "tomas", text: "Slides from last month's session are pinned in the Library.", hearts: 4 },
      { id: "b2", who: "michael", text: "Could we cover glucose management in acute stroke next time?", hearts: 7 },
    ],
    incoming: { id: "b3", who: "elena", text: "Seconded, and kidney function with contrast too.", hearts: 3 },
  },
];

export const SAMPLE_GROUP_IDS: SampleGroupId[] = ["garden", "walk", "cook", "music"];
export const SUGGESTED_GROUP_IDS: SuggestedGroupId[] = ["knit", "book"];

/** What happened in a group today, shown as a small event in its chat. */
export const groupEvents: Partial<Record<CommunityGroupId, string>> = {
  garden: "Hannah Brooks pinned the ESD rota template · 10:12 am",
  music: "Tomás Leal scheduled journal club for Thursday · 9:40 am",
  walk: "Arjun Mehta made this group public · last week",
  cook: "Hannah Brooks made this group public · in June",
};

/** A professional group started by another clinician, with initials for its cover and one line said in it. */
function otherGroup(
  id: ConditionGroupId, name: string, conditionId: ConditionId, visibility: GroupVisibility, members: number, faces: PersonId[],
  activity: GroupActivity, about: string, said: string,
): SampleGroup {
  const initials = name.split(/\s+/).filter(word => /^[A-Z]/.test(word)).slice(0, 2).map(word => word[0]).join("");
  return {
    id, name, about, cover: cover(initials || name.charAt(0)), ...neutral, members, online: 1, faces, unread: 0, active: false,
    challenge: { text: "This month: introduce yourself and your service", done: 2, total: members },
    messages: [{ id: `${id}-1`, who: faces[0], text: said, hearts: 3 }],
    incoming: { id: `${id}-2`, who: faces[1], text: "Welcome to the group. Do share what your service is working on.", hearts: 1 },
    lastMinutesAgo: 600, conditionId, visibility, activity,
  };
}

/**
 * Professional groups inside each condition that the clinician can browse and join (comment 14). The private ones
 * ("Stroke Unit Leads", "PD Nurse Specialists") prove the rule: the clinician is not in them, so the model never shows,
 * counts, searches or suggests them.
 */
export const conditionGroups: SampleGroup[] = [
  otherGroup("finding", "Hyperacute Stroke Care", "stroke", "public", 154, ["imani", "tomas", "hannah"], { text: "Thrombolysis and thrombectomy pathways", kind: "chat" }, "Door-to-needle times, thrombectomy referral and the first 72 hours on the hyperacute stroke unit.", "Our door-to-needle median is down to 38 minutes after the pre-alert changes."),
  otherGroup("young", "Stroke Secondary Prevention", "stroke", "public", 121, ["tomas", "michael", "imani"], { text: "AF, lipids and blood pressure targets", kind: "chat" }, "Blood pressure, lipid and AF management after stroke and TIA, in hospital and primary care.", "Sharing our nurse-led blood pressure follow-up template."),
  otherGroup("tuesday-tea", "Stroke Unit Leads", "stroke", "private", 12, ["ruth", "michael", "priya"], { text: "Monthly leads meeting", kind: "soon" }, "A private group for stroke unit clinical leads.", "Agenda for the regional leads meeting is up."),
  otherGroup("dance", "Parkinson's Medication Safety", "parkinsons", "public", 88, ["arjun", "kwame", "imani"], { text: "Time-critical medicines in hospital", kind: "chat" }, "Getting Parkinson's medicines on time in hospital: audits, e-prescribing alerts and nil-by-mouth plans.", "Our missed-dose audit improved after we added ward alerts."),
  otherGroup("tremor", "Movement Disorders MDT", "parkinsons", "public", 57, ["arjun", "priya", "hannah"], { text: "Monthly virtual MDT", kind: "soon" }, "Virtual case discussion for complex Parkinson's and atypical parkinsonism.", "Two complex cases for next week's MDT, notes in the thread."),
  otherGroup("steps", "Falls and Gait in Parkinson's", "parkinsons", "public", 46, ["priya", "grace", "joseph"], { text: "Cueing strategies", kind: "chat" }, "Physiotherapy and OT approaches to freezing, gait and falls prevention.", "Laser cue shoes trial results are in: mixed, but promising for freezing."),
  otherGroup("pd-carers", "PD Nurse Specialists", "parkinsons", "private", 21, ["grace", "kwame", "joseph"], { text: "Caseload support", kind: "chat" }, "A private group for Parkinson's nurse specialists.", "Caseload numbers survey closes Friday."),
  otherGroup("fatigue", "MS Fatigue and Rehabilitation", "ms", "public", 63, ["grace", "priya", "kwame"], { text: "Energy management programmes", kind: "chat" }, "Fatigue management, exercise and vocational rehabilitation in multiple sclerosis.", "Our group energy-management course now runs online too."),
  otherGroup("cool", "MS Disease-Modifying Therapy", "ms", "public", 49, ["arjun", "michael", "sarah"], { text: "Monitoring schedules", kind: "chat" }, "Choosing, starting and monitoring disease-modifying therapies.", "Updated monitoring schedule for the newer DMTs attached."),
  otherGroup("yoga", "MS Mobility Clinic", "ms", "public", 31, ["priya", "joseph", "grace"], { text: "Thursday case review", kind: "soon" }, "Gait, spasticity and mobility aids in MS.", "Functional electrical stimulation referrals: who funds yours?"),
  otherGroup("memory", "Cognitive Rehabilitation", "brain", "public", 44, ["kwame", "hannah", "grace"], { text: "Memory strategy groups", kind: "chat" }, "Assessment and rehabilitation of memory, attention and executive function after brain injury.", "Sharing our memory strategy group outline."),
  otherGroup("work", "Vocational Rehabilitation", "brain", "public", 38, ["grace", "kwame", "joseph"], { text: "Return to work after ABI", kind: "chat" }, "Supporting return to work and study after acquired brain injury.", "Phased return plan template is in the Library."),
  otherGroup("sport", "Spinal Cord Injury Rehab", "spine", "public", 41, ["joseph", "priya", "grace"], { text: "Seating and posture", kind: "chat" }, "Rehabilitation, seating and community reintegration after spinal cord injury.", "New seating clinic referral form, comments welcome."),
  otherGroup("owls", "Neurogenic Bladder and Bowel", "spine", "public", 22, ["imani", "elena", "ruth"], { text: "Continence pathways", kind: "chat" }, "Bladder and bowel management after spinal cord injury.", "Our bowel care protocol is due for review: volunteers?"),
  otherGroup("new-hip", "Joint Replacement Pathways", "joint", "public", 72, ["joseph", "grace", "priya"], { text: "Enhanced recovery", kind: "chat" }, "Enhanced recovery, prehab and early mobilisation after hip and knee replacement.", "Day-case hip numbers are up since we started prehab classes."),
  otherGroup("knee", "MSK Physiotherapy Practice", "joint", "public", 66, ["joseph", "priya", "sophie"], { text: "Exercise prescription", kind: "chat" }, "Exercise prescription and follow-up after knee replacement and for osteoarthritis.", "Virtual follow-up audit: 82% satisfied, full results shared."),
];
export const CONDITION_GROUP_IDS = conditionGroups.map(group => group.id) as ConditionGroupId[];

/* ------------------------------------------------------------------- games */

/** Traditional games only, each with the number of players it needs. Games are for private groups. */
export type GameId = "chess" | "draughts" | "xiangqi" | "go" | "backgammon" | "ludo" | "dominoes" | "mahjong" | "battleships";
export type GameInfo = { id: GameId; name: string; min: number; max: number; time: string; tint: string };
/** In the order "Start a game" shows them. */
export const GAMES: GameInfo[] = [
  { id: "chess", name: "Chess", min: 2, max: 2, time: "about 30 min", tint: "#E5EEE7" },
  { id: "draughts", name: "Draughts", min: 2, max: 2, time: "about 15 min", tint: "#FBE3DB" },
  { id: "xiangqi", name: "Chinese chess", min: 2, max: 2, time: "about 30 min", tint: "#FBEBC2" },
  { id: "go", name: "Go", min: 2, max: 2, time: "as long as you like", tint: "#F1EBDD" },
  { id: "backgammon", name: "Backgammon", min: 2, max: 2, time: "about 20 min", tint: "#DCECF4" },
  { id: "ludo", name: "Ludo", min: 2, max: 4, time: "about 25 min", tint: "#E9E2F4" },
  { id: "dominoes", name: "Dominoes", min: 2, max: 4, time: "about 15 min", tint: "#F6EEDB" },
  { id: "mahjong", name: "Mahjong", min: 4, max: 4, time: "about 45 min", tint: "#E5EEE7" },
  { id: "battleships", name: "Battleships", min: 2, max: 2, time: "about 20 min", tint: "#DCE8EE" },
];
export const GAME_IDS: GameId[] = GAMES.map(game => game.id);
export const gameInfo = (id: GameId): GameInfo => GAMES.find(game => game.id === id) ?? GAMES[0];

/**
 * Games already going in the example groups. Chess moves are kept as codes ("e2e4"). Margaret vs
 * Joan has reached White's 14th move; the person's own game with Margaret has just begun.
 */
export type SampleGame = {
  id: string;
  groupId: SampleGroupId;
  type: GameId;
  /** Who is playing, besides the person when `withYou` is set. */
  players: PersonId[];
  withYou: boolean;
  state: "playing" | "scheduled";
  moves: string[];
  /** When it started, or when it will. */
  when: string;
  watchers: PersonId[];
};
// The clinician edition has no games (comment 7): the professional groups start with none going.
export const sampleGames: SampleGame[] = [];
/** Quick phrases for the people watching a game, and the answer each one gets. */
export const watcherPhrases: { label: string; tone: QuickTone; reply: { who: PersonId; text: string } }[] = [
  { label: "Good move!", tone: "amber", reply: { who: "hannah", text: "Flattery will not save your knight." } },
  { label: "Hmm, let me think", tone: "mint", reply: { who: "grace", text: "Take your time, love. No clock!" } },
  { label: "Cup of tea break?", tone: "rose", reply: { who: "hannah", text: "Always. Two sugars, please." } },
];

/* ---------------------------------------------------------- start a group */

export type GroupTheme = { id: ThemeId; label: string; names: [string, string, string]; image?: string; tint: string; ink: string };
// The kinds of professional group a clinician can start. (The ids are the patient edition's internal keys.)
export const groupThemes: GroupTheme[] = [
  { id: "gardening", label: "Clinical practice", names: ["Stroke Rehab Practice", "Neuro Therapy Forum", "Community Rehab Leads"], tint: "#EEF0F2", ink: "#27323D" },
  { id: "walking", label: "Case discussion", names: ["Complex Case Review", "Virtual MDT", "Case of the Week"], tint: "#EEF0F2", ink: "#27323D" },
  { id: "cooking", label: "Service improvement", names: ["Pathway Redesign", "Audit and QI", "Service Leads"], tint: "#EEF0F2", ink: "#27323D" },
  { id: "music", label: "Research", names: ["Research Collaborative", "Trial Recruiters", "Evidence Review"], tint: "#EEF0F2", ink: "#27323D" },
  { id: "books", label: "Journal club", names: ["Journal Club", "Paper of the Month", "Critical Appraisal"], tint: "#EEF0F2", ink: "#27323D" },
  { id: "family", label: "Education", names: ["Teaching and Training", "CPD Exchange", "Registrar Teaching"], tint: "#EEF0F2", ink: "#27323D" },
  { id: "crafts", label: "Peer support", names: ["Clinician Peer Support", "New Consultants", "Reflective Practice"], tint: "#EEF0F2", ink: "#27323D" },
  { id: "chatting", label: "General discussion", names: ["Open Forum", "Network Lounge", "Clinicians' Corner"], tint: "#EEF0F2", ink: "#27323D" },
];
export const THEME_IDS: ThemeId[] = groupThemes.map(theme => theme.id);

/** A board of light and sage squares, the cover of a games group. */
const checkerCover = `data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 120' preserveAspectRatio='xMidYMid slice'><defs><pattern id='c' width='30' height='30' patternUnits='userSpaceOnUse'><rect width='30' height='30' fill='#EFE6D2'/><path d='M0 0h15v15H0zM15 15h15v15H15z' fill='#8DB09A'/></pattern></defs><rect width='240' height='120' fill='url(#c)'/></svg>")}`;
/** Starting a group offers a games theme too. Its icon is drawn by the games pieces, not ThemeIcon. */
export type StartThemeId = ThemeId | "games";
export type StartTheme = Omit<GroupTheme, "id"> & { id: StartThemeId };
export const gamesTheme: StartTheme = { id: "games", label: "Games", names: ["Board game club", "Chess and tea", "Friday games"], image: checkerCover, tint: "#E5EEE7", ink: "#173D2F" };
/** The themes "What's it about?" offers, in order. Crafts stays readable for groups started before. */
export const startThemes: StartTheme[] = [...groupThemes.slice(0, 4), ...groupThemes.filter(theme => theme.id === "books" || theme.id === "family" || theme.id === "chatting")];
export const START_THEME_IDS: StartThemeId[] = [...THEME_IDS, "games"];
/** The example connections who can be invited, and the two ticked to begin with. */
export const inviteFriends: PersonId[] = ["hannah", "ruth", "grace", "kwame", "priya", "joseph"];
export const defaultInvites: PersonId[] = ["hannah", "grace"];
export const groupHellos = ["Welcome, everyone.", "Please introduce yourself and your service.", "What are you working on this month?"];
export const startedGroupChallenge = "This month: introduce yourself and your service";
export const GROUP_NAME_LIMIT = 40;

/* -------------------------------------------------------------------- feed */

export type SampleComment = { who: PersonId; text: string };
export type SamplePost = {
  id: string;
  who: MemberId;
  group?: SampleGroupId;
  where: string;
  when: string;
  /** What the post says. For a voice note, these are the words written underneath it. */
  text: string;
  photo?: SamplePhoto;
  voice?: { seconds: number };
  win?: boolean;
  reactions: { kind: ReactionKind; count: number }[];
  comments: SampleComment[];
  /** Show the latest comment under the post before the thread is opened. */
  peek?: boolean;
  /** Replies that can be sent with one tap. */
  quickReplies: string[];
  /** A sad or upsetting post: gentle mode keeps it covered until it is tapped. Says what it is about. */
  gentle?: string;
};

// The clinician feed: posts from other clinicians in the network, about practice, services and research (comment 10).
// The feed shows a post only when its author's role is "clinician" (isClinician), so the unverified account's post below
// never reaches it, blocked or not.
export const feedPosts: SamplePost[] = [
  {
    id: "p-gary", who: "gary", where: "Unverified account", when: "5 minutes ago",
    text: "Clinicians! Earn £500 a week recommending our stroke recovery supplement to your patients. Message me.",
    reactions: [],
    comments: [],
    quickReplies: [],
  },
  {
    id: "p-hannah", who: "hannah", group: "garden", where: "Bath Community Therapy Service", when: "20 minutes ago",
    text: "Three months into our seven-day early supported discharge service: median time to first therapy visit is down from 4 days to 1, and readmissions at 30 days have halved. Happy to share the rota model and the dysphagia screening changes we made alongside it.",
    reactions: [{ kind: "welldone", count: 24 }, { kind: "love", count: 11 }, { kind: "metoo", count: 3 }],
    comments: [
      { who: "ruth", text: "Impressive numbers. How did you staff weekend SLT cover?" },
      { who: "grace", text: "We are planning the same in Bristol. Would love the rota." },
      { who: "joseph", text: "Did you track patient-reported outcomes too?" },
      { who: "priya", text: "Great work, Hannah. Sharing with our service lead." },
    ],
    peek: true,
    quickReplies: ["Great results", "Please share the rota", "Thanks for sharing"],
  },
  {
    id: "p-tomas", who: "tomas", where: "St Bartholomew Heart Centre", when: "1 hour ago",
    text: "Question for the network: for patients with AF detected after an ischaemic stroke, when are you starting anticoagulation? We are reviewing our timing guidance against the latest trial data and would value how other units decide.",
    reactions: [{ kind: "welldone", count: 18 }, { kind: "metoo", count: 7 }],
    comments: [
      { who: "imani", text: "We follow the infarct-size approach, with early starts for minor strokes. Happy to share our protocol." },
      { who: "michael", text: "Worth adding renal function to the checklist; we have had a few dosing issues." },
      { who: "elena", text: "Agree with Michael. We review eGFR at 48 hours before choosing the agent." },
    ],
    quickReplies: ["Following this", "Will share our protocol", "Good question"],
  },
  {
    id: "p-priya", who: "priya", group: "walk", where: "Northfield Neuro Rehab Centre", when: "2 hours ago",
    text: "Our falls clinic audit for people with Parkinson's is done: adding a structured cueing session to the first appointment reduced reported freezing episodes at 12 weeks. Slides and the cueing handout are now in the Library under Parkinson's.",
    reactions: [{ kind: "welldone", count: 12 }, { kind: "love", count: 8 }],
    comments: [
      { who: "arjun", text: "Excellent. Could we bring this to the movement disorders MDT next month?" },
      { who: "grace", text: "Downloaded the handout already, thank you." },
    ],
    quickReplies: ["Useful, thanks", "Saved to my pages", "Let's discuss at MDT"],
  },
  {
    id: "p-kwame", who: "kwame", where: "Southbank Clinical Psychology", when: "3 hours ago",
    text: "Reminder for anyone running stroke clinics: around a third of patients have depression in the first year. We have put together a one-page screening and referral flow for non-psychology colleagues. Feedback welcome before we publish it.",
    reactions: [{ kind: "welldone", count: 14 }, { kind: "metoo", count: 6 }],
    comments: [
      { who: "grace", text: "Really useful for our community team. Does it cover aphasia-friendly screening?" },
      { who: "hannah", text: "Happy to help adapt it for people with aphasia." },
    ],
    quickReplies: ["Happy to review", "Very useful", "Thank you"],
  },
  {
    id: "p-ruth", who: "ruth", where: "Whitby Cardiac Rehabilitation", when: "3 hours ago",
    text: "We now run a joint cardiac and stroke rehabilitation exercise class twice a week. Uptake among stroke patients with heart disease has doubled since we stopped referring them to two separate programmes.",
    reactions: [{ kind: "welldone", count: 15 }, { kind: "love", count: 9 }, { kind: "metoo", count: 4 }],
    comments: [
      { who: "tomas", text: "Great model. Who supervises the exercise prescription?" },
      { who: "priya", text: "We would love to visit and see the class." },
    ],
    quickReplies: ["Great idea", "How is it funded?", "Interested"],
  },
  {
    id: "p-sarah", who: "sarah", where: "Northern Cancer Centre", when: "4 hours ago",
    text: "Our survivorship clinic is looking for neuro and stroke colleagues to co-author a short guide on stroke risk after radiotherapy to the head and neck. Message me if you would like to be involved.",
    reactions: [{ kind: "withyou", count: 6 }, { kind: "love", count: 4 }],
    comments: [
      { who: "michael", text: "Count me in for the vascular risk section." },
    ],
    quickReplies: ["Interested", "Will message you", "Sharing with colleagues"],
  },
];
export const FEED_POST_IDS = feedPosts.map(post => post.id);

/* ------------------------------------------------------------------ lounge */

export type LoungeMessage = GroupMessage;
export type LoungeEvent =
  | { kind: "typing"; who: PersonId }
  | { kind: "message"; message: LoungeMessage }
  | { kind: "arrive"; who: PersonId; text: string };
export type QuickTone = "mint" | "blue" | "amber" | "lilac" | "rose";
export type PollOption = { id: string; label: string; votes: number; fill: string };

export const lounge = {
  here: 14,
  /** One event every this many milliseconds, until the script has run. */
  everyMs: 2600,
  starter: "What are you looking forward to this week?",
  faces: ["hannah", "kwame", "grace", "tomas"] as PersonId[],
  messages: [
    { id: "l1", who: "hannah", text: "My granddaughter visits on Saturday. I'm going to pour the tea myself.", hearts: 6, minutesAgo: 9 },
    { id: "l2", who: "tomas", note: "New member", text: "First week home. A bit scared, if I'm honest.", hearts: 9, minutesAgo: 6 },
    { id: "l3", who: "grace", text: "My first week was the hardest too. It does get lighter, promise.", hearts: 5, minutesAgo: 5 },
    { id: "l4", who: "kwame", text: "Come walking with us on Wednesday, Tomasz. Seven o'clock by the harbour. Biscuit loves new people.", hearts: 4, minutesAgo: 3 },
  ] as LoungeMessage[],
  /** The house rules beside the lounge. */
  rules: [
    "Be kind. Everyone here is recovering at their own pace.",
    "Share experience, not medical advice. That stays with your care team.",
    "Report anything that worries you in one tap. It stays private.",
  ],
  script: [
    { kind: "typing", who: "priya" },
    { kind: "message", message: { id: "l5", who: "priya", text: "Morning all! Sun's out in Leicester today.", hearts: 2 } },
    { kind: "arrive", who: "ruth", text: "Joan just came in" },
    { kind: "typing", who: "ruth" },
    { kind: "message", message: { id: "l6", who: "ruth", text: "Kettle's on. Who wants one?", hearts: 4 } },
    { kind: "typing", who: "kwame" },
    { kind: "message", message: { id: "l7", who: "kwame", text: "Biscuit says hello to the newcomers.", photo: photos.dog, hearts: 7 } },
    { kind: "arrive", who: "joseph", text: "Samuel just came in" },
    { kind: "typing", who: "grace" },
    { kind: "message", message: { id: "l8", who: "grace", text: "Tomasz, how was your first night home?", hearts: 3 } },
  ] as LoungeEvent[],
  waves: [
    { who: "tomas", note: "Dover · new this week" },
    { who: "hannah", note: "Leeds" },
    { who: "grace", note: "Bath" },
    { who: "priya", note: "Leicester" },
    { who: "ruth", note: "Whitby" },
  ] as { who: PersonId; note: string }[],
  poll: {
    question: "What's in your mug right now?",
    options: [
      { id: "tea", label: "Tea", votes: 9, fill: "#F3E3DA" },
      { id: "coffee", label: "Coffee", votes: 5, fill: "#E7DCCB" },
      { id: "cocoa", label: "Hot chocolate", votes: 3, fill: "#E9E2F4" },
    ] as PollOption[],
  },
  /** `to` is who a reply is for: it is left out while that person is out of sight. */
  quickReplies: [
    { label: "Hello everyone", text: "Hello everyone!", tone: "mint" },
    { label: "Welcome, Tomasz", text: "Welcome, Tomasz!", tone: "blue", to: "tomas" },
    { label: "Well done, Margaret", text: "Well done, Margaret!", tone: "amber", to: "hannah" },
    { label: "Thinking of you all", text: "Thinking of you all.", tone: "lilac" },
  ] as { label: string; text: string; tone: QuickTone; to?: PersonId }[],
};
export const POLL_OPTION_IDS = lounge.poll.options.map(option => option.id);

export const groupQuickReplies: { label: string; text: string; tone: QuickTone }[] = [
  { label: "Thanks for sharing", text: "Thanks for sharing.", tone: "mint" },
  { label: "Could you share the protocol?", text: "Could you share the protocol or template?", tone: "blue" },
  { label: "Happy to discuss", text: "Happy to discuss this at the next MDT.", tone: "amber" },
];

/* ---------------------------------------------------------- Sunday circle */

/** (The patient edition's circle seats; the clinician edition replaces the circle with group weekly sessions.) */
export type CircleSeat = "hannah" | "kwame" | "tomas" | "grace" | "priya" | "joseph" | "ruth" | "michael" | "alira" | "you";
/**
 * Who sits in the circle and how the teacup goes round. What the circle is about (its event: a film night, a
 * book club, football together …), what everyone says and what comes up next are in circle-events.ts.
 */
export const circle = {
  /** The teacup moves on this often, unless it is with you. */
  everyMs: 3400,
  /** Who speaks next. "you" is skipped until you have taken your seat. */
  order: ["alira", "hannah", "kwame", "priya", "tomas", "you", "ruth", "grace", "michael", "joseph"] as CircleSeat[],
  /** Where each one sits: ten places round the circle, clockwise from the top. */
  seats: { alira: 0, kwame: 1, michael: 2, tomas: 3, priya: 4, you: 5, grace: 6, joseph: 7, hannah: 8, ruth: 9 } as Record<CircleSeat, number>,
  /** Lines that send a little warmth floating up when they are said. */
  warmLines: ["hannah", "priya"] as CircleSeat[],
  hello: "Hello everyone. Glad to be here.",
};
/** Every seat in the circle, the person's own included. */
export const CIRCLE_SEATS = Object.keys(circle.seats).length;

/* ----------------------------------------------------------------- friends */

// My Network when the preview starts (comment 5). Each example clinician is in one place only:
//   connections         Kwame Mensah, Hannah Brooks, Grace Whitlow and Imani Clarke
//   asking to connect   Ruth Calloway and Michael Chau
//   requested by you    Tomás Leal, two days ago
//   people you may know Joseph Hartley and Priya Raman
//   not yet connected   everyone else in the directory (Sophie, Sarah, Elena, Arjun)
//   blocked             Gary, an unverified account, three days ago
// The clinician directory (/clinicians) reads and changes the same state, so the two always agree.

export type FriendsTab = "requests" | "sent" | "friends" | "blocked";
export const FRIENDS_TABS: FriendsTab[] = ["requests", "sent", "friends", "blocked"];
export const friendsTabLabels: Record<FriendsTab, string> = { requests: "Invitations", sent: "Sent", friends: "Connections", blocked: "Blocked" };

/** The connections the clinician has to begin with, and how each one is doing right now. */
export type StartFriend = { who: PersonId; status: string; online: boolean };
export const startFriends: StartFriend[] = [
  { who: "kwame", status: "Online now", online: true },
  { who: "hannah", status: "Active 1 hour ago", online: false },
  { who: "grace", status: "Active yesterday", online: false },
  { who: "imani", status: "Active today", online: false },
];

export type IncomingRequestId = "ruth" | "michael";
export type IncomingRequest = { who: IncomingRequestId; where: string; mutual: PersonId[]; mutualText: string; note: string };
/** Connection requests waiting for the clinician. */
export const incomingRequests: IncomingRequest[] = [
  { who: "ruth", where: "Cardiac rehabilitation nurse · Whitby · in Stroke Rehabilitation Network with you", mutual: ["hannah", "grace"], mutualText: "Hannah Brooks and Grace Whitlow are connections of yours", note: "We both run joint cardiac and stroke rehab. Would be good to connect." },
  { who: "michael", where: "Consultant diabetologist · Manchester · in Young Stroke Clinicians with you", mutual: ["kwame"], mutualText: "Kwame Mensah is a connection of yours", note: "" },
];
export const INCOMING_REQUEST_IDS: IncomingRequestId[] = incomingRequests.map(request => request.who);

/** Requests the clinician sent before this visit, still waiting for an answer. */
export const startSent: { who: PersonId; daysAgo: number }[] = [{ who: "tomas", daysAgo: 2 }];

export const friendSuggestions: { who: PersonId; why: string }[] = [
  { who: "joseph", why: "Also in Aphasia and Dysphagia Practice Group" },
  { who: "priya", why: "Connected with Kwame Mensah and Hannah Brooks" },
];

/** People blocked before this visit. */
export const startBlocked: { who: MemberId; daysAgo: number }[] = [{ who: "gary", daysAgo: 3 }];

/* ---------------------------------------------------------------- messages */

// Messages between the clinician and their connections (comment 23). The colleagues' words are examples; anything the
// clinician writes stays on this device, and a colleague's answer is an example too.

/** One line in a conversation, `minutesAgo` before the page opened. A voice note has its words as `text`. */
export type DirectLine = { id: string; from: "them" | "you"; text: string; minutesAgo: number; voice?: { seconds: number } };
export type Conversation = {
  who: PersonId;
  lines: DirectLine[];
  /** How many of the newest lines from them are waiting to be read. */
  unread: number;
  /** What they say back, a moment after the person writes (once a visit). */
  reply: string;
  quickReplies: string[];
  about: string;
  memberSince: string;
  friendsSince: string;
};

export const conversations: Conversation[] = [
  {
    who: "hannah", unread: 2,
    lines: [
      { id: "dm-m1", from: "you", text: "Your ESD results are impressive. Could you share the weekend rota model with our team?", minutesAgo: 24 },
      { id: "dm-m2", from: "them", text: "Of course. I'll upload it to the Library under Stroke, in the network's folder, this afternoon.", minutesAgo: 13 },
      { id: "dm-m3", from: "them", text: "Happy to join a call with your service lead next week if that helps.", minutesAgo: 12 },
    ],
    reply: "Great. Thursday at 1 pm works for me. I'll send an invite.",
    quickReplies: ["Thank you", "Thursday works", "I'll send an invite"],
    about: "Speech and language therapist specialising in aphasia and dysphagia after stroke, and communication support in dementia.",
    memberSince: "March 2026", friendsSince: "September 2026",
  },
  {
    who: "kwame", unread: 1,
    lines: [
      { id: "dm-d1", from: "you", text: "Could we co-present the mood screening flow at the regional stroke forum?", minutesAgo: 180 },
      { id: "dm-d2", from: "them", text: "Yes, gladly. I can cover the screening tools and the referral criteria if you take the clinic workflow.", minutesAgo: 40 },
    ],
    reply: "Sounds good. I'll draft the slides and share them with you by Friday.",
    quickReplies: ["Agreed", "I'll draft the slides", "Thank you"],
    about: "Clinical psychologist working with adjustment, low mood and fear of recurrence after stroke and cardiac events.",
    memberSince: "January 2026", friendsSince: "August 2026",
  },
  {
    who: "grace", unread: 0,
    lines: [
      { id: "dm-a1", from: "you", text: "Thanks for the return-to-work template. We used it in clinic this week.", minutesAgo: 1500 },
      { id: "dm-a2", from: "them", text: "Glad it helped. Let me know how patients find it and I'll update it.", minutesAgo: 1440 },
    ],
    reply: "Will do. I'll send feedback after next week's clinic.",
    quickReplies: ["Will do", "Thanks again", "Speak soon"],
    about: "Occupational therapist in community neuro rehab: return to work, fatigue management and home adaptations.",
    memberSince: "February 2026", friendsSince: "September 2026",
  },
];
export const CONVERSATION_IDS: PersonId[] = conversations.map(item => item.who);
/** For a connection with no messages yet: how a new conversation starts. */
export const newConversation = {
  reply: "Hello, thanks for getting in touch. How can I help?",
  quickReplies: ["Hello", "Thanks for connecting", "Could we arrange a call?"],
};

/* ------------------------------------------------------------------ safety */

export type ReportReason = "money" | "health" | "unkind" | "fake" | "other";
export const reportReasons: { id: ReportReason; label: string; tint: string; ink: string }[] = [
  { id: "money", label: "Promotion, selling or a conflict of interest", tint: "#F3F4F6", ink: "#27323D" },
  { id: "health", label: "Unsafe clinical advice", tint: "#F3F4F6", ink: "#27323D" },
  { id: "unkind", label: "Unprofessional conduct", tint: "#F3F4F6", ink: "#27323D" },
  { id: "fake", label: "Not a registered clinician", tint: "#F3F4F6", ink: "#27323D" },
  { id: "other", label: "Something else", tint: "#F3F4F6", ink: "#27323D" },
];
export const REPORT_REASONS: ReportReason[] = reportReasons.map(reason => reason.id);

/* ------------------------------------------------------------------ alerts */

export type AlertId = "a-circle" | "a-ruth" | "a-garden" | "a-michael";
/** Where an alert leads: the Friends drawer at a tab, one of the person's groups, or a space. */
export type AlertTarget =
  | { kind: "friends"; tab: FriendsTab }
  | { kind: "group"; group: SampleGroupId }
  | { kind: "space"; space: "feed" | "lounge" | "circle" | "groups" | "settings" | "safety" };
export type CommunityAlert = { id: AlertId; who: PersonId | null; icon: "friend" | "group" | "circle"; title: string; detail: string; when: string; target: AlertTarget };
/** What is new in My community, newest first. The toolbar shows "Alerts, 4 new" until they are seen. */
// (Alerts have no place in clinician navigation, comment 6; the examples stay professional for the code that reads them.)
export const communityAlerts: CommunityAlert[] = [
  { id: "a-circle", who: null, icon: "circle", title: "Your group weekly session starts soon", detail: "Patients have sent questions in advance", when: "Now", target: { kind: "space", space: "circle" } },
  { id: "a-ruth", who: "ruth", icon: "friend", title: "Ruth Calloway wants to connect", detail: "We both run joint cardiac and stroke rehab. Would be good to connect.", when: "10 minutes ago", target: { kind: "friends", tab: "requests" } },
  { id: "a-garden", who: "hannah", icon: "group", title: "3 new messages in Stroke Rehabilitation Network", detail: "Hannah Brooks: Happy to share our rota", when: "20 minutes ago", target: { kind: "group", group: "garden" } },
  { id: "a-michael", who: "michael", icon: "friend", title: "Michael Chau wants to connect", detail: "Also in Young Stroke Clinicians", when: "1 hour ago", target: { kind: "friends", tab: "requests" } },
];
export const ALERT_IDS: AlertId[] = communityAlerts.map(alert => alert.id);

/* --------------------------------------------------------------- settings */

/** The picture the person shows: their photo, a monogram, a portrait, an emblem, an illustrated face or the drawn face. */
export { PICTURE_CHOICES, type PictureChoice } from "./community-pictures";
export type RequestsFrom = "everyone" | "friendsOfFriends" | "noOne";
export type MessagesFrom = "friends" | "friendsAndGroups" | "noOne";
export type PostsSeenBy = "everyone" | "friends" | "onlyMe";
export type TextSize = "smaller" | "normal" | "bigger";
export type BreakChoice = "none" | "day" | "week";

/** The choices on the Community settings page, in the order they are shown. */
export const settingsChoices = {
  requestsFrom: [{ id: "everyone", label: "Any verified clinician" }, { id: "friendsOfFriends", label: "Second-degree connections" }, { id: "noOne", label: "No one" }] as { id: RequestsFrom; label: string }[],
  messagesFrom: [{ id: "friends", label: "Only connections" }, { id: "friendsAndGroups", label: "Connections and my groups" }, { id: "noOne", label: "No one" }] as { id: MessagesFrom; label: string }[],
  /** Who sees the person's own posts in the feed. */
  postsSeenBy: [{ id: "everyone", label: "All clinicians" }, { id: "friends", label: "Connections" }, { id: "onlyMe", label: "Only me" }] as { id: PostsSeenBy; label: string }[],
  /** The size of post text at each choice (normal is the size the feed was designed at). */
  textSize: [{ id: "smaller", label: "Smaller", px: 16 }, { id: "normal", label: "Normal", px: 19 }, { id: "bigger", label: "Bigger", px: 23 }] as { id: TextSize; label: string; px: number }[],
  /** When quiet time can start, as hours of the day (7 pm to 11 pm). It ends at 8 am. */
  quietFrom: [19, 20, 21, 22, 23],
  breakFor: [{ id: "none", label: "No break" }, { id: "day", label: "1 day" }, { id: "week", label: "1 week" }] as { id: BreakChoice; label: string }[],
};
export const REQUESTS_FROM: RequestsFrom[] = settingsChoices.requestsFrom.map(choice => choice.id);
export const MESSAGES_FROM: MessagesFrom[] = settingsChoices.messagesFrom.map(choice => choice.id);
export const POSTS_SEEN_BY: PostsSeenBy[] = settingsChoices.postsSeenBy.map(choice => choice.id);
export const TEXT_SIZES: TextSize[] = settingsChoices.textSize.map(choice => choice.id);
export const BREAK_CHOICES: BreakChoice[] = settingsChoices.breakFor.map(choice => choice.id);
/** Words hidden to begin with, and some that can be added with one tap. */
export const startHiddenWords: string[] = [];
export const suggestedHiddenWords = ["sponsored", "supplement", "politics"];
