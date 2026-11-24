import { expect, it } from "vitest";
import { simulateBattle } from "./battle";
import { rollShop } from "./shop";
import type { Fighter, ItemEffects } from "./types";

function fighter(name: string, maxHp: number, effects: ItemEffects): Fighter {
  return {
    name,
    maxHp,
    items: [{ itemId: "test-item", name: "Test Item", icon: "", cooldown: 4, effects }],
  };
}

it("stacks poison on the scheduled tick without consuming block", () => {
  const { frames } = simulateBattle(fighter("Hero", 40, { poison: 1 }), fighter("Enemy", 40, { block: 5 }));

  expect(frames[3]?.opponent).toMatchObject({ hp: 40, poisonStacks: 0 });
  expect(frames[4]?.opponent).toMatchObject({ hp: 39, block: 5, poisonStacks: 1 });
  expect(frames[8]?.opponent).toMatchObject({ hp: 37, block: 10, poisonStacks: 2 });
  expect(frames[4]?.events.map(({ kind }) => kind)).toEqual(["poison-applied", "block", "poison-damage"]);
});

it("lets a ready heal save a fighter before poison and the knockout check", () => {
  const opponent = fighter("Enemy", 3, { heal: 2 });
  const saved = simulateBattle(fighter("Hero", 40, { damage: 4 }), opponent);
  const poisoned = simulateBattle(fighter("Hero", 40, { damage: 4, poison: 1 }), opponent);

  expect(saved.frames[4]?.opponent.hp).toBe(1);
  expect(poisoned.frames[4]?.opponent.hp).toBe(0);
  expect(poisoned.winner).toBe("player");
  expect(poisoned.frames[4]?.events.slice(-2).map(({ kind }) => kind)).toEqual(["heal", "poison-damage"]);
});

it("caps healing at max HP and records the actual recovery", () => {
  const { frames } = simulateBattle(fighter("Hero", 40, { damage: 1 }), fighter("Enemy", 40, { heal: 5 }));

  expect(frames[4]?.opponent.hp).toBe(40);
  expect(frames[4]?.events).toContainEqual(expect.objectContaining({ kind: "heal", amount: 1 }));
});

it("offers the six new items across deterministic shop rolls", () => {
  const offers = Array.from({ length: 32 }, (_, seed) => rollShop(seed).offers).flat();
  expect(offers).toEqual(expect.arrayContaining([
    "venom-needle", "viper-fang", "toxic-flask", "healing-herb", "restoration-charm", "greater-tonic",
  ]));
});
