import { countEquippedSetItems, getItem, getItemSet, SET_ACTIVATION_COUNT } from "./items";
import { itemIdsOf } from "./shop";
import type { Backpack, BattleEvent, BattleResult, Fighter, FighterItem, FighterSnapshot, Opponent, Side } from "./types";

/** Seconds per battle tick. */
export const TICK_SECONDS = 0.5;
/** Battles that last longer are decided by the timeout rule. */
export const MAX_TICKS = 60;
export const HERO_BASE_HP = 40;

export const POISON_INTERVAL_TICKS = 4;
export const POISON_DAMAGE_PER_STACK = 1;
/** Burn deals damage every this many ticks, twice as often as Poison. */
export const BURN_INTERVAL_TICKS = 2;
export const BURN_DAMAGE_PER_STACK = 1;
/** Burn stacks a Fire item adds each time it activates while its owner's Fire set is active. */
export const FIRE_BURN_PER_ACTIVATION = 1;
/**
 * Most Burn stacks a fighter can have. Without a cap, several Fire items outpace the decay and
 * Burn grows for the whole battle. Equal to the full Fire starting bonus (three pieces).
 */
export const MAX_BURN_STACKS = 3;
export const GUARD_FULL_SET_COUNT = 3;
export const GUARD_PARTIAL_START_BLOCK = 2;
export const GUARD_FULL_START_BLOCK = 4;

export function guardStartingBlock(pieces: number): number {
  if (pieces >= GUARD_FULL_SET_COUNT) return GUARD_FULL_START_BLOCK;
  if (pieces >= SET_ACTIVATION_COUNT) return GUARD_PARTIAL_START_BLOCK;
  return 0;
}

export function fireStartingBurn(pieces: number): number {
  return pieces >= SET_ACTIVATION_COUNT ? pieces : 0;
}

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
  burnStacks: number;
  fireStartingStacks: number;
}

const other = (side: Side): Side => (side === "player" ? "opponent" : "player");

const snapshot = (s: FighterState): FighterSnapshot => ({
  hp: Math.max(0, s.hp),
  maxHp: s.fighter.maxHp,
  block: s.block,
  poisonStacks: s.poisonStacks,
  burnStacks: s.burnStacks,
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
 * 4. Apply scheduled Burn damage to both fighters and remove one Burn stack.
 * Then the battle ends if someone is down; if both are down, the player loses.
 * After `MAX_TICKS` the higher HP percentage wins; a tie is a player loss.
 */
export function simulateBattle(player: Fighter, opponent: Fighter): BattleResult {
  const state: Record<Side, FighterState> = {
    player: initState(player),
    opponent: initState(opponent),
  };
  const events: BattleEvent[] = [];
  for (const source of ["player", "opponent"] as const) {
    const fighterState = state[source];
    if (fighterState.block > 0) {
      events.push({
        tick: 0,
        source,
        target: source,
        kind: "block",
        amount: fighterState.block,
        message: `Guard grants ${fighterState.fighter.name} ${fighterState.block} starting block`,
      });
    }
    const amount = Math.min(fighterState.fireStartingStacks, MAX_BURN_STACKS);
    if (amount === 0) continue;

    const target = other(source);
    state[target].burnStacks = amount;
    events.push({
      tick: 0,
      source,
      target,
      kind: "burn-applied",
      amount,
      message: `Fire applies ${amount} Burn stacks to ${state[target].fighter.name}`,
    });
  }
  const frames: BattleResult["frames"] = [
    { tick: 0, player: snapshot(state.player), opponent: snapshot(state.opponent), events: [...events] },
  ];

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
    if (tick % BURN_INTERVAL_TICKS === 0) {
      for (const target of ["player", "opponent"] as const) {
        const burning = state[target];
        if (burning.burnStacks === 0) continue;

        const amount = burning.burnStacks * BURN_DAMAGE_PER_STACK;
        const absorbed = Math.min(burning.block, amount);
        burning.block -= absorbed;
        burning.hp -= amount - absorbed;
        burning.burnStacks -= 1;

        const note = absorbed > 0 ? ` (${absorbed} blocked)` : "";
        emit({
          source: other(target),
          target,
          kind: "burn-damage",
          amount,
          message: `${burning.fighter.name} takes ${amount} Burn damage${note} (${burning.burnStacks} stacks left)`,
        });
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
  const itemIds = fighter.items.map((item) => item.itemId);
  return {
    fighter,
    hp: fighter.maxHp,
    block: guardStartingBlock(countEquippedSetItems("guard", itemIds)),
    fireStartingStacks: fireStartingBurn(countEquippedSetItems("fire", itemIds)),
    poisonStacks: 0,
    burnStacks: 0,
    charge: fighter.items.map(() => 0),
  };
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
  if (self.fireStartingStacks > 0 && getItemSet(item.itemId)?.id === "fire") {
    const amount = Math.min(FIRE_BURN_PER_ACTIVATION, MAX_BURN_STACKS - enemy.burnStacks);
    enemy.burnStacks += amount;
    const message = amount > 0
      ? `${item.name} adds ${amount} Burn to ${enemy.fighter.name} (${enemy.burnStacks} stacks total)`
      : `${enemy.fighter.name} already has the maximum of ${MAX_BURN_STACKS} Burn stacks when ${item.name} activates`;
    emit({ ...base, target: enemySide, kind: "burn-applied", amount, message });
  }
}

function timeoutWinner(player: FighterState, opponent: FighterState): Side {
  const ratio = (s: FighterState) => s.hp / s.fighter.maxHp;
  return ratio(player) > ratio(opponent) ? "player" : "opponent";
}
