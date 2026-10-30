import { describe, expect, it } from "vitest";
import { act, BIG_BLIND, botMove, nextStreet, options, playersAfter, SMALL_BLIND, startHand, type Holdem, type Player } from "./poker-holdem";

/** A repeatable random source, so a failing hand can be played again. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const table = (chips = 1000): Player[] => ["you", "hannah", "kwame", "priya", "joseph"].map((id, i) => ({ id, name: id, chips, human: i === 0 }));
const total = (state: Holdem) => state.seats.reduce((sum, seat) => sum + seat.chips, 0) + (state.result ? 0 : state.pot);

/** Plays a hand to the end with every seat a computer player. */
function playOut(state: Holdem, random: () => number): Holdem {
  for (let guard = 0; guard < 500 && !state.result; guard++) state = state.toAct >= 0 ? act(state, botMove(state, random)) : nextStreet(state);
  return state;
}

describe("startHand", () => {
  it("deals two cards each from one deck and posts the blinds left of the dealer", () => {
    const state = startHand(table(), 0, 1, seeded(1));
    expect(state.dealer).toBe(1);
    expect(state.seats.every(seat => seat.cards.length === 2)).toBe(true);
    const seen = new Set([...state.seats.flatMap(seat => seat.cards), ...state.deck].map(card => `${card.rank}${card.suit}`));
    expect(seen.size).toBe(52);
    expect(state.seats[2].bet).toBe(SMALL_BLIND);
    expect(state.seats[3].bet).toBe(BIG_BLIND);
    expect(state.pot).toBe(SMALL_BLIND + BIG_BLIND);
    expect(state.toAct).toBe(4);
    expect(options(state).toCall).toBe(BIG_BLIND);
  });

  it("leaves out anybody without chips", () => {
    const players = table();
    players[2].chips = 0;
    const state = startHand(players, 0, 1, seeded(2));
    expect(state.seats[2].out).toBe(true);
    expect(state.seats[2].cards).toHaveLength(0);
  });
});

describe("a hand", () => {
  it("goes flop, turn, river when everybody checks or calls", () => {
    let state = startHand(table(), 0, 1, seeded(3));
    const streets: string[] = [];
    for (let guard = 0; guard < 100 && !state.result; guard++) {
      if (state.toAct >= 0) state = act(state, { kind: options(state).toCall ? "call" : "check" });
      else { state = nextStreet(state); streets.push(`${state.street}:${state.board.length}`); }
    }
    expect(streets).toEqual(["flop:3", "turn:4", "river:5", "show:5"]);
    expect(state.result?.value).not.toBeNull();
    expect(total(state)).toBe(5000);
  });

  it("ends at once when everybody else folds, and the cards stay hidden", () => {
    let state = startHand(table(), 0, 1, seeded(4));
    while (!state.result) state = act(state, { kind: "fold" });
    expect(state.result.winners).toEqual([3]);
    expect(state.result.value).toBeNull();
    expect(state.seats[3].chips).toBe(1000 + SMALL_BLIND);
  });

  it("asks everybody to answer a raise", () => {
    let state = startHand(table(), 0, 1, seeded(5));
    state = act(state, { kind: "raise", by: 20 });
    expect(state.currentBet).toBe(30);
    // Round the table to the raiser: each one must call, fold or raise again.
    const asked: number[] = [];
    while (state.toAct >= 0 && !state.result) { asked.push(state.toAct); state = act(state, { kind: "call" }); }
    expect(asked).toEqual([0, 1, 2, 3]);
  });

  it("never lets a bet go past what the shortest stack can match, so there are no side pots", () => {
    const players = table();
    players[1].chips = 60;
    let state = startHand(players, 0, 1, seeded(6));
    state = act(state, { kind: "raise", by: 500 });
    expect(state.currentBet).toBe(60);
  });

  it("keeps every chip over hundreds of computer-played hands", () => {
    const random = seeded(7);
    let players = table();
    let dealer = 0;
    for (let hand = 1; hand <= 300; hand++) {
      if (players.filter(player => player.chips > 0).length < 2) players = table();
      const state = playOut(startHand(players, dealer, hand, random), random);
      expect(state.result).not.toBeNull();
      expect(total(state)).toBe(5000);
      players = playersAfter(state);
      dealer = state.dealer;
    }
  });
});
