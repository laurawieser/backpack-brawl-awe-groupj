/**
 * The hall of fame: checks submitted runs and ranks the stored ones.
 *
 * The server can't replay a run (it doesn't know the player's shop and backpack),
 * so it accepts every run that is possible under the game's rules and rejects the rest.
 * The rule values are copies of the client's; hallOfFame.test.js fails if they drift apart.
 */

/** Copies of `WINS_TO_VICTORY` and `START_LIVES` in src/run.ts. */
export const WINS_TO_VICTORY = 5;
export const START_LIVES = 3;

/** Copy of `NAME_MAX_LENGTH` in src/hallOfFame.ts. */
export const NAME_MAX_LENGTH = 16;
/** Same character rule as `nameBlocker` in src/hallOfFame.ts: letters and digits of any script, spaces, - and _. */
const NAME_CHARACTERS = /^[\p{L}\p{Nd} _-]*$/u;

/** How many runs `GET /api/hall-of-fame` lists. */
export const TOP_ENTRIES = 10;

/** The client creates run ids with `crypto.randomUUID()`. */
const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Every field a submitted run has; anything else is rejected. */
const FIELDS = ["runId", "name", "outcome", "wins", "lives", "rounds", "results"];

/** The name as it is stored: one Unicode form (é is one character), no spaces at either end. */
export const normalizeName = (name) => name.normalize("NFC").trim();

/** What is wrong with this name, or `null` if it is valid. */
export function nameError(name) {
  if (typeof name !== "string") return "name must be text";
  const normalized = normalizeName(name);
  if (normalized === "") return "name must not be empty";
  // Spreading a string splits it into characters, so letters outside the BMP count once.
  if ([...normalized].length > NAME_MAX_LENGTH) return `name must be at most ${NAME_MAX_LENGTH} characters`;
  if (!NAME_CHARACTERS.test(normalized)) return "name may only contain letters, digits, spaces, - and _";
  return null;
}

/**
 * What is wrong with the list of battle results, or `null` if it is a complete run:
 * it ends exactly with the WINS_TO_VICTORY-th win or the START_LIVES-th loss, and nothing comes after that.
 */
function resultsError(results) {
  if (!Array.isArray(results)) return "results must be a list";
  let wins = 0;
  let losses = 0;
  for (const result of results) {
    if (result !== "win" && result !== "loss") return 'results may only contain "win" and "loss"';
    if (wins === WINS_TO_VICTORY || losses === START_LIVES) return "results go on after the run was over";
    if (result === "win") wins += 1;
    else losses += 1;
  }
  if (wins < WINS_TO_VICTORY && losses < START_LIVES) return "results describe a run that isn't over yet";
  return null;
}

/**
 * Checks a submitted run. Returns `{ run }` with the entry to store,
 * or `{ error }` with the first problem found.
 */
export function validateRun(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { error: "the body must be a JSON object" };
  const unknown = Object.keys(body).find((key) => !FIELDS.includes(key));
  if (unknown !== undefined) return { error: `unknown field: ${unknown}` };

  const { runId, name, outcome, wins, lives, rounds, results } = body;
  if (typeof runId !== "string" || !RUN_ID.test(runId)) return { error: "runId must be a lowercase UUID" };
  const nameProblem = nameError(name);
  if (nameProblem) return { error: nameProblem };
  const resultsProblem = resultsError(results);
  if (resultsProblem) return { error: resultsProblem };

  // The results are a complete run now; every other number must follow from them.
  const won = results.filter((result) => result === "win").length;
  const lost = results.length - won;
  if (wins !== won) return { error: `wins must be ${won}, the number of "win" results` };
  if (lives !== START_LIVES - lost) return { error: `lives must be ${START_LIVES - lost}: ${START_LIVES} minus the number of "loss" results` };
  if (rounds !== results.length) return { error: `rounds must be ${results.length}, the number of results` };
  const expected = won === WINS_TO_VICTORY ? "victory" : "defeat";
  if (outcome !== expected) return { error: `outcome must be "${expected}" for these results` };

  return { run: { id: runId, name: normalizeName(name), outcome, wins, lives, rounds } };
}

/**
 * Better runs first: more wins, then more lives left (which also means fewer rounds).
 * Equal runs return 0; `Array.prototype.sort` is stable, so they keep their order and the earlier run stays ahead.
 */
export const compareRuns = (a, b) => b.wins - a.wins || b.lives - a.lives;

/** An empty hall of fame, kept in memory. */
export function createHallOfFame() {
  /** Stored runs by id. A Map remembers the order in which they were added. */
  const runs = new Map();
  const ranked = () => [...runs.values()].sort(compareRuns);

  return {
    /**
     * Stores a valid run unless a run with its id is already stored.
     * Returns the stored entry, its rank (1 = best) and whether it is new.
     */
    add(run) {
      const created = !runs.has(run.id);
      if (created) runs.set(run.id, run);
      const entry = runs.get(run.id);
      return { entry, rank: ranked().indexOf(entry) + 1, created };
    },
    /** The best TOP_ENTRIES runs, best first. */
    top: () => ranked().slice(0, TOP_ENTRIES),
  };
}
