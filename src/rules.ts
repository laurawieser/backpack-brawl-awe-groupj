import { BURN_DAMAGE_PER_STACK, BURN_INTERVAL_TICKS, FIRE_BURN_PER_ACTIVATION, fireStartingBurn, GUARD_FULL_SET_COUNT, guardStartingBlock, HERO_BASE_HP, MAX_TICKS, POISON_DAMAGE_PER_STACK, POISON_INTERVAL_TICKS, TICK_SECONDS } from "./battle";
import { ITEM_SETS, SET_ACTIVATION_COUNT } from "./items";
import { GOLD_PER_ROUND, SELL_PRICE_DIVISOR, START_GOLD, START_LIVES, WINS_TO_VICTORY, REROLL_COST } from "./run";
import { BACKPACK_COLS, BACKPACK_ROWS, SHOP_SIZE } from "./shop";
import type { ItemEffects } from "./types";

/**
 * Player-facing explanations of the rules. Built from the game constants so
 * the texts stay correct when numbers are rebalanced.
 */

const BATTLE_SECONDS = MAX_TICKS * TICK_SECONDS;

export const SET_HELP = {
  fire: `Fire applies one starting Burn stack to the opposing fighter per distinct Fire piece, starting at ${SET_ACTIVATION_COUNT} pieces. While Fire is active, each Fire item activation adds ${FIRE_BURN_PER_ACTIVATION} more.`,
  guard: `Guard grants +${guardStartingBlock(SET_ACTIVATION_COUNT)} starting block with ${SET_ACTIVATION_COUNT} distinct Guard pieces and +${guardStartingBlock(GUARD_FULL_SET_COUNT)} with ${GUARD_FULL_SET_COUNT}.`,
};

export function describeSetBonus(setId: (typeof ITEM_SETS)[number]["id"], pieces: number): string {
  if (setId === "fire") {
    const stacks = fireStartingBurn(pieces);
    return stacks > 0 ? `${stacks} starting Burn stacks on the opponent` : "inactive";
  }
  const block = guardStartingBlock(pieces);
  return block > 0 ? `+${block} starting block` : "inactive";
}

/** Tooltip per item effect. */
export const EFFECT_HELP: Record<keyof ItemEffects, string> = {
  damage: "Damage: hits the enemy. Block absorbs it first, the rest is lost from HP.",
  block: "Block: absorbs incoming damage until used up. Unused block stays for the rest of the battle.",
  poison: `Poison: adds stacks to the enemy for the rest of the battle. Every ${POISON_INTERVAL_TICKS * TICK_SECONDS} s from battle start, each stack deals ${POISON_DAMAGE_PER_STACK} HP damage after items activate, ignoring block.`,
  heal: "Heal: restores your own HP up to max HP when the item activates.",
};

export const COOLDOWN_HELP = `Cooldown: the item fires every time this much battle time has passed (1 tick = ${TICK_SECONDS} s).`;

/** Tooltip per fighter status shown in battle. */
export const STATUS_HELP = {
  hp: "HP: 0 or less at the end of a tick is a knockout.",
  block: EFFECT_HELP.block,
  burn: `Burn deals ${BURN_DAMAGE_PER_STACK} damage per stack every ${BURN_INTERVAL_TICKS * TICK_SECONDS} s from battle start. Block absorbs damage first. One stack expires after each Burn tick, even if all damage is blocked.`,
  timer: `After ${BATTLE_SECONDS} s the fighter with the higher share of HP wins; a tie counts as your loss.`,
};

export interface RuleSection {
  title: string;
  rules: string[];
}

export const RULES: RuleSection[] = [
  {
    title: "🏆 The run",
    rules: [
      `Reach ${WINS_TO_VICTORY} wins before you lose all ${START_LIVES} lives.`,
      `Each battle is one round: a win gives +1 win, a loss costs 1 life.`,
      `Opponents get tougher every round.`,
    ],
  },
  {
    title: "🏪 Shop & backpack",
    rules: [
      `You start with ${START_GOLD} 🪙 and earn ${GOLD_PER_ROUND} 🪙 at the start of every new round. Unspent gold carries over.`,
      `The shop offers ${SHOP_SIZE} new items every round.`,
      `Reroll the shop for ${REROLL_COST} 🪙 to replace all offers, including sold slots.`,
      `Bought items go to the first free slot of your ${BACKPACK_COLS}×${BACKPACK_ROWS} backpack.`,
      `You can sell items for ${100 / SELL_PRICE_DIVISOR}% of their price, rounded down.`,
      `Select an item, then choose an empty backpack slot to move it or an occupied slot to swap the two items.`,
      `Only items in your backpack fight. Their position doesn't matter.`,
    ],
  },
  {
    title: "⚔️ Battle",
    rules: [
      `Battles run on their own. Your hero has ${HERO_BASE_HP} HP; every item fires whenever its cooldown is up.`,
      `Damage hits block first; only the rest is lost from HP. Unused block stays for the rest of the battle.`,
      EFFECT_HELP.poison,
      EFFECT_HELP.heal,
      STATUS_HELP.burn,
      `If both fighters have an item ready at the same moment, yours goes first. A heal at full HP is wasted, even if the enemy hits right after.`,
      "A ready heal can still save a fighter during the same tick. Knockouts are checked after item effects, Poison, and Burn.",
      `Knock the enemy out to win. ${STATUS_HELP.timer} If both fall at once, you lose.`,
    ],
  },
  {
    title: "Item sets",
    rules: [
      `Set bonuses apply to both fighters. Equip at least ${SET_ACTIVATION_COUNT} distinct pieces from the same set. Duplicate copies count as one piece.`,
      SET_HELP.fire,
      SET_HELP.guard,
    ],
  },
];
