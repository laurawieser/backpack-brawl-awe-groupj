import { runOutcome } from "./run";
import type { RunState, RunSubmission } from "./types";

/**
 * Hall of fame rules on the client: which names are allowed and what is sent for a finished run.
 * The server checks the same name rule again (server/hallOfFame.js); server/hallOfFame.test.js
 * fails if the two drift apart.
 */

/** Longest allowed name, in characters (not UTF-16 units). */
export const NAME_MAX_LENGTH = 16;

/** Letters and digits of any script, spaces, `-` and `_`. */
const NAME_CHARACTERS = /^[\p{L}\p{Nd} _-]*$/u;

export const NAME_RULE = `1–${NAME_MAX_LENGTH} letters, digits, spaces, - or _.`;

/** Must match `compareRuns` in server/hallOfFame.js. */
export const RANKING_RULE = "Ranked by wins, then by lives left. On a tie, the earlier run ranks higher.";

/** The name as it is sent and stored: one Unicode form (é is one character), no spaces at either end. */
export const normalizeName = (name: string) => name.normalize("NFC").trim();

/** Why this name can't be entered, or `null` if it can. */
export function nameBlocker(name: string): string | null {
  const normalized = normalizeName(name);
  if (normalized === "") return "Enter your name";
  // Spreading a string splits it into characters, so letters outside the BMP count once.
  if ([...normalized].length > NAME_MAX_LENGTH) return `Use at most ${NAME_MAX_LENGTH} characters`;
  if (!NAME_CHARACTERS.test(normalized)) return "Use only letters, digits, spaces, - and _";
  return null;
}

/** What `POST /api/runs` gets for a finished run, or `null` while the run is still going. */
export function runSubmission(run: RunState, name: string): RunSubmission | null {
  const outcome = runOutcome(run);
  if (!outcome) return null;
  return {
    runId: run.runId,
    name: normalizeName(name),
    outcome,
    wins: run.wins,
    lives: run.lives,
    rounds: run.round,
    results: [...run.results],
  };
}
