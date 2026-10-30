import {
  conditionGroups,
  conditions,
  gameInfo,
  groupEvents,
  groupThemes,
  people,
  sampleGames,
  sampleGroups,
  startedGroupChallenge,
  startThemes,
  suggestedGroups,
  type Condition,
  type ConditionId,
  type GameId,
  type GroupActivity,
  type GroupCover,
  type GroupMessage,
  type GroupVisibility,
  type PersonId,
  type SampleGroup,
  type SampleGroupId,
  type StartThemeId,
  type ThemeId,
} from "@/content/community-samples";
import { communityStore, gamesAllowed, inCondition, isBlocked, listNames, OPEN_GAMES, type CommunityMemory, type GroupGame, type StartedGroup } from "@/lib/community-store";
import type { BattleshipsSave } from "./games/battleships-rules";

// The groups model. Every list of groups the page shows comes from here, and the privacy rule is
// kept here, once: a private group is seen only by the people in it. It never appears for anyone
// else in a list, a search, a count or a suggestion. In the clinician edition the groups are
// professional networks inside a condition, and members are clinicians. (The game rules below stay
// for saved data, but the clinician edition never surfaces games: comment 7.)

/** The cover a started group wears: its theme's drawing, or its colour and sign. */
export function coverForTheme(theme: StartThemeId): GroupCover {
  const look = [...startThemes, ...groupThemes].find(item => item.id === theme) ?? groupThemes[groupThemes.length - 1];
  return look.image ? { image: look.image, tint: look.tint, ink: look.ink } : { tint: look.tint, ink: look.ink, icon: look.id as ThemeId };
}

export const conditionOf = (id: ConditionId): Condition => conditions.find(item => item.id === id) ?? conditions[0];

/** One group as My groups shows it, whether it is an example, joined, or started by the person. */
export type GroupModel = {
  id: string;
  name: string;
  kind: "sample" | "joined" | "started";
  /** A line about the group, under its name. */
  about: string;
  /** When its last example message was said (a started group: when it was started). */
  lastAt: number;
  cover: GroupCover;
  tint: string;
  ink: string;
  meta: string;
  online: number;
  faces: PersonId[];
  challenge: { text: string; done: number; total: number };
  messages: GroupMessage[];
  incoming: GroupMessage | null;
  unread: number;
  active: boolean;
  started: StartedGroup | null;
  /** The condition group it sits in, and who can see it. */
  conditionId: ConditionId;
  visibility: GroupVisibility;
  members: number;
  /** Whether games can be started in it: private groups only. */
  games: boolean;
  /** The line on its card and in the list: a game on now, something coming up, or the last thing said. */
  activity: GroupActivity;
  /** Something that happened in it today, shown in its chat ("Margaret started chess with Joan"). */
  event: string | null;
};

function fromSample(group: SampleGroup, kind: "sample" | "joined", memory: CommunityMemory, since: number): GroupModel {
  return {
    id: group.id, name: group.name, kind, about: group.about, lastAt: since - group.lastMinutesAgo * 60_000, cover: group.cover, tint: group.tint, ink: group.ink,
    meta: `${group.members + (kind === "joined" ? 1 : 0)} clinicians`, online: group.online, faces: group.faces, challenge: group.challenge,
    messages: group.messages, incoming: group.incoming,
    unread: memory.read.includes(group.id as SampleGroupId) ? 0 : group.unread, active: group.active, started: null,
    conditionId: group.conditionId, visibility: group.visibility, members: group.members + (kind === "joined" ? 1 : 0),
    games: gamesAllowed(memory, group.id), activity: group.activity, event: groupEvents[group.id] ?? null,
  };
}

