import { CATALOG } from "./items";
import { BACKPACK_SIZE } from "./shop";
import type { ApiError, Opponent } from "./types";

/** How long the client waits for an opponent. Above the API's maximum latency of 5 s. */
export const SEARCH_TIMEOUT_MS = 10_000;

/** Messages for failed searches that don't come from the server. */
export const SEARCH_ERRORS = {
  timeout: `No challenger answered within ${SEARCH_TIMEOUT_MS / 1000} s.`,
  cancelled: "The search was cancelled.",
  unreachable: "The arena can't be reached. Is the API running?",
  invalid: "The arena sent an opponent that can't fight.",
};

const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const isKnownItemId = (value: unknown): value is string => typeof value === "string" && CATALOG.some((item) => item.id === value);

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

/** `true` if the response body is an `ApiError` with a readable message. */
function isApiError(body: unknown): body is ApiError {
  return typeof body === "object" && body !== null && "error" in body && isText(body.error);
}

/** Sends the request and reads the JSON body; throws a player-facing message if no answer arrives. */
async function request(url: string, signal: AbortSignal | undefined, timeoutMs: number) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(url, { signal: combined });
    // A body that isn't JSON is treated as empty, unless the request was aborted while reading it.
    const body: unknown = await response.json().catch((error: unknown) => {
      if (combined.aborted) throw error;
      return null;
    });
    return { response, body };
  } catch {
    if (signal?.aborted) throw new Error(SEARCH_ERRORS.cancelled);
    if (timeout.aborted) throw new Error(SEARCH_ERRORS.timeout);
    throw new Error(SEARCH_ERRORS.unreachable);
  }
}

/**
 * Asks the API for this round's opponent. Gives up after `timeoutMs` or when `signal` aborts.
 * Throws an `Error` with a player-facing message for every failure, including an invalid opponent.
 */
export async function fetchOpponent(round: number, signal?: AbortSignal, timeoutMs = SEARCH_TIMEOUT_MS): Promise<Opponent> {
  const { response, body } = await request(`/api/opponents?round=${encodeURIComponent(round)}`, signal, timeoutMs);
  if (!response.ok) throw new Error(isApiError(body) ? body.error : `${SEARCH_ERRORS.unreachable} (status ${response.status})`);
  const opponent = parseOpponent(body, round);
  if (!opponent) throw new Error(SEARCH_ERRORS.invalid);
  return opponent;
}
