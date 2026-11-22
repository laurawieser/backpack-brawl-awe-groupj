# Backpack Brawl API

The local API is a small Express server in `server/index.js`. It listens on port 4200 (override with the `PORT` environment variable). During Vite development, `/api` is proxied to it, so the frontend uses relative URLs such as `/api/opponents?round=1`. All responses are JSON. Opponents are stateless: restarting the server changes nothing about them. The hall of fame is kept in memory only, so a restart empties it.

## `GET /api/health`

Always answers immediately with status 200:

```json
{ "ok": true, "service": "backpack-brawl" }
```

## `GET /api/opponents`

Returns the opponent for one round of a run. The opponent table lives in `server/opponents.js`.

### Query parameters

| Parameter | Required | Meaning |
|---|---|---|
| `round` | yes | The 1-based round number. Must be a positive whole number written in digits (`1`, `2`, …). |
| `latency` | no | Response delay in milliseconds, clamped to 0–5000. Defaults to 1200. A value that is not a number falls back to the default. |
| `fail` | no | `fail=true` forces a 503 response (see below). |

### Success — 200

```json
{
  "id": "mossback-hermit",
  "name": "Mossback Hermit",
  "icon": "🐢",
  "hp": 25,
  "items": ["chipped-dagger", "pot-lid"],
  "round": 1
}
```

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable identifier of the opponent |
| `name` | string | Display name |
| `icon` | string | Emoji shown in the battle view |
| `hp` | number | Maximum (and starting) HP |
| `items` | string[] | Item ids from the catalog in `src/items.ts`; the same id may appear several times |
| `round` | number | The round this opponent was requested for (echoes `round`) |

The response matches the `Opponent` type in `src/types.ts`.

The answer is deterministic: the same `round` always returns the same opponent. There is one hand-built opponent per round for rounds 1–7. Every round past the table returns the last opponent with +6 HP per additional round. The table never needs more than 7 rounds (5 wins + 3 lives − 1), and an opponent never carries more than 6 items, the size of the player's 2×3 backpack.

### Errors

Every error response has the shape:

```json
{ "error": "human-readable explanation" }
```

| Status | When | `error` |
|---|---|---|
| 400 | `round` is missing, not a whole number, or less than 1 | `round must be a positive whole number` |
| 503 | `fail=true`, or the server was started with `API_FAIL=true` | `The arena gates are shut. No challenger answered the call.` |

An invalid `round` is reported as 400 even when failure is forced. All responses from this endpoint, errors included, arrive after the configured delay.

## `POST /api/runs`

Submits a finished run to the hall of fame. The server can't replay a run (it doesn't know the player's shop and backpack), so it accepts every run that is possible under the game's rules and rejects everything else. The checks live in `validateRun` in `server/hallOfFame.js`.

### Query parameters

| Parameter | Required | Meaning |
|---|---|---|
| `latency` | no | Same as for `GET /api/opponents`. |
| `fail` | no | `fail=true` forces a 503 response (see below). |

### Body

JSON with `Content-Type: application/json`. It matches the `RunSubmission` type in `src/types.ts`.

```json
{
  "runId": "0b9c6a4e-6f1e-4c55-9a39-2f0f5f3c1d2a",
  "name": "Martin",
  "outcome": "victory",
  "wins": 5,
  "lives": 2,
  "rounds": 6,
  "results": ["win", "loss", "win", "win", "win", "win"]
}
```

| Field | Type | Rule |
|---|---|---|
| `runId` | string | A lowercase UUID. The client creates one per run with `crypto.randomUUID()`. |
| `name` | string | After Unicode normalization (NFC) and trimming: 1–16 characters, only letters and digits of any script, spaces, `-` and `_`. |
| `results` | string[] | Every battle of the run in order, each `"win"` or `"loss"`. The list must end exactly with the 5th win or the 3rd loss, and nothing may follow. |
| `wins` | number | The number of `"win"` results. |
| `lives` | number | 3 minus the number of `"loss"` results. |
| `rounds` | number | The number of results. |
| `outcome` | string | `"victory"` with 5 wins, otherwise `"defeat"`. |

No other fields are allowed. The values 5 (wins to victory), 3 (starting lives) and 16 (name length) are copies of the client's constants in `src/run.ts` and `src/hallOfFame.ts`. `server/hallOfFame.test.js` fails if they differ.

### Success — 201 or 200

```json
{
  "entry": {
    "id": "0b9c6a4e-6f1e-4c55-9a39-2f0f5f3c1d2a",
    "name": "Martin",
    "outcome": "victory",
    "wins": 5,
    "lives": 2,
    "rounds": 6
  },
  "rank": 1
}
```

