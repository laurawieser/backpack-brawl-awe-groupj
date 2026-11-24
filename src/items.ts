import type { ItemDef, ItemEffects } from "./types";

export const CATALOG: ItemDef[] = [
  { id: "chipped-dagger", name: "Chipped Dagger", icon: "🗡️", price: 2, cooldown: 4, effects: { damage: 3 } },
  { id: "hunting-bow", name: "Hunting Bow", icon: "🏹", price: 4, cooldown: 4, effects: { damage: 5 } },
  { id: "iron-cleaver", name: "Iron Cleaver", icon: "🪓", price: 5, cooldown: 8, effects: { damage: 12 } },
  { id: "oak-buckler", name: "Oak Buckler", icon: "🛡️", price: 3, cooldown: 5, effects: { block: 4 } },
  { id: "pot-lid", name: "Pot Lid", icon: "🍳", price: 2, cooldown: 3, effects: { block: 2 } },
  { id: "spiked-shield", name: "Spiked Shield", icon: "⚔️", price: 4, cooldown: 6, effects: { damage: 3, block: 3 } },
  { id: "venom-needle", name: "Venom Needle", icon: "🪡", price: 2, cooldown: 8, effects: { poison: 1 } },
  { id: "viper-fang", name: "Viper Fang", icon: "🐍", price: 4, cooldown: 6, effects: { poison: 1 } },
  { id: "toxic-flask", name: "Toxic Flask", icon: "🧪", price: 5, cooldown: 10, effects: { poison: 2 } },
  { id: "healing-herb", name: "Healing Herb", icon: "🌿", price: 2, cooldown: 6, effects: { heal: 2 } },
  { id: "restoration-charm", name: "Restoration Charm", icon: "📿", price: 4, cooldown: 6, effects: { heal: 3 } },
  { id: "greater-tonic", name: "Greater Tonic", icon: "🍵", price: 5, cooldown: 8, effects: { heal: 5 } },
];

const byId = new Map(CATALOG.map((item) => [item.id, item]));

export const ITEM_SETS = [
  { id: "fire", name: "Fire", itemIds: ["chipped-dagger", "hunting-bow", "iron-cleaver"] },
  { id: "guard", name: "Guard", itemIds: ["oak-buckler", "pot-lid", "spiked-shield"] },
] as const;

export const SET_ACTIVATION_COUNT = 2;

export function countEquippedSetItems(
  setId: (typeof ITEM_SETS)[number]["id"],
  itemIds: readonly string[],
): number {
  const set = ITEM_SETS.find((set) => set.id === setId);
  return set?.itemIds.filter((id) => itemIds.includes(id)).length ?? 0;
}

/** Returns the sets that have enough distinct items in the loadout. */
export function getActiveItemSets(itemIds: readonly string[]) {
  return ITEM_SETS.filter(
    (set) => countEquippedSetItems(set.id, itemIds) >= SET_ACTIVATION_COUNT,
  );
}

export function getItem(id: string): ItemDef {
  const item = byId.get(id);
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
}

const EFFECT_LABELS: [keyof ItemEffects, (n: number) => string][] = [
  ["poison", (n) => `☠️ +${n} poison`],
  ["heal", (n) => `💚 +${n} HP`],
  ["damage", (n) => `⚔️ ${n} dmg`],
  ["block", (n) => `🛡️ +${n} block`],
];

/** Short labels for an item's effects, e.g. `[{ effect: "damage", label: "⚔️ 2 dmg" }, …]`. */
export function describeEffects(effects: ItemEffects): { effect: keyof ItemEffects; label: string }[] {
  return EFFECT_LABELS.flatMap(([effect, label]) => (effects[effect] ? [{ effect, label: label(effects[effect]) }] : []));
}
