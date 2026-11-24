import { expect, it } from "vitest";
import { getActiveItemSets, getItem, ITEM_SETS } from "./items";

it("uses existing catalog items in both sets", () => {
  for (const set of ITEM_SETS) {
    expect(new Set(set.itemIds).size).toBeGreaterThanOrEqual(3);
    for (const id of set.itemIds) expect(getItem(id).id).toBe(id);
  }
});

it.each([
  { itemIds: [] },
  { itemIds: ["chipped-dagger"] },
  { itemIds: ["chipped-dagger", "chipped-dagger"] },
  { itemIds: ["chipped-dagger", "oak-buckler"] },
])("keeps sets inactive for loadout $itemIds", ({ itemIds }) => {
  expect(getActiveItemSets(itemIds)).toEqual([]);
});

it("activates both sets when each has two distinct items", () => {
  const equipped = ["chipped-dagger", "chipped-dagger", "hunting-bow", "oak-buckler", "pot-lid"];
  expect(getActiveItemSets(equipped).map((set) => set.id)).toEqual(["fire", "guard"]);
});
