import { expect, it } from "vitest";
import { buildFighter, MAX_TICKS, simulateBattle } from "./battle";
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
  const { frames, events } = simulateBattle(player, opponent);

  expect(frames[0].opponent.burnStacks).toBe(0);
  expect(events.some(({ kind }) => kind === "burn-applied" || kind === "burn-damage")).toBe(false);
});

it("consumes block before HP and reduces Burn after each scheduled tick", () => {
  const player = buildFighter(["chipped-dagger", "hunting-bow", "iron-cleaver"], 40);
  for (const item of player.items) item.cooldown = MAX_TICKS + 1;
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

it("adds Burn for every Fire item activation once distinct pieces unlock Fire", () => {
  const player = buildFighter(["chipped-dagger", "chipped-dagger", "hunting-bow", "pot-lid"], 40);
  const opponent = buildFighter([], 1000);
  const { frames } = simulateBattle(player, opponent);

  expect(frames[0].opponent.burnStacks).toBe(2);
  expect(frames[4].events.filter(({ kind }) => kind === "burn-applied" || kind === "burn-damage")).toMatchObject([
    { kind: "burn-applied", itemId: "chipped-dagger", amount: 1 },
    { kind: "burn-applied", itemId: "chipped-dagger", amount: 1 },
    { kind: "burn-applied", itemId: "hunting-bow", amount: 1 },
    { kind: "burn-damage", amount: 8 },
  ]);
  expect(frames[4].opponent.burnStacks).toBe(3);
});

it("can knock out a fighter with Burn before any item fires", () => {
  const player = buildFighter(["chipped-dagger", "hunting-bow"], 40);
  const result = simulateBattle(player, buildFighter([], 4));

  expect(result).toMatchObject({ winner: "player", reason: "knockout" });
  expect(result.frames.at(-1)).toMatchObject({
    tick: 2,
    opponent: { hp: 0 },
    events: [{ kind: "burn-damage", amount: 4 }],
  });
});

it("resolves Poison and then Burn before checking for a knockout", () => {
  const player = fighter("Poison fighter", 5, { poison: 1 });
  const opponent = buildFighter(["chipped-dagger", "hunting-bow"], 1);
  for (const item of opponent.items) item.effects = {};
  const result = simulateBattle(player, opponent);

  expect(result).toMatchObject({ winner: "opponent", reason: "knockout" });
  expect(result.frames[3]).toMatchObject({ player: { hp: 1 }, opponent: { hp: 1 } });
  const finalFrame = result.frames.at(-1);
  expect(finalFrame).toMatchObject({ tick: 4, player: { hp: 0 }, opponent: { hp: 0 } });
  expect(finalFrame?.events.slice(-2)).toMatchObject([
    { kind: "poison-damage", target: "opponent" },
    { kind: "burn-damage", target: "player" },
  ]);
});

it("deals earlier and greater status damage with two Fire pieces than one Venom Needle", () => {
  const target = buildFighter([], 1000);
  const fire = simulateBattle(buildFighter(["chipped-dagger", "hunting-bow"], 40), target);
  const poison = simulateBattle(buildFighter(["venom-needle"], 40), target);
  const burnDamage = fire.events.filter(({ kind }) => kind === "burn-damage");
  const poisonDamage = poison.events.filter(({ kind }) => kind === "poison-damage");

  expect([fire.frames.at(-1)?.tick, poison.frames.at(-1)?.tick]).toEqual([MAX_TICKS, MAX_TICKS]);
  expect(burnDamage[0].tick).toBeLessThan(poisonDamage[0].tick);
  expect(burnDamage.reduce((total, { amount }) => total + amount, 0))
    .toBeGreaterThan(poisonDamage.reduce((total, { amount }) => total + amount, 0));
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
