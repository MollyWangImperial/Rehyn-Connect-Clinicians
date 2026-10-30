import { describe, expect, it } from "vitest";
import { dayKey, isoWeek, isPokerNight, ME, pickCounts, POKER_PLAYERS, readPokerMemory, seatTables, secondsToTables, shouldPop, tonightsTables, type PokerPick } from "./poker-night";

describe("isPokerNight", () => {
  it("is Fridays only", () => {
    expect(isPokerNight(new Date(2026, 9, 14))).toBe(false); // Wednesday 14 October 2026
    expect(isPokerNight(new Date(2026, 9, 16, 23, 59))).toBe(true); // Friday 16 October
    expect(isPokerNight(new Date(2026, 9, 17, 0, 1))).toBe(false); // Saturday
    expect(isPokerNight(new Date(2026, 9, 23, 8))).toBe(true);
  });
});

describe("isoWeek and the countdown", () => {
  it("keys the week the ISO way, so Not tonight lasts Monday to Sunday", () => {
    expect(isoWeek(new Date(2026, 9, 14))).toBe("2026-W42");
    expect(isoWeek(new Date(2026, 9, 16))).toBe("2026-W42");
    expect(isoWeek(new Date(2026, 9, 18))).toBe("2026-W42"); // Sunday
    expect(isoWeek(new Date(2026, 9, 19))).toBe("2026-W43"); // Monday
    expect(isoWeek(new Date(2027, 0, 1))).toBe("2026-W53");
  });

  it("counts down to 7 pm and stops there", () => {
    expect(secondsToTables(new Date(2026, 9, 16, 14, 47, 30))).toBe(4 * 3600 + 12 * 60 + 30);
    expect(secondsToTables(new Date(2026, 9, 16, 19, 30))).toBe(0);
  });
});

describe("the pop-up", () => {
  const friday = new Date(2026, 9, 16, 10);
  it("shows once a day on poker night", () => {
    const fresh = readPokerMemory(null, friday);
    expect(shouldPop(fresh, friday, true)).toBe(true);
    expect(shouldPop(fresh, friday, false)).toBe(false);
    expect(shouldPop({ ...fresh, poppedOn: dayKey(friday) }, friday, true)).toBe(false);
  });

  it("respects Not tonight for the rest of that week, and asks again the next", () => {
    const skipped = JSON.stringify({ ...readPokerMemory(null, friday), status: "skipped" });
    expect(shouldPop(readPokerMemory(skipped, friday), friday, true)).toBe(false);
    const nextFriday = new Date(2026, 9, 23, 10);
    const later = readPokerMemory(skipped, nextFriday);
    expect(later.status).toBe("none");
    expect(shouldPop(later, nextFriday, true)).toBe(true);
  });

  it("puts right anything odd that was kept", () => {
    const odd = readPokerMemory(JSON.stringify({ week: isoWeek(friday), pick: "snap", status: "maybe" }), friday);
    expect(odd.pick).toBe("holdem");
    expect(odd.status).toBe("none");
    expect(readPokerMemory("{not json", friday).week).toBe("2026-W42");
  });
});

describe("seatTables", () => {
  const people = (game: PokerPick["game"], n: number, prefix = game): PokerPick[] => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, game }));

  it("seats everybody once, by the game they picked, at most six to a table", () => {
    const picks = [...people("holdem", 17), ...people("omaha", 6), ...people("stud", 4), ...people("draw", 5)];
    const tables = seatTables(picks);
    expect(tables.map(table => table.players.length)).toEqual([6, 6, 5, 6, 4, 5]);
    expect(tables.map(table => table.number)).toEqual([1, 2, 3, 4, 5, 6]);
    const seated = tables.flatMap(table => table.players);
    expect(new Set(seated).size).toBe(picks.length);
    tables.forEach(table => table.players.forEach(id => expect(picks.find(pick => pick.id === id)?.game).toBe(table.game)));
  });

  it("uses as few tables as it can, filled evenly", () => {
    expect(seatTables(people("holdem", 7)).map(table => table.players.length)).toEqual([4, 3]);
    expect(seatTables(people("holdem", 12)).map(table => table.players.length)).toEqual([6, 6]);
    expect(seatTables([])).toEqual([]);
  });

  it("sits friends together where possible, either way round", () => {
    const picks = [...people("holdem", 9), { id: "zak", game: "holdem" as const, friends: ["holdem8", "holdem3"] }, { id: "pat", game: "holdem" as const }, { id: "lou", game: "holdem" as const, friends: ["pat"] }];
    picks[1] = { ...picks[1], friends: ["zak"] };
    const tables = seatTables(picks);
    const tableOf = (id: string) => tables.find(table => table.players.includes(id))?.number;
    expect(tableOf("holdem8")).toBe(tableOf("zak"));
    expect(tableOf("holdem3")).toBe(tableOf("zak"));
    expect(tableOf("holdem1")).toBe(tableOf("zak"));
    expect(tableOf("pat")).toBe(tableOf("lou"));
    tables.forEach(table => expect(table.players.length).toBeLessThanOrEqual(6));
  });

  it("lets a table take a group of friends whole rather than split them", () => {
    // Seven people: tables of 4 and 3 would split five friends. One table takes all five instead.
    const picks: PokerPick[] = [{ id: "a", game: "draw", friends: ["b", "c", "d", "e"] }, ...["b", "c", "d", "e"].map(id => ({ id, game: "draw" as const })), { id: "f", game: "draw" }, { id: "g", game: "draw" }];
    const tables = seatTables(picks);
    expect(tables).toHaveLength(2);
    expect(tables.find(table => table.players.includes("a"))?.players.sort()).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("splits only a group of friends bigger than a table", () => {
    const friends = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const tables = seatTables(friends.map((id, i) => ({ id, game: "stud" as const, friends: i ? [friends[i - 1]] : [] })));
    expect(tables.map(table => table.players.length).sort()).toEqual([2, 6]);
  });

  it("never sits friends who picked different games together", () => {
    const tables = seatTables([{ id: "a", game: "holdem", friends: ["b"] }, { id: "b", game: "omaha" }]);
    expect(tables).toEqual([{ number: 1, game: "holdem", players: ["a"] }, { number: 2, game: "omaha", players: ["b"] }]);
  });
});

describe("tonight's example tables", () => {
  it("seats the person with their friends at the game they picked", () => {
    const tables = tonightsTables(POKER_PLAYERS, { game: "holdem", friends: ["kwame", "hannah", "grace"] });
    const mine = tables.find(table => table.players.includes(ME));
    expect(mine?.game).toBe("holdem");
    expect(mine?.players).toEqual(expect.arrayContaining([ME, "hannah", "kwame"]));
    expect(tables.filter(table => table.game === "holdem").reduce((sum, table) => sum + table.players.length, 0)).toBe(17);
  });

  it("counts the picks, with the late ones as they come in", () => {
    expect(pickCounts(POKER_PLAYERS, 0)).toEqual({ holdem: 12, omaha: 5, stud: 3, draw: 4 });
    expect(pickCounts(POKER_PLAYERS, 99)).toEqual({ holdem: 16, omaha: 6, stud: 4, draw: 5 });
  });
});
