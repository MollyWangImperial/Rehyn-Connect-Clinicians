import { useSyncExternalStore } from "react";
import { findClinician, groupPlace } from "@/content/clinicians";
import { conversations, newConversation, people, PERSON_IDS, sampleGroups, startFriends, type Conversation, type PersonId } from "@/content/community-samples";
import { canSee, communityStore, friendList, relationship, type CommunityMemory, type NoteDraft, type OwnNote } from "@/lib/community-store";
import { lastLine, myGroups, type GroupModel } from "./group-model";

// Messages (the Messages page and the small Messages window at the bottom of each page): professional
// conversations with the clinician's connections in My Network, and their clinical groups. The colleagues'
// words are examples. What the clinician writes is kept on this device, and a colleague's answer to it is an
// example that arrives during this visit only.

const MINUTE = 60_000;

/** One line in a conversation. `removable` lines are the clinician's own, kept on this device. */
export type ChatLine =
  | { kind: "theirs"; id: string; at: number; who: PersonId; text: string }
  | { kind: "mine"; id: string; at: number; note: Pick<OwnNote, "text" | "photo">; removable: boolean };

/** Where someone stands in My Network, in the words the network uses. */
export type ConnectionWord = "Connected" | "Pending" | "Connect";

export type DirectChat = {
  kind: "direct";
  id: PersonId;
  name: string;
  /** "Specialist speech & language therapist". */
  title: string;
  /** "Bath Community Therapy Service · Bath". */
  workplace: string;
  /** Their profile page in the clinician directory. */
  profileHref: string;
  connection: ConnectionWord;
  conversation: Conversation | null;
  lines: ChatLine[];
  /** Lines from them still waiting to be read. */
  unread: number;
  muted: boolean;
  lastAt: number;
  /** The newest line, for the row in the list. */
  snippet: string;
  /** "Online now", "Active 1 hour ago". */
  status: string;
  online: boolean;
};
export type GroupChat = { kind: "group"; id: string; name: string; group: GroupModel; lines: ChatLine[]; unread: number; lastAt: number; snippet: string };
export type Chat = DirectChat | GroupChat;

/** One-tap replies in a group thread. */
export const groupReplies = ["Thanks for sharing", "Agreed", "Happy to help", "Could you share the protocol?"];

/* ------------------------------------------------------------ colleagues */

/** A colleague's place in My Network: "Connected", "Pending" (asked either way) or "Connect". */
export function connectionWord(memory: CommunityMemory, who: PersonId): ConnectionWord {
  const state = relationship(memory, who);
  return state === "friend" ? "Connected" : state === "incoming" || state === "sent" ? "Pending" : "Connect";
}

/** What colleagues see about someone: their title, where they work, their summary and clinical interests. */
export function colleagueProfile(who: PersonId) {
  const person = people[who];
  const clinician = findClinician(person.clinicianId);
  const interests: string[] = [];
  clinician?.conditions.forEach(([groupId, conditionId]) => {
    const title = groupPlace(groupId)?.group.conditions.find(condition => condition.id === conditionId)?.title;
    if (title && !interests.includes(title)) interests.push(title);
  });
  return {
    name: person.name,
    title: person.title,
    org: clinician?.org ?? "",
    place: clinician?.place ?? person.town,
    workplace: [clinician?.org, clinician?.place ?? person.town].filter(Boolean).join(" · "),
    summary: clinician?.summary ?? person.about,
    interests: interests.slice(0, 6),
    languages: clinician?.languages ?? [],
    years: clinician?.years ?? 0,
    profileHref: `/clinicians/${person.clinicianId}`,
  };
}

/* ------------------------------------------------------- this visit only */

/** A colleague's answer, after the clinician writes to them: first "is typing", then the words. */
type ChatVisit = { replied: Partial<Record<PersonId, number>>; typing: PersonId | null };
const EMPTY_VISIT: ChatVisit = { replied: {}, typing: null };

export function createChatVisit() {
  let state: ChatVisit = EMPTY_VISIT;
  let timers: number[] = [];
  const listeners = new Set<() => void>();
  const set = (next: ChatVisit) => { state = next; listeners.forEach(listener => listener()); };
  return {
    read: (): ChatVisit => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /** The person wrote to `who`. Once a visit, they write back. */
    wrote(who: PersonId) {
      if (typeof window === "undefined" || state.replied[who] !== undefined || state.typing === who) return;
      timers.push(window.setTimeout(() => set({ ...state, typing: who }), 1200));
      timers.push(window.setTimeout(() => set({ replied: { ...state.replied, [who]: Date.now() }, typing: state.typing === who ? null : state.typing }), 3800));
    },
    clear() { timers.forEach(timer => window.clearTimeout(timer)); timers = []; set(EMPTY_VISIT); },
  };
}
export const chatVisit = createChatVisit();
export const useChatVisit = (): ChatVisit => useSyncExternalStore(chatVisit.subscribe, chatVisit.read, () => EMPTY_VISIT);

