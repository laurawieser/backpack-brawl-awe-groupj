import { buildOpponentFighter, buildPlayerFighter, simulateBattle } from "./battle";
import { nameBlocker } from "./hallOfFame";
import { applyBattleResult, newRun, runOutcome } from "./run";
import { itemIdsOf } from "./shop";
import type { Backpack, BattleReplay, GameState, Opponent, RunState, SavedRun } from "./types";

/**
 * Phase transitions of one run: shop → searching → battle → shop … → finished.
 * Every function is pure, so they can be passed straight to `setState`.
 */

export function newGame(seed: number, runId: string): GameState {
  return {
    phase: "shop",
    run: newRun(seed, runId),
    battle: null,
    error: null,
    searchId: null,
    submission: { name: "", status: "editing", error: null, saved: null },
  };
}

/** Applies a shop/backpack action; only allowed while shopping. */
export function updateRun(game: GameState, action: (run: RunState) => RunState): GameState {
  if (game.phase !== "shop") return game;
  const run = action(game.run);
  return run === game.run ? game : { ...game, run };
}

/** Why the player can't look for an opponent right now, or `null` if they can. */
export function fightBlocker(game: GameState): string | null {
  if (game.phase === "searching") return "Searching…";
  if (game.phase !== "shop") return "Only possible in the shop";
  if (itemIdsOf(game.run.backpack).length === 0) return "Buy at least one item first";
  return null;
}

/** Starts the opponent search with the given id; unchanged state if a search isn't possible right now. */
export function startSearch(game: GameState, searchId: string): GameState {
  if (fightBlocker(game) !== null) return game;
  return { ...game, phase: "searching", searchId, error: null };
}

/** `true` while the search with this id is the one that is running. */
export const isCurrentSearch = (game: GameState, searchId: string) =>
  game.phase === "searching" && game.searchId === searchId;

/** Ends the current search with an error: back to a usable shop. Ignored for any other search. */
export function searchFailed(game: GameState, searchId: string, error: string): GameState {
  if (!isCurrentSearch(game, searchId)) return game;
  return { ...game, phase: "shop", searchId: null, error };
}

export const WRONG_ROUND_ERROR = "The arena sent an opponent for another round.";

/**
 * Simulates the battle against `opponent` and starts its replay at the first frame.
 * Only the current search can start a battle, so a late or duplicate response
 * never starts or restarts one. An opponent for another round fails the search.
 */
export function startBattle(game: GameState, searchId: string, opponent: Opponent): GameState {
  if (!isCurrentSearch(game, searchId)) return game;
  if (opponent.round !== game.run.round) return searchFailed(game, searchId, WRONG_ROUND_ERROR);
  return { ...game, phase: "battle", searchId: null, battle: createReplay(game.run.backpack, opponent) };
}

/** Simulates the battle of this backpack against the opponent; the replay starts at the first frame. Also rebuilds a saved battle (B6). */
export function createReplay(backpack: Backpack, opponent: Opponent): BattleReplay {
  const player = buildPlayerFighter(backpack);
  const enemy = buildOpponentFighter(opponent);
  return { opponent, player, enemy, result: simulateBattle(player, enemy), frame: 0 };
}

export const isReplayDone = (battle: BattleReplay) => battle.frame >= battle.result.frames.length - 1;

/** Shows the given frame; reaching the last frame applies the battle result to the run (exactly once). */
export function showFrame(game: GameState, frame: number): GameState {
  const { battle } = game;
  if (game.phase !== "battle" || !battle || isReplayDone(battle)) return game;
  const last = battle.result.frames.length - 1;
  const next = { ...battle, frame: Math.min(Math.max(frame, battle.frame), last) };
  if (!isReplayDone(next)) return { ...game, battle: next };
  return { ...game, battle: next, run: applyBattleResult(game.run, battle.result.winner) };
}

export const advanceReplay = (game: GameState) => showFrame(game, (game.battle?.frame ?? 0) + 1);
export const skipReplay = (game: GameState) => showFrame(game, Infinity);

/** Leaves a finished replay: back to the shop, or to the end screen if the run is over. */
export function leaveBattle(game: GameState): GameState {
  if (game.phase !== "battle" || !game.battle || !isReplayDone(game.battle)) return game;
  return { ...game, phase: runOutcome(game.run) ? "finished" : "shop", battle: null };
}

/** Why the finished run can't be sent to the hall of fame right now, or `null` if it can. */
export function submitBlocker(game: GameState): string | null {
  if (game.phase !== "finished") return "Finish the run first";
  if (game.submission.status === "sending") return "Saving…";
  if (game.submission.status === "saved") return "Already in the hall of fame";
  return nameBlocker(game.submission.name);
}

/** Changes the typed name; ignored while sending and once the run is saved. */
export function editName(game: GameState, name: string): GameState {
  if (game.phase !== "finished" || game.submission.status !== "editing") return game;
  return { ...game, submission: { ...game.submission, name } };
}

/** Starts sending the finished run; unchanged state if `submitBlocker` forbids it. */
export function startSubmit(game: GameState): GameState {
  if (submitBlocker(game) !== null) return game;
  return { ...game, submission: { ...game.submission, status: "sending", error: null } };
}

/** `true` while the run with this id is being sent. */
const isCurrentSubmission = (game: GameState, runId: string) =>
  game.phase === "finished" && game.submission.status === "sending" && game.run.runId === runId;

/** Ends a failed attempt: back to editing with the message and the typed name. Ignored for any other run. */
export function submitFailed(game: GameState, runId: string, error: string): GameState {
  if (!isCurrentSubmission(game, runId)) return game;
  return { ...game, submission: { ...game.submission, status: "editing", error } };
}

/**
 * Stores the server's answer. Only the run that is being sent can be saved,
 * so a duplicate answer or one for an abandoned run changes nothing.
 */
export function submitSucceeded(game: GameState, runId: string, saved: SavedRun): GameState {
  if (!isCurrentSubmission(game, runId)) return game;
  return { ...game, submission: { ...game.submission, status: "saved", error: null, saved } };
}

/** URL paths of the app's screens. The hall of fame belongs to no phase and is always reachable. */
export const ROUTES = { start: "/", shop: "/shop", battle: "/battle", result: "/result", hallOfFame: "/hall-of-fame" } as const;
export type GameRoute = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * The screen that matches the game's phase. Shop, battle and result pages
 * redirect here when they don't match, so the URL always follows the phase.
 */
export function routeForGame(game: GameState | null): GameRoute {
  if (!game) return ROUTES.start;
  switch (game.phase) {
    case "shop":
    case "searching":
      return ROUTES.shop;
    case "battle":
      return ROUTES.battle;
    case "finished":
      return ROUTES.result;
  }
}
