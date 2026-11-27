import { describe, expect, it } from "vitest";
import {
  editName,
  fightBlocker,
  leaveBattle,
  newGame,
  searchFailed,
  skipReplay,
  startBattle,
  startSearch,
  startSubmit,
  submitBlocker,
  submitFailed,
  submitSucceeded,
  updateRun,
  WRONG_ROUND_ERROR,
} from "../game";
import {
  applyBattleResult,
  buyItem,
  moveBlocker,
  moveItem,
  rerollBlocker,
  rerollShop,
  sellBlocker,
  sellItem,
  WINS_TO_VICTORY,
} from "../run";
import type { GameState, Opponent, SavedRun, Side } from "../types";

it("blocks selling an occupied backpack slot while searching", () => {
  const game = updateRun(newGame(123, "run-1"), (run) => buyItem(run, 0));
  const searching = startSearch(game, "search-1");

  expect(searching.phase).toBe("searching");
  expect(sellBlocker(searching.run, 0)).toBeNull();
  expect(updateRun(searching, (run) => sellItem(run, 0))).toBe(searching);
});

it("blocks rerolling with enough gold while searching", () => {
  const game = updateRun(newGame(123, "run-1"), (run) => buyItem(run, 0));
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
  const readyToFight = () => updateRun(newGame(123, "run-1"), (run) => buyItem(run, 0));

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
  const game = updateRun(newGame(123, "run-1"), (run) => buyItem(run, 0));
  const searching = startSearch(game, "search-1");

  expect(searching.phase).toBe("searching");
  expect(moveBlocker(searching.run, 0, 1)).toBeNull();
  expect(updateRun(searching, (run) => moveItem(run, 0, 1))).toBe(searching);
});
describe("hall of fame submission (B7)", () => {
  const saved: SavedRun = {
    entry: { id: "run-1", name: "Martin", outcome: "victory", wins: 5, lives: 3, rounds: 5 },
    rank: 1,
  };
  /** A game whose run was won in straight battles. */
  const finishedGame = (runId = "run-1"): GameState => {
    const game = newGame(123, runId);
    const sides: Side[] = Array(WINS_TO_VICTORY).fill("player");
    return { ...game, phase: "finished", run: sides.reduce(applyBattleResult, game.run) };
  };
  const named = (name: string, runId = "run-1") => editName(finishedGame(runId), name);

  it("can't be sent before the run is over", () => {
    const shopping = newGame(123, "run-1");

    expect(shopping.submission).toEqual({ name: "", status: "editing", error: null, saved: null });
    expect(submitBlocker(shopping)).toBe("Finish the run first");
    expect(editName(shopping, "Martin")).toBe(shopping);
    expect(startSubmit(shopping)).toBe(shopping);
  });

  it("needs a valid name", () => {
    const unnamed = finishedGame();

    expect(submitBlocker(unnamed)).toBe("Enter your name");
    expect(startSubmit(unnamed)).toBe(unnamed);
    expect(submitBlocker(named("Martin"))).toBeNull();
  });

  it("can't be sent a second time while the first attempt is running", () => {
    const sending = startSubmit(named("Martin"));

    expect(sending.submission.status).toBe("sending");
    expect(submitBlocker(sending)).toBe("Saving…");
    expect(startSubmit(sending)).toBe(sending);
    expect(editName(sending, "Laura")).toBe(sending);
  });

  it("keeps the name and shows the error after a failed attempt", () => {
    const failed = submitFailed(startSubmit(named("Martin")), "run-1", "The hall of fame is closed.");

    expect(failed.submission).toEqual({ name: "Martin", status: "editing", error: "The hall of fame is closed.", saved: null });
    expect(submitBlocker(failed)).toBeNull();
  });

  it("clears the error when the player tries again", () => {
    const failed = submitFailed(startSubmit(named("Martin")), "run-1", "The hall of fame is closed.");
    const retry = startSubmit(failed);

    expect(retry.submission.status).toBe("sending");
    expect(retry.submission.error).toBeNull();
  });

  it("stores the answer and blocks every further submission", () => {
    const done = submitSucceeded(startSubmit(named("Martin")), "run-1", saved);

    expect(done.submission.status).toBe("saved");
    expect(done.submission.saved).toEqual(saved);
    expect(submitBlocker(done)).toBe("Already in the hall of fame");
    expect(startSubmit(done)).toBe(done);
    expect(editName(done, "Laura")).toBe(done);
  });

  it("ignores a duplicate or late answer once the run is saved", () => {
    const done = submitSucceeded(startSubmit(named("Martin")), "run-1", saved);

    expect(submitSucceeded(done, "run-1", { ...saved, rank: 2 })).toBe(done);
    expect(submitFailed(done, "run-1", "late failure")).toBe(done);
  });

  it("ignores an answer while nothing is being sent", () => {
    const editing = named("Martin");

    expect(submitSucceeded(editing, "run-1", saved)).toBe(editing);
    expect(submitFailed(editing, "run-1", "late failure")).toBe(editing);
  });

  it("ignores an answer for an abandoned run", () => {
    const otherRunSending = startSubmit(named("Laura", "run-2"));

    expect(submitSucceeded(otherRunSending, "run-1", saved)).toBe(otherRunSending);
    expect(submitFailed(otherRunSending, "run-1", "late failure")).toBe(otherRunSending);
  });
});
