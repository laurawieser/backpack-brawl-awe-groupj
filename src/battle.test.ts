import { expect, it } from "vitest";
import { buildFighter, simulateBattle } from "./battle";
import { rollShop } from "./shop";
import type { Fighter, ItemEffects } from "./types";

function fighter(name: string, maxHp: number, effects: ItemEffects): Fighter {
  return {
    name,
    maxHp,
    items: [{ itemId: "test-item", name: "Test Item", icon: "", cooldown: 4, effects }],
  };
}

it("grants Guard starting block for two and three distinct pieces", () => {
  const player = buildFighter(["oak-buckler", "pot-lid"], 40);
  const opponent = buildFighter(["oak-buckler", "pot-lid", "spiked-shield"], 40);
  const { frames } = simulateBattle(player, opponent);

  expect(frames[0].player.block).toBe(2);
  expect(frames[0].opponent.block).toBe(4);
  expect(frames[0].events).toMatchObject([
    { tick: 0, kind: "block", source: "player", target: "player", amount: 2, message: "Guard grants Fighter 2 starting block" },
    { tick: 0, kind: "block", source: "opponent", target: "opponent", amount: 4, message: "Guard grants Fighter 4 starting block" },
  ]);
});

it("counts duplicate Guard items as a single piece", () => {
  const player = buildFighter(["oak-buckler", "oak-buckler"], 40);
  const opponent = buildFighter(["chipped-dagger"], 40);
  const { frames } = simulateBattle(player, opponent);

  expect(frames[0].player.block).toBe(0);
  expect(frames[0].opponent.block).toBe(0);
  expect(frames[0].events).toEqual([]);
});

it("applies Fire starting stacks to both opposing fighters", () => {
  const player = buildFighter(["chipped-dagger", "hunting-bow"], 40);
  const opponent = buildFighter(["chipped-dagger", "hunting-bow", "iron-cleaver"], 40);
  const { frames } = simulateBattle(player, opponent);

  expect(frames[0].player.burnStacks).toBe(3);
  expect(frames[0].opponent.burnStacks).toBe(2);
  expect(frames[0].events).toMatchObject([
    { tick: 0, kind: "burn-applied", target: "opponent", amount: 2 },
    { tick: 0, kind: "burn-applied", target: "player", amount: 3 },
  ]);
});

it("does not activate Fire with duplicate copies alone", () => {
  const player = buildFighter(["chipped-dagger", "chipped-dagger"], 40);
  const opponent = buildFighter([], 40);
  const { frames } = simulateBattle(player, opponent);

  expect(frames[0].opponent.burnStacks).toBe(0);
});

it("consumes block before HP and reduces Burn after each scheduled tick", () => {
  const player = buildFighter(["chipped-dagger", "hunting-bow", "iron-cleaver"], 40);
  const opponent = buildFighter(["oak-buckler", "pot-lid", "spiked-shield"], 40);
  const { frames, events } = simulateBattle(player, opponent);

  expect(frames[1].opponent).toMatchObject({ hp: 40, block: 4, burnStacks: 3 });
  expect(frames[2].opponent).toMatchObject({ hp: 38, block: 0, burnStacks: 2 });
  expect(frames[6].opponent.burnStacks).toBe(0);
  expect(events.filter((event) => event.kind === "burn-damage")).toMatchObject([
    { tick: 2, amount: 6 },
    { tick: 4, amount: 4 },
    { tick: 6, amount: 2 },
  ]);
});

it("reduces Burn even when block absorbs all its damage", () => {
  const player = buildFighter(["chipped-dagger", "hunting-bow"], 40);
  const opponent = buildFighter(["oak-buckler", "pot-lid", "spiked-shield"], 40);
  const { frames } = simulateBattle(player, opponent);

  expect(frames[2].opponent).toMatchObject({ hp: 40, block: 0, burnStacks: 1 });
});

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
