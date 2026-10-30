import { useSyncExternalStore } from "react";
import type { PersonId } from "@/content/community-samples";

// Friday poker night in My community: on Fridays Rehyn's daily card becomes a poker invitation, a
// pop-up offers four games, people are seated at tables of up to six by the game they picked (with
// friends together where possible), and a "Poker night" tab appears in the header. Chips only: no
// real money, no buying chips and no prizes. The people are examples, and the person's pick for the
// week stays in this browser. `?poker=friday` in the address shows poker night on any day, for the
// rest of the browser session (`?poker=off` turns that off again).

/* --------------------------------------------------------------- the day */

/** Whether it's poker night: every Friday. */
export const isPokerNight = (date: Date) => date.getDay() === 5;

/** The ISO week a date falls in, such as "2026-W42": "Not tonight" lasts for that week. */
export function isoWeek(date: Date): string {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday); // the Thursday of this week decides its year
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((day.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** A calendar day on this device, such as "2026-10-16": the pop-up shows once a day. */
export const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** The tables open at 7 pm. */
export const TABLES_OPEN_HOUR = 19;

/** Seconds until the tables open tonight (0 once they have). */
export function secondsToTables(now: Date): number {
  const open = new Date(now.getFullYear(), now.getMonth(), now.getDate(), TABLES_OPEN_HOUR, 0, 0, 0);
  return Math.max(0, Math.floor((open.getTime() - now.getTime()) / 1000));
}

/* ------------------------------------------------------------- the games */

export type PokerGameId = "holdem" | "omaha" | "stud" | "draw";
export type PokerGame = { id: PokerGameId; name: string; blurb: string; tag: string };
export const POKER_GAMES: PokerGame[] = [
  { id: "holdem", name: "Texas Hold'em", blurb: "Two cards each, five shared on the table. The one most people know.", tag: "Most picked" },
  { id: "omaha", name: "Omaha", blurb: "Four cards each, and you use two of them. More big hands.", tag: "A bit more to think about" },
  { id: "stud", name: "Seven-card stud", blurb: "No shared cards. Some of yours face up, some hidden.", tag: "Old school" },
  { id: "draw", name: "Five-card draw", blurb: "Five cards, swap the ones you do not want. The simplest.", tag: "Easiest to learn" },
];
export const pokerGame = (id: PokerGameId) => POKER_GAMES.find(game => game.id === id) ?? POKER_GAMES[0];
const isGameId = (value: unknown): value is PokerGameId => POKER_GAMES.some(game => game.id === value);

/** The line said wherever poker appears. */
export const CHIPS_ONLY = "Chips only, just for fun.";

/* ----------------------------------------------------------- the seating */

export type PokerPick = { id: string; game: PokerGameId; friends?: string[] };
export type PokerTableSeating = { number: number; game: PokerGameId; players: string[] };
export const TABLE_SIZE = 6;

/**
 * Seats everybody for tonight. People are grouped by the game they picked (a table only ever plays
 * one game), and each game gets as few tables as will hold its players at up to `size` a table, as
 * evenly filled as they can be. Friends who picked the same game sit together where possible: a
 * group of friends is only split up when it is bigger than a table or no table has room for all of
 * them. Tables are numbered from 1 across the games, in the order of POKER_GAMES.
 */
export function seatTables(picks: PokerPick[], size = TABLE_SIZE): PokerTableSeating[] {
  const tables: PokerTableSeating[] = [];
  POKER_GAMES.forEach(({ id: game }) => {
    const here = picks.filter(pick => pick.game === game);
    if (!here.length) return;
    const ids = here.map(pick => pick.id);
    // Friends, either way round, among the people who picked this game, joined into groups.
    const parent = new Map(ids.map(id => [id, id]));
    const root = (id: string): string => { let at = id; while (parent.get(at) !== at) at = parent.get(at) as string; return at; };
    here.forEach(pick => (pick.friends ?? []).forEach(friend => { if (parent.has(friend)) parent.set(root(friend), root(pick.id)); }));
    const groups = new Map<string, string[]>();
    ids.forEach(id => { const key = root(id); groups.set(key, [...(groups.get(key) ?? []), id]); });
    // Bigger groups are seated first; a group bigger than a table is cut into table-sized pieces.
    const pieces: string[][] = [];
    Array.from(groups.values()).forEach(group => { for (let i = 0; i < group.length; i += size) pieces.push(group.slice(i, i + size)); });
    pieces.sort((a, b) => b.length - a.length);
    const count = Math.ceil(ids.length / size);
    // How many each table is meant to hold: as even as possible, never more than `size`.
    const target = Array.from({ length: count }, (_, i) => Math.floor(ids.length / count) + (i < ids.length % count ? 1 : 0));
    const seated: string[][] = Array.from({ length: count }, () => []);
    const room = (t: number) => target[t] - seated[t].length;
    const roomiest = (fits: (t: number) => boolean) => seated.reduce((best, _, t) => (fits(t) && (best < 0 || room(t) > room(best)) ? t : best), -1);
    pieces.forEach(piece => {
      let t = roomiest(at => room(at) >= piece.length);
      if (t < 0) {
        // No table is meant to hold this many: let one hold more (up to a full table) and another fewer.
        t = roomiest(at => size - seated[at].length >= piece.length);
        if (t >= 0) {
          for (let extra = piece.length - room(t); extra > 0; extra--) {
            const other = roomiest(at => at !== t && room(at) > 0);
            if (other < 0) break;
            target[other] -= 1;
            target[t] += 1;
          }
        }
      }
      if (t >= 0 && room(t) >= piece.length) { seated[t].push(...piece); return; }
      // Still no room for them all together: they fill the roomiest tables in turn.
      piece.forEach(id => { seated[roomiest(at => room(at) > 0)].push(id); });
    });
    seated.forEach(players => tables.push({ number: tables.length + 1, game, players }));
  });
  return tables;
}

/* ------------------------------------------------------- tonight's people */

export type PokerPlayer = { id: string; name: string; game: PokerGameId; face?: PersonId; tint: string; friends?: string[]; late?: boolean };

/**
 * Who has picked a game tonight (examples). `late` ones pick while the pop-up is open, as the
 * "just picked" line shows. The example people from My community each sit at one game; everybody
 * else has their initial for a picture.
 */
export const POKER_PLAYERS: PokerPlayer[] = [
  { id: "hannah", name: "Margaret", face: "hannah", tint: "#F3D9CC", game: "holdem", friends: ["kwame", "priya"] },
  { id: "kwame", name: "David", face: "kwame", tint: "#CFE2D6", game: "holdem", friends: ["joseph"] },
  { id: "priya", name: "Priya", face: "priya", tint: "#E9E2F4", game: "holdem" },
  { id: "joseph", name: "Samuel", face: "joseph", tint: "#DCECF4", game: "holdem" },
  { id: "rose", name: "Rose", tint: "#FBE3DB", game: "holdem", friends: ["ken"] },
  { id: "ken", name: "Ken", tint: "#E3EFE6", game: "holdem" },
  { id: "bill", name: "Bill", tint: "#F6EEDB", game: "holdem" },
  { id: "maeve", name: "Maeve", tint: "#E9E2F4", game: "holdem", friends: ["ray"] },
  { id: "ray", name: "Ray", tint: "#DCECF4", game: "holdem" },
  { id: "doreen", name: "Doreen", tint: "#FBEBC2", game: "holdem" },
  { id: "arthur", name: "Arthur", tint: "#E5EEE7", game: "holdem" },
  { id: "sunita", name: "Sunita", tint: "#FBE3DB", game: "holdem" },
  { id: "grace", name: "Anne", face: "grace", tint: "#FBEBC2", game: "omaha", friends: ["tomas"] },
  { id: "tomas", name: "Tomasz", face: "tomas", tint: "#D5E1E6", game: "omaha" },
  { id: "gwen", name: "Gwen", tint: "#E3EFE6", game: "omaha" },
  { id: "frank", name: "Frank", tint: "#F6EEDB", game: "omaha" },
  { id: "elsie", name: "Elsie", tint: "#E9E2F4", game: "omaha" },
  { id: "ruth", name: "Joan", face: "ruth", tint: "#F6DDD3", game: "stud" },
  { id: "pete", name: "Pete", tint: "#DCECF4", game: "stud" },
  { id: "ivy", name: "Ivy", tint: "#FBEBC2", game: "stud" },
  { id: "michael", name: "Li Wei", face: "michael", tint: "#E3EFE6", game: "draw" },
  { id: "colin", name: "Colin", tint: "#E5EEE7", game: "draw" },
  { id: "hilda", name: "Hilda", tint: "#FBE3DB", game: "draw" },
  { id: "stan", name: "Stan", tint: "#D5E1E6", game: "draw" },
  { id: "nora", name: "Nora", tint: "#F6EEDB", game: "holdem", late: true },
  { id: "glyn", name: "Glyn", tint: "#E9E2F4", game: "holdem", late: true },
  { id: "olive", name: "Olive", tint: "#FBEBC2", game: "omaha", late: true },
  { id: "reg", name: "Reg", tint: "#DCECF4", game: "holdem", late: true },
  { id: "barbara", name: "Barbara", tint: "#E3EFE6", game: "stud", late: true },
  { id: "dev", name: "Dev", tint: "#FBE3DB", game: "holdem", late: true },
  { id: "maud", name: "Maud", tint: "#E5EEE7", game: "draw", late: true },
];
export const ME = "me";

/** How many have picked each game, with the first `lateIn` late pickers counted. */
export function pickCounts(players: PokerPlayer[], lateIn: number): Record<PokerGameId, number> {
  const counts: Record<PokerGameId, number> = { holdem: 0, omaha: 0, stud: 0, draw: 0 };
  let late = 0;
  players.forEach(player => { if (!player.late || late++ < lateIn) counts[player.game] += 1; });
  return counts;
}

/** Tonight's tables with the person seated at the game they picked, beside their friends where possible. */
export function tonightsTables(players: PokerPlayer[], mine: { game: PokerGameId; friends: string[] } | null): PokerTableSeating[] {
  const picks: PokerPick[] = players.map(player => ({ id: player.id, game: player.game, friends: player.friends }));
  if (mine) picks.unshift({ id: ME, game: mine.game, friends: mine.friends });
  return seatTables(picks);
}

/* --------------------------------------------------------------- memory */

export type PokerStatus = "none" | "seated" | "skipped";
export type PokerNightMemory = {
  /** The ISO week this pick is for: a new week starts afresh. */
  week: string;
  pick: PokerGameId;
  status: PokerStatus;
  /** The day the pop-up last showed by itself, so it shows once. */
  poppedOn: string | null;
  remind: boolean;
  bigCards: boolean;
};
export type PokerNightState = PokerNightMemory & { dialogOpen: boolean; demo: boolean };

const KEY = "rehyn-poker-night";
const DEMO_KEY = "rehyn-poker-demo";
const fresh = (week: string, keep?: Partial<PokerNightMemory>): PokerNightMemory => ({ week, pick: "holdem", status: "none", poppedOn: null, remind: true, bigCards: keep?.bigCards ?? false });

/** Reads what was kept, or starts afresh for this week. Anything odd is put right. */
export function readPokerMemory(raw: string | null, now: Date): PokerNightMemory {
  const week = isoWeek(now);
  let kept: Partial<PokerNightMemory> = {};
  try { kept = raw ? (JSON.parse(raw) as Partial<PokerNightMemory>) : {}; } catch { kept = {}; }
  if (!kept || typeof kept !== "object" || kept.week !== week) return fresh(week, typeof kept === "object" && kept ? kept : undefined);
  return {
    week,
    pick: isGameId(kept.pick) ? kept.pick : "holdem",
    status: kept.status === "seated" || kept.status === "skipped" ? kept.status : "none",
    poppedOn: typeof kept.poppedOn === "string" ? kept.poppedOn : null,
    remind: kept.remind !== false,
    bigCards: kept.bigCards === true,
  };
}

/** Whether the pop-up should open by itself now: on poker night, once a day, unless "Not tonight" this week or already seated. */
export const shouldPop = (state: PokerNightMemory, now: Date, night: boolean) => night && state.status === "none" && state.poppedOn !== dayKey(now);

function safeRead(store: "local" | "session", key: string): string | null {
  try { return typeof window === "undefined" ? null : (store === "local" ? window.localStorage : window.sessionStorage).getItem(key); } catch { return null; }
}
function safeWrite(store: "local" | "session", key: string, value: string | null) {
  try {
    if (typeof window === "undefined") return;
    const area = store === "local" ? window.localStorage : window.sessionStorage;
    if (value === null) area.removeItem(key); else area.setItem(key, value);
  } catch { /* private browsing: it lasts for this visit */ }
}

const demoInAddress = (search: string): boolean | null => {
  const asked = new URLSearchParams(search).get("poker");
  return asked === "friday" ? true : asked === "off" ? false : null;
};

let state: PokerNightState = {
  ...readPokerMemory(safeRead("local", KEY), new Date()),
  dialogOpen: false,
  demo: (typeof window !== "undefined" && demoInAddress(window.location.search)) ?? safeRead("session", DEMO_KEY) === "friday",
};
const listeners = new Set<() => void>();

function update(change: Partial<PokerNightState>) {
  // A new week (the page left open overnight on Sunday) starts afresh.
  const week = isoWeek(new Date());
  const base = state.week === week ? state : { ...state, ...fresh(week, state) };
  state = { ...base, ...change };
  const { dialogOpen: _open, demo: _demo, ...memory } = state;
  safeWrite("local", KEY, JSON.stringify(memory));
  listeners.forEach(listener => listener());
}

export const pokerNight = {
  pick: (game: PokerGameId) => update({ pick: game }),
  seat: () => update({ status: "seated" }),
  /** "Not tonight": respected for the rest of the week. */
  skip: () => update({ status: "skipped", dialogOpen: false }),
  change: () => update({ status: "none" }),
  setRemind: (on: boolean) => update({ remind: on }),
  setBigCards: (on: boolean) => update({ bigCards: on }),
  open: () => update({ dialogOpen: true }),
  close: () => update({ dialogOpen: false }),
  /** The pop-up opened by itself today. */
  popped: (now: Date) => update({ dialogOpen: true, poppedOn: dayKey(now) }),
  /** `?poker=friday` shows poker night on any day for this browser session; `?poker=off` stops it. */
  noteAddress: (search: string) => {
    const asked = demoInAddress(search);
    if (asked === null) return;
    safeWrite("session", DEMO_KEY, asked ? "friday" : null);
    if (asked !== state.demo) update({ demo: asked });
  },
};

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const usePokerNight = () => useSyncExternalStore(subscribe, () => state, () => state);

/** Whether poker night is on today, here: a Friday, or the preview switch. */
export const pokerNightOn = (current: PokerNightState, now: Date = new Date()) => current.demo || isPokerNight(now);
