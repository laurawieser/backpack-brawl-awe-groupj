import { expect, it } from "vitest";
import { buyBlocker, buyItem, newRun, rerollBlocker, rerollShop, sellItem, moveBlocker, moveItem } from "./run";
import { rollShop } from "./shop";


it("leaves the run unchanged when the backpack is full", () => {
  const run = newRun(123);
  const itemId = run.shop[0]!;

  run.backpack = run.backpack.map((_, index) => ({
    uid: `item-${index + 1}`,
    itemId,
  }));
  run.nextUid = run.backpack.length + 1;

  expect(buyBlocker(run, 0)).toBe("Backpack is full");
  expect(buyItem(run, 0)).toBe(run);
});

it("sells a five-gold item for two gold and clears its slot", () => {
  const run = newRun(123);
  run.backpack[0] = { uid: "item-1", itemId: "iron-cleaver" };
  run.nextUid = 2;

  const updatedRun = sellItem(run, 0);

  expect(updatedRun.gold).toBe(run.gold + 2);
  expect(updatedRun.backpack[0]).toBeNull();
  expect(run.backpack[0]?.itemId).toBe("iron-cleaver");
});

it("does not award gold when selling the same slot twice", () => {
  const run = newRun(123);
  run.backpack[0] = { uid: "item-1", itemId: "iron-cleaver" };
  run.nextUid = 2;

  const afterFirstSale = sellItem(run, 0);
  const afterSecondSale = sellItem(afterFirstSale, 0);

  expect(afterSecondSale).toBe(afterFirstSale);
});

it("leaves the run unchanged when selling a slot outside the backpack", () => {
  const run = newRun(123);

  expect(sellItem(run, 99)).toBe(run);
});

it("spends one gold and updates the shop offers and seed", () => {
  const run = { ...newRun(123), gold: 1 };
  const expectedRoll = rollShop(run.seed);

  const updatedRun = rerollShop(run);

  expect(updatedRun.gold).toBe(0);
  expect(updatedRun.shop).toEqual(expectedRoll.offers);
  expect(updatedRun.seed).toBe(expectedRoll.seed);
});

it("blocks a reroll when the player has no gold", () => {
  const run = { ...newRun(123), gold: 0 };

  expect(rerollBlocker(run)).toBe("Not enough gold");
  expect(rerollShop(run)).toBe(run);
});

it("moves an item to an empty backpack slot", () => {
  const run = newRun(123);
  const item = { uid: "item-1", itemId: "iron-cleaver" };
  run.backpack[0] = item;

  const updatedRun = moveItem(run, 0, 1);

  expect(updatedRun.backpack[0]).toBeNull();
  expect(updatedRun.backpack[1]).toBe(item);
  expect(run.backpack[0]).toBe(item);
  expect(run.backpack[1]).toBeNull();
});

it("swaps two occupied backpack slots", () => {
  const run = newRun(123);
  const cleaver = { uid: "item-1", itemId: "iron-cleaver" };
  const shield = { uid: "item-2", itemId: "oak-buckler" };
  run.backpack[0] = cleaver;
  run.backpack[1] = shield;

  const updatedRun = moveItem(run, 0, 1);

  expect(updatedRun.backpack[0]).toBe(shield);
  expect(updatedRun.backpack[1]).toBe(cleaver);
});

it("blocks a move from an empty slot and leaves the run unchanged", () => {
  const run = newRun(123);

  expect(moveBlocker(run, 0, 1)).toBe("No item in the source slot");
  expect(moveItem(run, 0, 1)).toBe(run);
});

it("blocks a move to a target outside the backpack", () => {
  const run = buyItem(newRun(123), 0);

  expect(moveBlocker(run, 0, 99)).toBe("Invalid target slot");
  expect(moveItem(run, 0, 99)).toBe(run);
});

it("blocks a move to the same occupied slot", () => {
  const run = buyItem(newRun(123), 0);

  expect(moveBlocker(run, 0, 0)).toBe("Choose a different slot");
  expect(moveItem(run, 0, 0)).toBe(run);
});
