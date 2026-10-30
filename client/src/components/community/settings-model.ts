import { settingsChoices, startHiddenWords, suggestedHiddenWords, type BreakChoice, type MessagesFrom, type PersonId, type PostsSeenBy, type RequestsFrom } from "@/content/community-samples";
import { canSee, cleanHiddenWord, hiddenWordIn, hourLabel, inQuietHours, LIMITS, onBreak, type CommunityMemory, type CommunitySettings, type SettingsSection } from "@/lib/community-store";

// The wording and small rules behind the Community settings page (F5): the one line under each
// section's name, the hours quiet time can start at, the break, the card preview, the privacy
// choices and the words a person hides. Everything here describes what happens on this device,
// and nothing more.

/** The sections. The address can name one (`?space=settings&section=quiet`), so it lives in the store. */
export type { SettingsSection };
/** The sections that open and close under Your profile: What you see, Reading and listening, Quiet times. */
export type SettingsPanel = "see" | "read" | "quiet";
export const SETTINGS_PANELS: SettingsPanel[] = ["see", "read", "quiet"];

/**
 * Where a link that names a section lands: one of the panels, or Your profile (whose older names,
 * "appear" and "friends", still lead there). Null when the address names none.
 */
export function settingsTarget(section: SettingsSection | null | undefined): SettingsPanel | "profile" | null {
  if (!section) return null;
  return (SETTINGS_PANELS as string[]).includes(section) ? section as SettingsPanel : "profile";
}

/* ---------------------------------------------------------------- privacy */

/** What each privacy choice means, said under it in Your privacy. */
export const privacyMeaning = {
  postsSeenBy: { friends: "Only your connections see what you share.", everyone: "Every verified clinician on Rehyn Connect sees what you share.", onlyMe: "What you share stays with you." } as Record<PostsSeenBy, string>,
  messagesFrom: { friends: "Only your connections can message you.", friendsAndGroups: "Connections, and clinicians in your groups, can message you.", noOne: "No one can message you." } as Record<MessagesFrom, string>,
  requestsFrom: { everyone: "Any verified clinician can ask to connect.", friendsOfFriends: "Only connections of your connections can ask.", noOne: "No one can send you a connection request. Requests already waiting stay in My Network." } as Record<RequestsFrom, string>,
};

