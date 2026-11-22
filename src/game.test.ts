import { describe, expect, it } from "vitest";
import {
  fightBlocker,
  leaveBattle,
  newGame,
  searchFailed,
  skipReplay,
  startBattle,
  startSearch,
  updateRun,
  WRONG_ROUND_ERROR,
} from "./game";
import { buyItem, moveBlocker, moveItem, rerollBlocker, rerollShop, sellBlocker, sellItem } from "./run";
import type { Opponent } from "./types";

it("blocks selling an occupied backpack slot while searching", () => {
  const game = updateRun(newGame(123), (run) => buyItem(run, 0));
  const searching = startSearch(game, "search-1");

  expect(searching.phase).toBe("searching");
  expect(sellBlocker(searching.run, 0)).toBeNull();
  expect(updateRun(searching, (run) => sellItem(run, 0))).toBe(searching);
});

it("blocks rerolling with enough gold while searching", () => {
  const game = updateRun(newGame(123), (run) => buyItem(run, 0));
  const searching = startSearch(game, "search-1");

  expect(searching.phase).toBe("searching");
  expect(rerollBlocker(searching.run)).toBeNull();
  expect(updateRun(searching, rerollShop)).toBe(searching);
});

describe("opponent search (B5)", () => {
  const opponentFor = (round: number): Opponent => ({
    id: "test-dummy",
    name: "Test Dummy",
    icon: "🎯",
    hp: 1,
    round,
    items: ["chipped-dagger"],
  });
  const readyToFight = () => updateRun(newGame(123), (run) => buyItem(run, 0));

  it("can't start a second search while one is running", () => {
    const searching = startSearch(readyToFight(), "search-1");

    expect(fightBlocker(searching)).toBe("Searching…");
    expect(startSearch(searching, "search-2")).toBe(searching);
    expect(searching.searchId).toBe("search-1");
  });

  it("returns to a usable shop with the message after a failed search", () => {
    const failed = searchFailed(startSearch(readyToFight(), "search-1"), "search-1", "The arena gates are shut.");

    expect(failed.phase).toBe("shop");
    expect(failed.error).toBe("The arena gates are shut.");
    expect(failed.searchId).toBeNull();
    expect(fightBlocker(failed)).toBeNull();
    expect(updateRun(failed, rerollShop)).not.toBe(failed);
  });

  it("clears the error when the player tries again", () => {
    const failed = searchFailed(startSearch(readyToFight(), "search-1"), "search-1", "The arena gates are shut.");
    const retry = startSearch(failed, "search-2");

    expect(retry.phase).toBe("searching");
    expect(retry.error).toBeNull();
    expect(retry.searchId).toBe("search-2");
  });

  it("starts the battle for the current search and round", () => {
    const battle = startBattle(startSearch(readyToFight(), "search-1"), "search-1", opponentFor(1));

    expect(battle.phase).toBe("battle");
    expect(battle.battle?.opponent.id).toBe("test-dummy");
    expect(battle.searchId).toBeNull();
  });

  it("ignores a duplicate response once the battle has started", () => {
    const battle = startBattle(startSearch(readyToFight(), "search-1"), "search-1", opponentFor(1));

    expect(startBattle(battle, "search-1", opponentFor(1))).toBe(battle);
  });

  it("applies the result only once when a late response arrives after the replay", () => {
    const finished = skipReplay(startBattle(startSearch(readyToFight(), "search-1"), "search-1", opponentFor(1)));
    const back = leaveBattle(finished);

    expect(startBattle(finished, "search-1", opponentFor(1))).toBe(finished);
    expect(startBattle(back, "search-1", opponentFor(1))).toBe(back);
    expect(searchFailed(back, "search-1", "late failure")).toBe(back);
  });

  it("ignores a response outside a search", () => {
    const shopping = readyToFight();

    expect(startBattle(shopping, "search-1", opponentFor(1))).toBe(shopping);
    expect(searchFailed(shopping, "search-1", "late failure")).toBe(shopping);
  });

  it("ignores a late response from an earlier search of the same round", () => {
    const failed = searchFailed(startSearch(readyToFight(), "search-1"), "search-1", "timeout");
    const retry = startSearch(failed, "search-2");

    expect(startBattle(retry, "search-1", opponentFor(1))).toBe(retry);
    expect(searchFailed(retry, "search-1", "late failure")).toBe(retry);
  });

  it("ignores a response from an abandoned run", () => {
    startSearch(readyToFight(), "old-run-search");
    const newRunSearching = startSearch(readyToFight(), "new-run-search");

    expect(startBattle(newRunSearching, "old-run-search", opponentFor(1))).toBe(newRunSearching);
  });

  it("fails the search when the opponent belongs to another round", () => {
    const wrongRound = startBattle(startSearch(readyToFight(), "search-1"), "search-1", opponentFor(2));

    expect(wrongRound.phase).toBe("shop");
    expect(wrongRound.battle).toBeNull();
    expect(wrongRound.error).toBe(WRONG_ROUND_ERROR);
  });
});

it("blocks moving an item while searching", () => {
  const game = updateRun(newGame(123), (run) => buyItem(run, 0));
  const searching = startSearch(game, "search-1");

  expect(searching.phase).toBe("searching");
  expect(moveBlocker(searching.run, 0, 1)).toBeNull();
  expect(updateRun(searching, (run) => moveItem(run, 0, 1))).toBe(searching);
});