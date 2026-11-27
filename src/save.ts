import { parseOpponent, parseSavedRun } from "./api";
import { createReplay, searchFailed, submitFailed } from "./game";
import { CATALOG, getItem } from "./items";
import { GOLD_PER_ROUND, runOutcome, START_GOLD, START_LIVES, WINS_TO_VICTORY } from "./run";
import { BACKPACK_SIZE, SHOP_SIZE } from "./shop";
import type { BattleReplay, GameState, ItemInstance, Phase, RoundResult, RunState, SaveData, Submission } from "./types";

/**
 * Save and resume (B6): what is kept of a game, how a save is checked before it is used, and what
 * a reload does to a game that was in the middle of something. Reading and writing `localStorage`
 * happens in `state/storage.ts`.
 */

export const SAVE_KEY = "backpack-brawl-save";

/**
 * Version of the save format. Raise it whenever `SaveData` or the battle rules change: battles are
 * simulated again when loading, so an older save is discarded instead of migrated.
 */
export const SAVE_VERSION = 1;

/** What the player is told after a reload. The fight bar and the hall of fame form add "Try again." */
export const RELOAD_MESSAGES = {
  search: "The reload cancelled the search.",
  submit: "The reload interrupted saving. Sending the run again is safe: the hall of fame stores it only once.",
  battle: "Resumed after a reload. The result was fixed when the battle started.",
  discarded: "Your saved run couldn't be loaded, so it was discarded.",
};

/** The part of the game that is saved. The battle is kept as its opponent and the frame shown. */
export function toSave(game: GameState): SaveData {
  const { phase, run, searchId, battle, submission } = game;
  return {
    version: SAVE_VERSION,
    phase,
    run,
    searchId,
    battle: battle && { opponent: battle.opponent, frame: battle.frame },
    submission: { name: submission.name, status: submission.status, saved: submission.saved },
  };
}

/**
 * The game stored in `raw`, or the reason why it can't be used: not JSON, another version, or
 * something the game's rules can't produce. Never throws. `null` means there is no save at all.
 * Doesn't apply the reload policy, so another tab's state can be taken over as it is.
 */
export function readSave(raw: string | null): { game: GameState | null; problem: string | null } {
  if (raw === null) return { game: null, problem: null };
  try {
    return { game: readGame(JSON.parse(raw)), problem: null };
  } catch (error) {
    if (error instanceof BrokenSave) return { game: null, problem: error.message };
    return { game: null, problem: error instanceof SyntaxError ? "the save is not JSON" : "the save can't be read" };
  }
}

/**
 * The reload policy. A search or a hall of fame request doesn't survive a reload, so it ends like a
 * failed one: back to the shop or the form, with a message and a retry. A battle keeps its opponent
 * and its result and continues at the saved frame. Everything else continues unchanged.
 */
export function resumeAfterReload(game: GameState): GameState {
  if (game.phase === "searching" && game.searchId !== null) return searchFailed(game, game.searchId, RELOAD_MESSAGES.search);
  if (game.submission.status === "sending") return submitFailed(game, game.run.runId, RELOAD_MESSAGES.submit);
  if (game.battle) return { ...game, battle: { ...game.battle, resumed: true } };
  return game;
}

/** The game to continue after a reload, and whether a stored save had to be discarded. */
export function loadGame(raw: string | null): { game: GameState | null; discarded: boolean } {
  const { game, problem } = readSave(raw);
  return { game: game && resumeAfterReload(game), discarded: problem !== null };
}

/** Thrown by `check`; `readSave` turns it into the problem it reports. */
class BrokenSave extends Error {}

function check(condition: boolean, problem: string): asserts condition {
  if (!condition) throw new BrokenSave(problem);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isList = (value: unknown): value is unknown[] => Array.isArray(value);
const isWhole = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);
const isItemId = (value: unknown): value is string => typeof value === "string" && CATALOG.some((item) => item.id === value);
const isOffer = (value: unknown): value is string | null => value === null || isItemId(value);
const isResult = (value: unknown): value is RoundResult => value === "win" || value === "loss";
const isPhase = (value: unknown): value is Phase =>
  value === "shop" || value === "searching" || value === "battle" || value === "finished";
const isStatus = (value: unknown): value is Submission["status"] =>
  value === "editing" || value === "sending" || value === "saved";

/** Same format as `crypto.randomUUID()` and the server's check in server/hallOfFame.js. */
const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function readGame(data: unknown): GameState {
  check(isRecord(data), "the save must be an object");
  check(data.version === SAVE_VERSION, `the save has version ${String(data.version)}, not ${SAVE_VERSION}`);
  const { phase, searchId } = data;
  check(isPhase(phase), "unknown phase");
  const run = readRun(data.run);
  // A finished run belongs on the result screen. A battle may have finished the run already (showFrame).
  check(phase === "battle" || (runOutcome(run) !== null) === (phase === "finished"), "the phase doesn't fit the run");
  check(searchId === null || (typeof searchId === "string" && searchId !== ""), "the search id must be text or null");
  check((phase === "searching") === (searchId !== null), "only a running search has a search id");
  if (phase !== "battle") check(data.battle === null, "only the battle phase has a battle");
  const battle = phase === "battle" ? readBattle(data.battle, run) : null;
  return { phase, run, battle, error: null, searchId, submission: readSubmission(data.submission, run, phase) };
}