const labelOf = <T extends string>(choices: { id: T; label: string }[], id: T): string => choices.find(choice => choice.id === id)?.label ?? "";
/** "1 friend", "3 friends", or the words for none. */
const counted = (count: number, one: string, many: string, none: string): string => (count === 0 ? none : `${count} ${count === 1 ? one : many}`);

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "7 October", or "Wednesday 7 October" with the weekday, on this device's calendar. */
export function dayLabel(at: number, weekday = false): string {
  const date = new Date(at);
  return `${weekday ? `${WEEKDAYS[date.getDay()]} ` : ""}${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/**
 * Who sees the person's posts, in the words each place uses: the label beside a post and in the
 * composer, the part of the settings summary, and what is said once a post is made.
 */
export function postsAudience(seenBy: PostsSeenBy): { label: string; summary: string; posted: string } {
  if (seenBy === "everyone") return { label: "All clinicians", summary: "posts for all clinicians", posted: "Posted for every clinician on Rehyn Connect." };
  if (seenBy === "onlyMe") return { label: "Only me", summary: "posts just for you", posted: "Posted. Only you can see it." };
  return { label: "Connections", summary: "posts for connections", posted: "Posted for your connections." };
}

/** The break on now: "none" once a break has ended, whatever was chosen. */
export const breakNow = (settings: CommunitySettings, now = Date.now()): BreakChoice => (onBreak(settings, now) ? settings.breakChoice : "none");

/** The line under each panel's name, in parts: "Gentle mode on", "2 hidden words". */
export function settingsSummaries(settings: CommunitySettings, now = Date.now()): Record<SettingsPanel, string[]> {
  const until = onBreak(settings, now) && settings.breakUntil !== null ? settings.breakUntil : null;
  return {
    see: [settings.gentleMode ? "Gentle mode on" : "Gentle mode off", counted(settings.hiddenWords.length, "hidden word", "hidden words", "no hidden words")],
    read: [settings.readAloud ? "Read aloud on" : "Read aloud off", `${labelOf(settingsChoices.textSize, settings.textSize).toLowerCase()} text`],
    quiet: [`Quiet from ${hourLabel(settings.quietFrom)} to ${hourLabel(settings.quietUntil)}`, ...(until !== null ? [`on a break until ${dayLabel(until)}`] : [])],
  };
}

/* ------------------------------------------------------------- quiet time */

const QUIET_HOURS = settingsChoices.quietFrom;
/** Whether quiet time already starts at the earliest (7 pm) or the latest (11 pm) hour it can. */
export const quietEdges = (from: number) => ({ earliest: from <= QUIET_HOURS[0], latest: from >= QUIET_HOURS[QUIET_HOURS.length - 1] });

/** Quiet time starting an hour earlier (-1) or later (+1), within 7 pm to 11 pm. */
export function stepQuietFrom(from: number, by: -1 | 1): number {
  const at = QUIET_HOURS.indexOf(from);
  const index = at >= 0 ? at + by : QUIET_HOURS.indexOf(21);
  return QUIET_HOURS[Math.min(QUIET_HOURS.length - 1, Math.max(0, index))];
}

/** What quiet time does: the Alerts badge in the toolbar stays quiet (the alerts are still there). Says so when it is on now. */
export const quietHint = (settings: CommunitySettings, at: Date = new Date()): string =>
  `The Alerts badge stays quiet from ${hourLabel(settings.quietFrom)} to ${hourLabel(settings.quietUntil)}${inQuietHours(settings, at) ? ". It's quiet time now." : ""}`;

/** What a break does, and when the one on now ends. */
export function breakHint(settings: CommunitySettings, now = Date.now()): string {
  return onBreak(settings, now) && settings.breakUntil !== null
    ? `The Alerts badge stays quiet until ${dayLabel(settings.breakUntil, true)}. Nothing is deleted.`
    : "During a break, the Alerts badge stays quiet. Nothing is deleted.";
}

/* -------------------------------------------------------------- the card */

/** Under the name on the card: the town (when it is shown and there is one), groups and friends. */
export function cardLine(showTown: boolean, town: string, groups: number, friends: number): string {
  const parts: string[] = [];
  if (showTown && town) parts.push(town);
  parts.push(groups === 0 ? "No groups yet" : `In ${groups} group${groups === 1 ? "" : "s"}`);
  parts.push(counted(friends, "friend", "friends", "No friends yet"));
  return parts.join(" · ");
}

/** The note under the card. It says "would": in this preview, nobody else sees it. */
export const cardNote = (messagesFrom: MessagesFrom): string =>
  `What other members would see when they tap your name.${messagesFrom === "friends" ? " Only friends could message you." : messagesFrom === "noOne" ? " No one could message you." : ""}`;

/** What "Show my town" puts on the card, from the town in the person's profile (Your profile, above it). */
export const townHint = (town: string): string => (town ? `Puts “${town}” under your name on your card` : "Add your town in Your profile, above.");

/** A line of post text for "Sample post at this size", from someone the person still sees. */
const sampleLines: { who: PersonId; text: string }[] = [
  { who: "hannah", text: "Our seven-day ESD service has halved 30-day readmissions." },
  { who: "ruth", text: "Joint cardiac and stroke rehab classes now run twice a week." },
  { who: "kwame", text: "A one-page mood screening flow for stroke clinics, for feedback." },
];
export function sampleLine(memory: CommunityMemory): { who: PersonId | null; text: string } {
  return sampleLines.find(line => canSee(memory, line.who) && !hiddenWordIn(line.text, memory.settings.hiddenWords)) ?? { who: null, text: "This is the size posts are in the feed." };
}

/* ----------------------------------------------------------- hidden words */

/** Phones type curly apostrophes ("don’t"); hidden words keep straight ones. */
export const typedWord = (input: string): string => input.replace(/[‘’ʼ]/g, "'");

/** Why a word can't be hidden, in plain words, or null when it can. */
export function hiddenWordProblem(input: string, words: string[]): string | null {
  if (!input.trim()) return "Write a word or a short phrase first.";
  const word = cleanHiddenWord(typedWord(input));
  if (!word) return "Use letters and numbers. Spaces, apostrophes and hyphens are fine too.";
  if (words.includes(word)) return `Posts that mention “${word}” are already hidden.`;
  if (words.length >= LIMITS.hiddenWords) return `You can hide up to ${LIMITS.hiddenWords} words. Remove one to add another.`;
  return null;
}

/** The word offered with one tap: the suggestions first, then any word hidden to begin with that was taken off. */
export function nextSuggestedWord(words: string[]): string | null {
  return [...suggestedHiddenWords, ...startHiddenWords].find(word => !words.includes(word)) ?? null;
}