/** Writes to a colleague. Unless the clinician has turned new messages off, the colleague answers, once a visit. */
export function sendDirect(memory: CommunityMemory, who: PersonId, draft: NoteDraft): OwnNote | null {
  const note = communityStore.addDirect(who, { text: draft.text, photo: draft.photo ?? null });
  if (note && memory.settings.messagesFrom !== "noOne") chatVisit.wrote(who);
  return note;
}

/* ---------------------------------------------------------- conversations */

const statusOf = (memory: CommunityMemory, who: PersonId) => friendList(memory).find(friend => friend.who === who) ?? startFriends.find(friend => friend.who === who) ?? null;
/** The network's words for someone's status ("New friend" is the store's word for a request just accepted). */
const statusWords = (status: string) => (status === "New friend" ? "New connection" : status);

/** What the list says of the newest line. */
function snippetOf(last: ChatLine | undefined, empty: string, theirName: (who: PersonId) => string | null): string {
  if (!last) return empty;
  if (last.kind === "mine") return `You: ${last.note.text || "Sent an image"}`;
  const name = theirName(last.who);
  return name ? `${name}: ${last.text}` : last.text;
}

function directChat(memory: CommunityMemory, who: PersonId, visit: ChatVisit, since: number): DirectChat {
  const conversation = conversations.find(item => item.who === who) ?? null;
  const lines: ChatLine[] = [
    ...(conversation?.lines ?? []).map((line): ChatLine => (line.from === "them"
      ? { kind: "theirs", id: line.id, at: since - line.minutesAgo * MINUTE, who, text: line.text }
      : { kind: "mine", id: line.id, at: since - line.minutesAgo * MINUTE, note: { text: line.text, photo: null }, removable: false })),
    ...(memory.direct[who] ?? []).map((note): ChatLine => ({ kind: "mine", id: note.id, at: note.createdAt, note, removable: true })),
  ];
  const replied = visit.replied[who];
  if (replied !== undefined) lines.push({ kind: "theirs", id: `reply-${who}`, at: replied, who, text: conversation?.reply ?? newConversation.reply });
  lines.sort((a, b) => a.at - b.at);
  const last = lines[lines.length - 1];
  const profile = colleagueProfile(who);
  const status = statusOf(memory, who);
  return {
    kind: "direct", id: who, name: profile.name, title: profile.title, workplace: profile.workplace, profileHref: profile.profileHref,
    connection: connectionWord(memory, who), conversation, lines,
    unread: memory.chatsRead.includes(who) ? 0 : conversation?.unread ?? 0,
    muted: memory.chatsMuted.includes(who),
    lastAt: last?.at ?? 0, snippet: snippetOf(last, "No messages yet", () => null),
    status: status ? statusWords(status.status) : "", online: !!status?.online,
  };
}

/**
 * Conversations with colleagues, newest first: the examples, and any the clinician started. Someone
 * blocked, or whose posts and messages are hidden, is out of sight here too.
 */
export function directChats(memory: CommunityMemory, visit: ChatVisit = EMPTY_VISIT, since = communityStore.visitStart): DirectChat[] {
  const started = PERSON_IDS.filter(who => (memory.direct[who]?.length ?? 0) > 0 && !conversations.some(item => item.who === who));
  return [...conversations.map(item => item.who), ...started]
    .filter(who => canSee(memory, who))
    .map(who => directChat(memory, who, visit, since))
    .sort((a, b) => b.lastAt - a.lastAt);
}

/**
 * A group's thread: its example messages (the newest said when the group's row says, the ones before a few
 * minutes apart), the hello of a group the clinician started, and what they wrote, in order. Someone out of
 * sight is left out.
 */
export function groupLines(memory: CommunityMemory, group: GroupModel, since = communityStore.visitStart): ChatLine[] {
  const shown = group.messages.filter(message => canSee(memory, message.who));
  const lines: ChatLine[] = shown.map((message, index): ChatLine => ({
    kind: "theirs", id: message.id, who: message.who, text: message.text,
    at: message.minutesAgo !== undefined ? since - message.minutesAgo * MINUTE : group.lastAt - (shown.length - 1 - index) * 7 * MINUTE,
  }));
  if (group.started?.hello) lines.push({ kind: "mine", id: "hello", at: group.started.createdAt, note: { text: group.started.hello, photo: null }, removable: false });
  (memory.messages[group.id] ?? []).forEach(note => lines.push({ kind: "mine", id: note.id, at: note.createdAt, note, removable: true }));
  return lines.sort((a, b) => a.at - b.at);
}