/** The run, if the game's rules can produce it. */
function readRun(data: unknown): RunState {
  check(isRecord(data), "the run must be an object");
  const { runId, round, gold, lives, wins, results, seed, shop, backpack, nextUid } = data;
  check(typeof runId === "string" && RUN_ID.test(runId), "runId must be a lowercase UUID");
  check(isWhole(round) && round >= 1, "round must be a whole number from 1");
  check(isWhole(gold) && gold >= 0, "gold must be a whole number from 0");
  check(isWhole(seed) && seed >= 0 && seed < 2 ** 32, "seed must be a whole number from 0 to 2^32 - 1");
  check(isWhole(nextUid) && nextUid >= 1, "nextUid must be a whole number from 1");
  check(isList(shop) && shop.length === SHOP_SIZE && shop.every(isOffer), `the shop must have ${SHOP_SIZE} offers from the catalog or sold slots`);
  check(isList(backpack) && backpack.length === BACKPACK_SIZE, `the backpack must have ${BACKPACK_SIZE} slots`);
  const slots = backpack.map((slot) => readSlot(slot, nextUid));
  const uids = slots.flatMap((slot) => (slot ? [slot.uid] : []));
  check(new Set(uids).size === uids.length, "every backpack item needs its own uid");

  // Every battle adds one result, and the run ends with the deciding win or loss (applyBattleResult).
  check(isList(results) && results.every(isResult), 'results may only contain "win" and "loss"');
  let won = 0;
  let lost = 0;
  for (const result of results) {
    check(won < WINS_TO_VICTORY && lost < START_LIVES, "results go on after the run was over");
    if (result === "win") won += 1;
    else lost += 1;
  }
  check(wins === won && lives === START_LIVES - lost, "wins and lives must follow from the results");
  // A new round starts after every battle, except after the one that ends the run (startNextRound).
  const over = won === WINS_TO_VICTORY || lost === START_LIVES;
  check(round === results.length + (over ? 0 : 1), "the round must follow from the results");
  // Buying keeps gold plus item prices the same, selling and rerolling lower it, only a new round adds gold.
  const itemValue = slots.reduce((sum, slot) => sum + (slot ? getItem(slot.itemId).price : 0), 0);
  check(gold + itemValue <= START_GOLD + GOLD_PER_ROUND * (round - 1), "gold and items are worth more than the run has earned");

  return { runId, round, gold, lives: START_LIVES - lost, wins: won, results: [...results], seed, shop: [...shop], backpack: slots, nextUid };
}

/** An empty slot, or an item with a uid `item-N` that `buyItem` could have given out. */
function readSlot(slot: unknown, nextUid: number): ItemInstance | null {
  if (slot === null) return null;
  check(isRecord(slot), "a backpack slot must be empty or hold an item");
  const { uid, itemId } = slot;
  check(isItemId(itemId), "a backpack item must be from the catalog");
  const number = typeof uid === "string" ? Number(/^item-([1-9]\d*)$/.exec(uid)?.[1]) : NaN;
  check(typeof uid === "string" && number < nextUid, "a backpack item needs a uid item-N below nextUid");
  return { uid, itemId };
}

/**
 * The battle that was being replayed, simulated again from the backpack and the saved opponent.
 * Its result is added to the run when the last frame is shown (showFrame), so before that frame the
 * run doesn't contain it yet, and from then on it is the run's last result.
 */
function readBattle(data: unknown, run: RunState): BattleReplay {
  check(isRecord(data), "the battle phase needs a battle");
  const fought = run.results.length;
  const opponent = parseOpponent(data.opponent, fought + 1) ?? parseOpponent(data.opponent, fought);
  check(opponent !== null, "the battle needs a valid opponent for the run's round");
  const replay = createReplay(run.backpack, opponent);
  const last = replay.result.frames.length - 1;
  const { frame } = data;
  check(isWhole(frame) && frame >= 0 && frame <= last, "the frame must be one of the battle's frames");
  const resultInRun = opponent.round === fought;
  check(resultInRun === (frame === last), "the battle's result must be in the run exactly from its last frame on");
  if (resultInRun) {
    check(run.results[fought - 1] === (replay.result.winner === "player" ? "win" : "loss"), "the run's last result must be this battle's");
  } else {
    check(runOutcome(run) === null, "a finished run has no battle left");
  }
  return { ...replay, frame };
}

/** The hall of fame submission. Only a finished run can have a name, be sent or be saved (game.ts). */
function readSubmission(data: unknown, run: RunState, phase: Phase): Submission {
  check(isRecord(data), "the submission must be an object");
  const { name, status, saved } = data;
  check(typeof name === "string" && isStatus(status), "the submission needs a name and a known status");
  check(phase === "finished" || (name === "" && status === "editing" && saved === null), "only a finished run can be sent");
  const savedRun = saved === null ? null : parseSavedRun(saved, run.runId);
  check(saved === null || savedRun !== null, "the saved hall of fame entry is not valid for this run");
  check((status === "saved") === (savedRun !== null), "a saved entry belongs to the status saved");
  return { name, status, error: null, saved: savedRun };
}