function fromStarted(group: StartedGroup, memory: CommunityMemory): GroupModel {
  const look = [...startThemes, ...groupThemes].find(item => item.id === group.theme) ?? groupThemes[0];
  const friends = group.friends.filter(who => !isBlocked(memory, who));
  return {
    id: group.id, name: group.name, kind: "started", cover: coverForTheme(group.theme),
    about: `A ${look.label.toLowerCase()} group for clinicians in ${conditionOf(group.conditionId).name}, started by you.`, lastAt: group.createdAt,
    tint: look.tint, ink: look.ink,
    meta: "Started by you", online: 0, faces: group.friends,
    challenge: { text: startedGroupChallenge, done: 0, total: 1 }, messages: [], incoming: null, unread: 0, active: false, started: group,
    conditionId: group.conditionId, visibility: group.visibility, members: friends.length + 1, games: gamesAllowed(memory, group.id),
    activity: { text: group.hello ? `You: ${group.hello}` : friends.length ? `With ${listNames(friends.map(who => people[who].name))}` : "Just you for now", kind: "chat" },
    event: null,
  };
}

/**
 * The person's groups: the ones they started (newest first), the examples, then any they joined.
 * `since` is when the page opened: the examples' last messages are dated back from it. These are
 * all groups the person is in, so a private group they are not in can never be among them.
 */
export function myGroups(memory: CommunityMemory, since = communityStore.visitStart): GroupModel[] {
  const joined = [...suggestedGroups, ...conditionGroups].filter(group => (memory.joined as string[]).includes(group.id) && group.visibility === "public");
  return [...memory.started.map(group => fromStarted(group, memory)), ...sampleGroups.map(group => fromSample(group, "sample", memory, since)), ...joined.map(group => fromSample(group, "joined", memory, since))];
}

/** A subgroup's card in "Inside {condition}". */
export type SubgroupCard = {
  id: string;
  name: string;
  /** Its professional purpose, in a line. */
  about: string;
  cover: GroupCover;
  visibility: GroupVisibility;
  members: number;
  faces: PersonId[];
  activity: GroupActivity;
  /** The person is in it (it opens), or it is public and can be joined. */
  member: boolean;
  /** One the person started, or an example group of theirs: it can't be left from here. */
  own: boolean;
};

/**
 * The subgroups the person can see inside a condition: every group they are in, then the public
 * ones they could join. Private groups they are not in are left out, whatever else is asked.
 */
export function visibleSubgroups(memory: CommunityMemory, conditionId: ConditionId): SubgroupCard[] {
  // The person's private groups come first: those are the ones nobody else can find.
  const mine = myGroups(memory).filter(group => group.conditionId === conditionId).sort((a, b) => Number(b.visibility === "private") - Number(a.visibility === "private")).map((group): SubgroupCard => ({
    id: group.id, name: group.name, about: group.about, cover: group.cover, visibility: group.visibility, members: group.members,
    faces: group.faces.filter(who => !isBlocked(memory, who)), activity: group.activity, member: true, own: group.kind !== "joined",
  }));
  const others = [...suggestedGroups, ...conditionGroups]
    .filter(group => group.conditionId === conditionId && group.visibility === "public" && !mine.some(item => item.id === group.id))
    .map((group): SubgroupCard => ({
      id: group.id, name: group.name, about: group.about, cover: group.cover, visibility: "public", members: group.members,
      faces: group.faces.filter(who => !isBlocked(memory, who)), activity: group.activity, member: false, own: false,
    }));
  return [...mine, ...others];
}

/** How many subgroups the person can see inside a condition. Private groups they are not in don't count. */
export const visibleSubgroupCount = (memory: CommunityMemory, conditionId: ConditionId): number => visibleSubgroups(memory, conditionId).length;

/** The condition the Groups tab opens on: the first one the person is in. */
export const homeCondition = (memory: CommunityMemory): ConditionId => conditions.find(item => inCondition(memory, item.id))?.id ?? "stroke";

