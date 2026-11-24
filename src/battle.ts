import { countEquippedSetItems, getItem, SET_ACTIVATION_COUNT } from "./items";
import { itemIdsOf } from "./shop";
import type { Backpack, BattleEvent, BattleResult, Fighter, FighterItem, FighterSnapshot, Opponent, Side } from "./types";

/** Seconds per battle tick. */
export const TICK_SECONDS = 0.5;
/** Battles that last longer are decided by the timeout rule. */
export const MAX_TICKS = 60;
export const HERO_BASE_HP = 40;

export const POISON_INTERVAL_TICKS = 4;
export const POISON_DAMAGE_PER_STACK = 1;
export const GUARD_FULL_SET_COUNT = 3;
export const GUARD_PARTIAL_START_BLOCK = 2;
export const GUARD_FULL_START_BLOCK = 4;

/** Turns a list of item ids into a fighter with the catalog values of each item. */
export function buildFighter(itemIds: string[], baseHp: number, name = "Fighter"): Fighter {
  const items: FighterItem[] = itemIds.map((id) => {
    const def = getItem(id);
    return { itemId: def.id, name: def.name, icon: def.icon, cooldown: def.cooldown, effects: { ...def.effects } };
  });
  return { name, maxHp: baseHp, items };
}

/** The player's fighter: every backpack item and the hero's base HP. */
export function buildPlayerFighter(backpack: Backpack): Fighter {
  return buildFighter(itemIdsOf(backpack), HERO_BASE_HP, "Hero");
}

export function buildOpponentFighter(opponent: Opponent): Fighter {
  return buildFighter(opponent.items, opponent.hp, opponent.name);
}

interface FighterState {
  fighter: Fighter;
  hp: number;
  block: number;
  /** Ticks each item has charged towards its cooldown. */
  charge: number[];
  poisonStacks: number;
}

const other = (side: Side): Side => (side === "player" ? "opponent" : "player");

const snapshot = (s: FighterState): FighterSnapshot => ({
  hp: Math.max(0, s.hp),
  maxHp: s.fighter.maxHp,
  block: s.block,
  poisonStacks: s.poisonStacks,
});

const isDown = (s: FighterState) => s.hp <= 0;

/**
 * Runs a full battle. Pure and deterministic: the same fighters always give
 * the same result.
 *
 * Each tick:
 * 1. Each fighter charges all items by one tick; items whose charge reaches their cooldown fire.
 * 2. Fired items resolve (player first, then opponent). Both sides fire "simultaneously":
 *    which items fire is decided before any effect is applied.
 * 3. Apply scheduled poison damage to both fighters, including any new stacks.
 * Then the battle ends if someone is down; if both are down, the player loses.
 * After `MAX_TICKS` the higher HP percentage wins; a tie is a player loss.
 */
export function simulateBattle(player: Fighter, opponent: Fighter): BattleResult {
  const state: Record<Side, FighterState> = {
    player: initState(player),
    opponent: initState(opponent),
  };
  const frames: BattleResult["frames"] = [
    { tick: 0, player: snapshot(state.player), opponent: snapshot(state.opponent), events: [] },
  ];
  const events: BattleEvent[] = [];

  const knockoutWinner = (): Side | null => {
    if (isDown(state.player)) return "opponent";
    if (isDown(state.opponent)) return "player";
    return null;
  };

  let winner: Side | null = null;
  let tick = 0;
  while (winner === null && tick < MAX_TICKS) {
    tick += 1;
    const tickEvents: BattleEvent[] = [];
    const emit = (event: Omit<BattleEvent, "tick">) => tickEvents.push({ tick, ...event });

    const fired: Record<Side, FighterItem[]> = {
      player: chargeItems(state.player),
      opponent: chargeItems(state.opponent),
    };
    for (const side of ["player", "opponent"] as const) {
      for (const item of fired[side]) resolveItem(item, state[side], state[other(side)], side, emit);
    }
    if (tick % POISON_INTERVAL_TICKS === 0) {
      for (const target of ["player", "opponent"] as const) {
        const poisoned = state[target];
        const amount = poisoned.poisonStacks * POISON_DAMAGE_PER_STACK;
        if (amount === 0) continue;
        poisoned.hp -= amount;
        emit({ source: other(target), target, kind: "poison-damage", amount, message: `${poisoned.fighter.name} loses ${amount} HP to poison` });
      }
    }
    winner = knockoutWinner();

    frames.push({ tick, player: snapshot(state.player), opponent: snapshot(state.opponent), events: tickEvents });
    events.push(...tickEvents);
  }

  if (winner !== null) return { winner, reason: "knockout", frames, events };
  return { winner: timeoutWinner(state.player, state.opponent), reason: "timeout", frames, events };
}

function initState(fighter: Fighter): FighterState {
  const guardPieces = countEquippedSetItems(
    "guard",
    fighter.items.map((item) => item.itemId),
  );

  let block = 0;
  if (guardPieces >= GUARD_FULL_SET_COUNT) {
    block = GUARD_FULL_START_BLOCK;
  } else if (guardPieces >= SET_ACTIVATION_COUNT) {
    block = GUARD_PARTIAL_START_BLOCK;
  }

  return { fighter, hp: fighter.maxHp, block, poisonStacks: 0, charge: fighter.items.map(() => 0) };
}

/** Advances one tick of cooldowns and returns the items that fire this tick. */
function chargeItems(s: FighterState): FighterItem[] {
  const fired: FighterItem[] = [];
  s.fighter.items.forEach((item, i) => {
    s.charge[i] += 1;
    if (s.charge[i] >= item.cooldown) {
      s.charge[i] = 0;
      fired.push(item);
    }
  });
  return fired;
}

function resolveItem(
  item: FighterItem,
  self: FighterState,
  enemy: FighterState,
  side: Side,
  emit: (event: Omit<BattleEvent, "tick">) => void,
) {
  const { damage, block, poison, heal } = item.effects;
  const base = { source: side, itemId: item.itemId };
  const enemySide = other(side);

  if (damage) {
    const absorbed = Math.min(enemy.block, damage);
    enemy.block -= absorbed;
    enemy.hp -= damage - absorbed;
    const note = absorbed > 0 ? ` (${absorbed} blocked)` : "";
    emit({ ...base, target: enemySide, kind: "damage", amount: damage, message: `${item.name} hits ${enemy.fighter.name} for ${damage}${note}` });
  }
  if (block) {
    self.block += block;
    emit({ ...base, target: side, kind: "block", amount: block, message: `${item.name} grants ${self.fighter.name} ${block} block` });
  }
  if (poison) {
    enemy.poisonStacks += poison;
    emit({ ...base, target: enemySide, kind: "poison-applied", amount: poison, message: `${item.name} adds ${poison} poison to ${enemy.fighter.name} (${enemy.poisonStacks} total)` });
  }
  if (heal) {
    const amount = Math.min(heal, self.fighter.maxHp - self.hp);
    self.hp += amount;
    const message = amount > 0
      ? `${item.name} restores ${amount} HP to ${self.fighter.name}`
      : `${self.fighter.name} is already at full HP when ${item.name} activates`;
    emit({ ...base, target: side, kind: "heal", amount, message });
  }
}

function timeoutWinner(player: FighterState, opponent: FighterState): Side {
  const ratio = (s: FighterState) => s.hp / s.fighter.maxHp;
  return ratio(player) > ratio(opponent) ? "player" : "opponent";
}