/** The clinician's groups, as conversations. */
export function groupChats(memory: CommunityMemory, since = communityStore.visitStart): GroupChat[] {
  return myGroups(memory, since).map(group => {
    const own = memory.messages[group.id] ?? [];
    const lastAt = Math.max(group.lastAt, ...own.map(note => note.createdAt));
    const lines = groupLines(memory, group, since);
    const last = lines[lines.length - 1];
    const snippet = last ? snippetOf(last, "", who => people[who].name) : lastLine(group, memory, null, who => people[who].name, who => canSee(memory, who));
    return { kind: "group", id: group.id, name: group.name, group, lines, unread: group.unread, lastAt, snippet };
  });
}

/**
 * The conversation a link names: a connection (one the clinician already talks to, or any connection in
 * sight, for a new conversation) or one of their groups. Null for anyone else.
 */
export function chatById(memory: CommunityMemory, id: string | null | undefined, visit: ChatVisit = EMPTY_VISIT, since = communityStore.visitStart): Chat | null {
  if (!id) return null;
  if ((PERSON_IDS as string[]).includes(id)) {
    const who = id as PersonId;
    const talking = conversations.some(item => item.who === who) || (memory.direct[who]?.length ?? 0) > 0;
    return canSee(memory, who) && (talking || canWrite(memory, who)) ? directChat(memory, who, visit, since) : null;
  }
  return groupChats(memory, since).find(chat => chat.id === id) ?? null;
}

/** Every conversation, newest first. */
export function allChats(memory: CommunityMemory, visit: ChatVisit = EMPTY_VISIT, since = communityStore.visitStart): Chat[] {
  return [...directChats(memory, visit, since), ...groupChats(memory, since)].sort((a, b) => b.lastAt - a.lastAt);
}

/** Connections the clinician could start a conversation with (anyone they already talk to opens that conversation). */
export function connectionsToMessage(memory: CommunityMemory): PersonId[] {
  return friendList(memory).map(friend => friend.who).filter(who => canSee(memory, who));
}

/** Conversations with colleagues waiting to be read, for the Messages tab and the window at the bottom. Muted ones count for nothing. */
export function unreadMessages(memory: CommunityMemory): number {
  return directChats(memory).filter(chat => !chat.muted && chat.unread > 0).length;
}

/** The groups a colleague shares with the clinician. */
export function groupsWith(who: PersonId): GroupModel["id"][] {
  return sampleGroups.filter(group => group.faces.includes(who)).map(group => group.id);
}

/** The clinician's other connections who share a group with this colleague. */
export function mutualConnections(memory: CommunityMemory, who: PersonId): PersonId[] {
  const shared = groupsWith(who);
  return friendList(memory).map(friend => friend.who).filter(other => other !== who && canSee(memory, other) && sampleGroups.some(group => shared.includes(group.id) && group.faces.includes(other)));
}

/** Whether a colleague can be written to: they are a connection, and in sight. */
export const canWrite = (memory: CommunityMemory, who: PersonId) => relationship(memory, who) === "friend" && canSee(memory, who);

/* --------------------------------------------------------- the first-open notice */

/** Where this device remembers that the notice has been read. */
export const MESSAGES_NOTICE_KEY = "rehyn.messages-notice.v1";
/** The notice, in the words the dialog shows. */
export const messagesNotice = {
  title: "Before you message",
  text: "The Rehyn team can access messages sent here, to keep the network safe. Do not share patient-identifiable information in messages.",
  button: "OK, I understand",
};

/**
 * Whether the notice still has to be shown on this device: it has not been read, or the device's
 * storage can't be read. With no storage at all (a server, a test) there is nothing to show.
 */
export function messagesNoticeDue(storage: Storage | null | undefined): boolean {
  if (!storage) return false;
  try { return storage.getItem(MESSAGES_NOTICE_KEY) !== "1"; } catch { return true; }
}

/** The person has read the notice. True when the device will remember it. */
export function markMessagesNoticeRead(storage: Storage | null | undefined): boolean {
  if (!storage) return false;
  try { storage.setItem(MESSAGES_NOTICE_KEY, "1"); return true; } catch { return false; }
}

/** The browser's storage, or null where there is none (or it can't be touched). */
export function noticeStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

/** What day a line was said, for the little label above each day's lines: "Today", "Yesterday", "Tuesday". */
export function dayLabel(then: number, now = Date.now()): string {
  const day = (time: number) => { const date = new Date(time); return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000; };
  const days = Math.round(day(now) - day(then));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Date(then).toLocaleDateString("en-GB", days < 7 ? { weekday: "long" } : { day: "numeric", month: "long" });
}
