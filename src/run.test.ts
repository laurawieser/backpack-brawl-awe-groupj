import { expect, it } from "vitest";
import { buyBlocker, buyItem, newRun, sellItem } from "./run";


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