import { getItem } from "./items";
import { BACKPACK_SIZE, rollShop } from "./shop";
import type { RunOutcome, RunState, Side } from "./types";

// WINS_TO_VICTORY and START_LIVES are copied in server/hallOfFame.js; server/hallOfFame.test.js keeps them equal.
export const START_GOLD = 10;
export const START_LIVES = 3;
export const WINS_TO_VICTORY = 5;
export const GOLD_PER_ROUND = 5;

/** A fresh run. `runId` must be unique (e.g. `crypto.randomUUID()`), the hall of fame relies on it. */
export function newRun(seed: number, runId: string): RunState {
  const roll = rollShop(seed);
  return {
    runId,
    round: 1,
    gold: START_GOLD,
    lives: START_LIVES,
    wins: 0,
    results: [],
    seed: roll.seed,
    shop: roll.offers,
    backpack: Array(BACKPACK_SIZE).fill(null),
    nextUid: 1,
  };
}

export function firstFreeSlot(state: RunState): number {
  return state.backpack.indexOf(null);
}

/** Why an offer can't be bought right now, or `null` if it can. */
export function buyBlocker(state: RunState, offerIndex: number): string | null {
  const itemId = state.shop[offerIndex];
  if (!itemId) return "Already sold";
  if (state.gold < getItem(itemId).price) return "Not enough gold";
  if (firstFreeSlot(state) === -1) return "Backpack is full";

  return null;
}

/** Buys a shop offer into the first free backpack slot; unchanged state if not allowed. */
export function buyItem(state: RunState, offerIndex: number): RunState {
  if (buyBlocker(state, offerIndex) !== null) return state;
  const itemId = state.shop[offerIndex]!;
  const slot = firstFreeSlot(state);
  const backpack = [...state.backpack];
  backpack[slot] = { uid: `item-${state.nextUid}`, itemId };
  const shop = [...state.shop];
  shop[offerIndex] = null;
  return { ...state, gold: state.gold - getItem(itemId).price, shop, backpack, nextUid: state.nextUid + 1 };
}

export const SELL_PRICE_DIVISOR = 2;

export function sellPrice(itemId: string): number {
  return Math.floor(getItem(itemId).price / SELL_PRICE_DIVISOR);
}

export function sellBlocker(state: RunState, slotIndex: number): string | null {
  return state.backpack[slotIndex] ? null : "No item in this slot";
}

export function sellItem(state: RunState, slotIndex: number): RunState {
  if (sellBlocker(state, slotIndex) !== null) return state;

  const slot = state.backpack[slotIndex]!;
  const backpack = [...state.backpack];
  backpack[slotIndex] = null;

  return {
    ...state,
    backpack,
    gold: state.gold + sellPrice(slot.itemId),
  };
}

export function moveBlocker(
  state: RunState,
  fromSlot: number,
  toSlot: number,
): string | null {
  const slotCount = state.backpack.length;

  if (!Number.isInteger(fromSlot) || fromSlot < 0 || fromSlot >= slotCount) {
    return "Invalid source slot";
  }

  if (!Number.isInteger(toSlot) || toSlot < 0 || toSlot >= slotCount) {
    return "Invalid target slot";
  }

  if (state.backpack[fromSlot] === null) {
    return "No item in the source slot";
  }

  if (fromSlot === toSlot) {
    return "Choose a different slot";
  }

  return null;
}

export function moveItem(
  state: RunState,
  fromSlot: number,
  toSlot: number,
): RunState {
  if (moveBlocker(state, fromSlot, toSlot) !== null) return state;

  const backpack = [...state.backpack];
  const sourceItem = backpack[fromSlot];

  backpack[fromSlot] = backpack[toSlot];
  backpack[toSlot] = sourceItem;

  return { ...state, backpack };
}

export const REROLL_COST = 1;

export function rerollBlocker(state: RunState): string | null {
  return state.gold < REROLL_COST ? "Not enough gold" : null;
}

export function rerollShop(state: RunState): RunState {
  if (rerollBlocker(state) !== null) return state;

  const roll = rollShop(state.seed);

  return {
    ...state,
    gold: state.gold - REROLL_COST,
    shop: roll.offers,
    seed: roll.seed,
  };
}

/** `victory` / `defeat` once the run is over, otherwise `null`. */
export function runOutcome(state: RunState): RunOutcome | null {
  if (state.wins >= WINS_TO_VICTORY) return "victory";
  if (state.lives <= 0) return "defeat";
  return null;
}

/** Starts the next round: round + 1, round gold, fresh shop. The backpack is kept. */
export function startNextRound(state: RunState): RunState {
  const roll = rollShop(state.seed);
  return { ...state, round: state.round + 1, gold: state.gold + GOLD_PER_ROUND, seed: roll.seed, shop: roll.offers };
}

/**
 * Records a battle (win → +1 win, loss → −1 life), adds it to `results`
 * and moves on to the next round unless the run is over.
 */
export function applyBattleResult(state: RunState, winner: Side): RunState {
  const won = winner === "player";
  const scored: RunState = {
    ...state,
    wins: won ? state.wins + 1 : state.wins,
    lives: won ? state.lives : state.lives - 1,
    results: [...state.results, won ? "win" : "loss"],
  };
  return runOutcome(scored) ? scored : startNextRound(scored);
}