| Field | Type | Meaning |
|---|---|---|
| `entry` | object | The stored run, with the same fields as in `GET /api/hall-of-fame`. |
| `rank` | number | Its current place in the whole ranking (1 = best). It may be below the 10 runs that `GET /api/hall-of-fame` lists. |

The response matches the `SavedRun` type in `src/types.ts`.

| Status | When |
|---|---|
| 201 | The run was stored. |
| 200 | A run with this `runId` is already stored. The answer is the stored entry with its current rank; nothing changes, even if the new body differs. |

Because of the 200 case, sending the same run again is safe. A retry after a lost answer never adds the run twice.

### Errors

| Status | When | `error` (examples) |
|---|---|---|
| 400 | The body is not valid JSON | `the body must be valid JSON` |
| 400 | The body is not a JSON object, e.g. without `Content-Type: application/json` | `the body must be a JSON object` |
| 400 | The body has a field that isn't listed above | `unknown field: gold` |
| 400 | `runId` is not a lowercase UUID | `runId must be a lowercase UUID` |
| 400 | The name breaks the rule | `name must not be empty`, `name must be at most 16 characters`, `name may only contain letters, digits, spaces, - and _` |
| 400 | `results` is not one complete run | `results go on after the run was over`, `results describe a run that isn't over yet` |
| 400 | A number or the outcome doesn't follow from `results` | `wins must be 5, the number of "win" results`, `outcome must be "defeat" for these results` |
| 413 | The body is larger than 100 kB | `the body is too large` |
| 503 | `fail=true`, or the server was started with `API_FAIL=true` | `The hall of fame is closed. Your run was not saved.` |

The checks run in the order of this table, and only the first problem is reported. An invalid run is reported as 400 even when failure is forced, and a forced failure stores nothing. A body that isn't valid JSON or is too large is rejected at once; every other answer arrives after the configured delay.

## `GET /api/hall-of-fame`

Returns the 10 best runs, best first.

### Query parameters

| Parameter | Required | Meaning |
|---|---|---|
| `latency` | no | Same as for `GET /api/opponents`. |
| `fail` | no | `fail=true` forces a 503 response (see below). |

### Success — 200

```json
[
  { "id": "0b9c6a4e-6f1e-4c55-9a39-2f0f5f3c1d2a", "name": "Martin", "outcome": "victory", "wins": 5, "lives": 2, "rounds": 6 },
  { "id": "5b9c6a4e-6f1e-4c55-9a39-2f0f5f3c1d2a", "name": "Laura", "outcome": "defeat", "wins": 2, "lives": 0, "rounds": 5 }
]
```

| Field | Type | Meaning |
|---|---|---|
| `id` | string | The run's `runId` |
| `name` | string | The name as stored: normalized and trimmed |
| `outcome` | string | `"victory"` or `"defeat"` |
| `wins` | number | Wins at the end of the run |
| `lives` | number | Lives left at the end of the run |
| `rounds` | number | Battles fought |

Each entry matches the `HallOfFameEntry` type in `src/types.ts`. Before the first run is stored, the list is empty (`[]`).

**Ranking:** more wins first, then more lives left. With the same number of wins, more lives left also means fewer rounds. Equal runs keep the order in which they were submitted, so the earlier run ranks higher. The order is defined by `compareRuns` in `server/hallOfFame.js`.

### Errors

| Status | When | `error` |
|---|---|---|
| 503 | `fail=true`, or the server was started with `API_FAIL=true` | `The hall of fame is closed. Try again in a moment.` |

All responses from this endpoint, errors included, arrive after the configured delay.

## Environment variables

| Variable | Effect |
|---|---|
| `PORT` | Port to listen on (default 4200). The Vite proxy expects 4200. |
| `API_LATENCY` | Default delay in milliseconds when a request has no `latency` parameter. Applies to every endpoint except `/api/health`. |
| `API_FAIL` | `true` makes every opponent and hall of fame request fail with 503. |

Example: `API_FAIL=true pnpm server`.

## Client

`fetchOpponent(round)` in `src/api.ts` performs the request. It resolves with the `Opponent` on success and throws an `Error` carrying the server's `error` text (or a generic message with the status code) for any non-2xx response. When the API is not running, the Vite proxy answers with an error status of its own, which is reported the same way; a network failure rejects as well.

`submitRun(submission)` and `fetchHallOfFame(signal)` in `src/api.ts` work the same way for the hall of fame. Both give up after 10 s (`HALL_OF_FAME_TIMEOUT_MS`) and check the response before using it (`parseSavedRun`, `parseHallOfFame`). `submitRun` also rejects an answer about another run.
