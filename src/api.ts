import { CATALOG } from "./items";
import { BACKPACK_SIZE } from "./shop";
import type { ApiError, HallOfFameEntry, Opponent, RunOutcome, RunSubmission, SavedRun } from "./types";

/** How long the client waits for an opponent. Above the API's maximum latency of 5 s. */
export const SEARCH_TIMEOUT_MS = 10_000;

/** Messages for failed searches that don't come from the server. */
export const SEARCH_ERRORS = {
  timeout: `No challenger answered within ${SEARCH_TIMEOUT_MS / 1000} s.`,
  cancelled: "The search was cancelled.",
  unreachable: "The arena can't be reached. Is the API running?",
  invalid: "The arena sent an opponent that can't fight.",
};

/** How long the client waits for the hall of fame. Above the API's maximum latency of 5 s, like the search. */
export const HALL_OF_FAME_TIMEOUT_MS = 10_000;

/** Messages for failed hall of fame requests that don't come from the server. */
export const HALL_OF_FAME_ERRORS = {
  timeout: `The hall of fame didn't answer within ${HALL_OF_FAME_TIMEOUT_MS / 1000} s.`,
  cancelled: "Loading the hall of fame was cancelled.",
  unreachable: "The hall of fame can't be reached. Is the API running?",
  invalid: "The hall of fame sent an answer that can't be read.",
};

const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const isKnownItemId = (value: unknown): value is string => typeof value === "string" && CATALOG.some((item) => item.id === value);
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isOutcome = (value: unknown): value is RunOutcome => value === "victory" || value === "defeat";

/** The response as an `Opponent` for `round`, or `null` if it is malformed or implausible. */
export function parseOpponent(data: unknown, round: number): Opponent | null {
  if (typeof data !== "object" || data === null) return null;
  const { id, name, icon, hp, items, round: opponentRound } = data as Record<string, unknown>;
  if (!isText(id) || !isText(name) || !isText(icon)) return null;
  if (typeof hp !== "number" || !Number.isInteger(hp) || hp <= 0) return null;
  // Array.isArray types the list as any[]; treating it as unknown[] keeps every element checked.
  const list: unknown[] | null = Array.isArray(items) ? items : null;
  if (!list || list.length > BACKPACK_SIZE || !list.every(isKnownItemId)) return null;
  if (opponentRound !== round) return null;
  return { id, name, icon, hp, round, items: [...list] };
}

/** The data as a `HallOfFameEntry`, or `null` if it is malformed. */
export function parseEntry(data: unknown): HallOfFameEntry | null {
  if (typeof data !== "object" || data === null) return null;
  const { id, name, outcome, wins, lives, rounds } = data as Record<string, unknown>;
  if (!isText(id) || !isText(name) || !isOutcome(outcome)) return null;
  if (!isCount(wins) || !isCount(lives) || !isCount(rounds)) return null;
  return { id, name, outcome, wins, lives, rounds };
}

/** The response of `GET /api/hall-of-fame`, or `null` if it or any of its entries is malformed. */
export function parseHallOfFame(data: unknown): HallOfFameEntry[] | null {
  if (!Array.isArray(data)) return null;
  // Array.isArray types the list as any[]; treating it as unknown[] keeps every element checked.
  const list: unknown[] = data;
  const entries = list.map(parseEntry);
  return entries.every((entry) => entry !== null) ? entries : null;
}

/** The response of `POST /api/runs` for the run `runId`, or `null` if it is malformed or about another run. */
export function parseSavedRun(data: unknown, runId: string): SavedRun | null {
  if (typeof data !== "object" || data === null) return null;
  const { entry, rank } = data as Record<string, unknown>;
  const parsed = parseEntry(entry);
  if (!parsed || parsed.id !== runId) return null;
  if (!isCount(rank) || rank < 1) return null;
  return { entry: parsed, rank };
}

/** `true` if the response body is an `ApiError` with a readable message. */
function isApiError(body: unknown): body is ApiError {
  return typeof body === "object" && body !== null && "error" in body && isText(body.error);
}

/** Player-facing messages for a request that gets no answer. */
type RequestErrors = Pick<typeof SEARCH_ERRORS, "timeout" | "cancelled" | "unreachable">;

interface RequestOptions {
  errors: RequestErrors;
  timeoutMs: number;
  signal?: AbortSignal;
  /** Method, headers and body, e.g. for a POST. */
  init?: RequestInit;
}

/** Sends the request and reads the JSON body; throws a player-facing message if no answer arrives. */
async function request(url: string, { errors, timeoutMs, signal, init }: RequestOptions) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(url, { ...init, signal: combined });
    // A body that isn't JSON is treated as empty, unless the request was aborted while reading it.
    const body: unknown = await response.json().catch((error: unknown) => {
      if (combined.aborted) throw error;
      return null;
    });
    return { response, body };
  } catch {
    if (signal?.aborted) throw new Error(errors.cancelled);
    if (timeout.aborted) throw new Error(errors.timeout);
    throw new Error(errors.unreachable);
  }
}

/** The server's error text, or a generic message with the status code. */
const failureMessage = (body: unknown, status: number, errors: RequestErrors) =>
  isApiError(body) ? body.error : `${errors.unreachable} (status ${status})`;

/**
 * Asks the API for this round's opponent. Gives up after `timeoutMs` or when `signal` aborts.
 * Throws an `Error` with a player-facing message for every failure, including an invalid opponent.
 */
export async function fetchOpponent(round: number, signal?: AbortSignal, timeoutMs = SEARCH_TIMEOUT_MS): Promise<Opponent> {
  const url = `/api/opponents?round=${encodeURIComponent(round)}`;
  const { response, body } = await request(url, { errors: SEARCH_ERRORS, timeoutMs, signal });
  if (!response.ok) throw new Error(failureMessage(body, response.status, SEARCH_ERRORS));
  const opponent = parseOpponent(body, round);
  if (!opponent) throw new Error(SEARCH_ERRORS.invalid);
  return opponent;
}

/**
 * Loads the best runs, best first. Gives up after `timeoutMs` or when `signal` aborts.
 * Throws an `Error` with a player-facing message for every failure, including an unreadable list.
 */
export async function fetchHallOfFame(signal?: AbortSignal, timeoutMs = HALL_OF_FAME_TIMEOUT_MS): Promise<HallOfFameEntry[]> {
  const { response, body } = await request("/api/hall-of-fame", { errors: HALL_OF_FAME_ERRORS, timeoutMs, signal });
  if (!response.ok) throw new Error(failureMessage(body, response.status, HALL_OF_FAME_ERRORS));
  const entries = parseHallOfFame(body);
  if (!entries) throw new Error(HALL_OF_FAME_ERRORS.invalid);
  return entries;
}

/**
 * Sends a finished run to the hall of fame and returns the stored entry with its rank.
 * Sending the same run again is safe: the server answers with the entry it already has.
 * Throws an `Error` with a player-facing message for every failure, including an unreadable answer.
 */
export async function submitRun(submission: RunSubmission, timeoutMs = HALL_OF_FAME_TIMEOUT_MS): Promise<SavedRun> {
  const init = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(submission) };
  const { response, body } = await request("/api/runs", { errors: HALL_OF_FAME_ERRORS, timeoutMs, init });
  if (!response.ok) throw new Error(failureMessage(body, response.status, HALL_OF_FAME_ERRORS));
  const saved = parseSavedRun(body, submission.runId);
  if (!saved) throw new Error(HALL_OF_FAME_ERRORS.invalid);
  return saved;
}
