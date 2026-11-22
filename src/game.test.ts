import { expect, it } from "vitest";
import { newGame, startSearch, updateRun } from "./game";
import { buyItem, moveBlocker, moveItem, rerollBlocker, rerollShop, sellBlocker, sellItem } from "./run";

it("blocks selling an occupied backpack slot while searching", () => {
  const game = updateRun(newGame(123), (run) => buyItem(run, 0));
  const searching = startSearch(game);

  expect(searching.phase).toBe("searching");
  expect(sellBlocker(searching.run, 0)).toBeNull();
  expect(updateRun(searching, (run) => sellItem(run, 0))).toBe(searching);
});

it("blocks rerolling with enough gold while searching", () => {
  const game = updateRun(newGame(123), (run) => buyItem(run, 0));
  const searching = startSearch(game);

  expect(searching.phase).toBe("searching");
  expect(rerollBlocker(searching.run)).toBeNull();
  expect(updateRun(searching, rerollShop)).toBe(searching);
});

it("blocks moving an item while searching", () => {
  const game = updateRun(newGame(123), (run) => buyItem(run, 0));
  const searching = startSearch(game);

  expect(searching.phase).toBe("searching");
  expect(moveBlocker(searching.run, 0, 1)).toBeNull();
  expect(updateRun(searching, (run) => moveItem(run, 0, 1))).toBe(searching);
});