/** A game in one of the person's groups, as the group page and the game strip show it, or a Play now game. */
export type GameModel = {
  id: string;
  /** The group it is played in, or `OPEN_GAMES` for a Play now game, which is in no group. */
  groupId: string;
  type: GameId;
  name: string;
  /** Everyone playing apart from the person. */
  players: PersonId[];
  withYou: boolean;
  state: "lobby" | "playing" | "scheduled" | "finished";
  /** Chess only: the moves played so far, as codes. */
  moves: string[];
  /** Battleships only: the ships and shots so far, once the person has opened the game. */
  battle: BattleshipsSave | null;
  when: string;
  watchers: PersonId[];
  /** Started on this device, rather than an example. */
  own: GroupGame | null;
};

/**
 * Whether a game opens on its own page in this preview: chess, to play or watch, and the person's
 * own Battleships games. The other games are coming soon.
 */
export const gameOpens = (game: GameModel): boolean =>
  game.state === "playing" && (game.type === "chess" || (game.type === "battleships" && game.own !== null));

/** A Play now game: played with someone new, in no group. */
export const isOpenGame = (game: Pick<GameModel, "groupId">): boolean => game.groupId === OPEN_GAMES;

const ownGame = (memory: CommunityMemory, game: GroupGame): GameModel => ({
  id: game.id, groupId: game.groupId, type: game.type, name: gameInfo(game.type).name, players: game.players, withYou: true,
  state: game.state, moves: memory.chess[game.id] ?? [], battle: memory.battleships[game.id] ?? null, when: "", watchers: [], own: game,
});

/**
 * Games in the groups the person is in, newest first: the ones they started, then the examples.
 * Games with someone they have blocked are left out, and so are Play now games: they are in no
 * group (see `openGames`).
 */
export function myGames(memory: CommunityMemory, groupId?: string): GameModel[] {
  const groups = myGroups(memory).map(group => group.id);
  const own = memory.games.map(game => ownGame(memory, game));
  const examples = sampleGames.map((game): GameModel => ({
    id: game.id, groupId: game.groupId, type: game.type, name: gameInfo(game.type).name, players: game.players, withYou: game.withYou,
    state: game.state, moves: game.withYou ? memory.chess[game.id] ?? game.moves : game.moves, battle: null, when: game.when,
    watchers: game.watchers.filter(who => !isBlocked(memory, who)), own: null,
  }));
  return [...own, ...examples].filter(game => groups.includes(game.groupId) && (groupId === undefined || game.groupId === groupId) && game.players.every(who => !isBlocked(memory, who)));
}

/** The person's Play now games, newest first. Games with someone they have blocked are left out. */
export function openGames(memory: CommunityMemory): GameModel[] {
  return memory.games.filter(isOpenGame).map(game => ownGame(memory, game)).filter(game => game.players.every(who => !isBlocked(memory, who)));
}

/**
 * The last line said in a group, for its row in the list: the newest of the person's own messages,
 * a message that arrived during this visit, or the group's latest example message. Messages from
 * people `shown` rules out (blocked or hidden) are skipped.
 */
export function lastLine(group: GroupModel, memory: CommunityMemory, deliveredAt: number | null, name: (who: PersonId) => string, shown: (who: PersonId) => boolean = () => true): string {
  const lines: { at: number; text: string }[] = [];
  (memory.messages[group.id] ?? []).forEach(note => lines.push({ at: note.createdAt, text: `You: ${note.text || "a photo"}` }));
  if (deliveredAt !== null && group.incoming && shown(group.incoming.who)) lines.push({ at: deliveredAt, text: `${name(group.incoming.who)}: ${group.incoming.text}` });
  if (group.started?.hello) lines.push({ at: group.started.createdAt, text: `You: ${group.started.hello}` });
  if (lines.length) return lines.reduce((newest, line) => (line.at >= newest.at ? line : newest)).text;
  const visible = group.messages.filter(message => shown(message.who));
  const last = visible[visible.length - 1];
  return last ? `${name(last.who)}: ${last.text}` : "Just you for now. Say hello";
}
