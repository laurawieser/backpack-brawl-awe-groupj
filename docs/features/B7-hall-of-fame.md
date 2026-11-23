# B7 · Hall of fame

| Owner | Reviewer | Issue | PR | Status |
|---|---|---|---|---|
| Martin | Laura | #8 | #14 | in review |

## In short

At the end of a run the player enters a name, and the finished run is sent to the local API. The API validates and stores it (in memory) and lists the best runs in a defined order. The hall of fame has its own page with loading, empty and error states; a failed submission can be retried without retyping and is never sent twice.

## Where it lives

| File | Role |
|---|---|
| `server/hallOfFame.js` | `validateRun` checks a submitted run: name rule, one complete run in `results`, and every number and the outcome must follow from `results`. `compareRuns` and `createHallOfFame` rank the runs and store each run id once, in memory. |
| `server/index.js` | `POST /api/runs` and `GET /api/hall-of-fame` with the same simulated latency and failure as `/api/opponents` (`latencyOf`, `failureForced`). Malformed JSON gets an `{ error }` answer. |
| `server/hallOfFame.test.js` | The copied rule values and the name rule equal the client's; possible, impossible and implausible runs; ranking, top 10, a run id stored once. |
| `src/types.ts` | `RunState.runId` and `RunState.results`, `GameState.submission`, and the API types `RunSubmission`, `HallOfFameEntry` and `SavedRun`. `RunOutcome` moved here from `run.ts`. |
| `src/run.ts` | `newRun` takes the run id. `applyBattleResult` adds every battle to `results`. |
| `src/hallOfFame.ts` | Name rule (`nameBlocker`, `NAME_RULE`), ranking text (`RANKING_RULE`), and what is sent for a finished run (`runSubmission`). |
| `src/game.ts` | `submitBlocker`, `editName`, `startSubmit`, `submitFailed`, `submitSucceeded`. Answers only count for the run that is being sent. `ROUTES.hallOfFame`. |
| `src/api.ts` | `submitRun` and `fetchHallOfFame` with a timeout and checked answers (`parseEntry`, `parseHallOfFame`, `parseSavedRun`). `request()` now takes the error messages and an optional `init`, so both features share it. |
| `src/state/GameProvider.tsx` | Gives every new run a `crypto.randomUUID()`. |
| `src/pages/ResultPage.tsx` | Sends the finished run and applies the answer to the game state. |
| `src/components/HallOfFameForm.tsx` | Name field with the rule or the blocker reason, save button, error with retry, and rank with a link once saved. |
| `src/pages/HallOfFamePage.tsx` | The hall of fame page with loading, error (with "Try again") and empty states. |
| `src/components/HallOfFameList.tsx` | The ranked table; marks the player's own run. |
| `src/App.tsx`, `src/pages/Layout.tsx` | Route `/hall-of-fame` without `RequireRoute`, and a link in the header. |
| `src/run.test.ts`, `src/game.test.ts`, `src/hallOfFame.test.ts`, `src/api.test.ts` | Recorded results, submission transitions, name rule, payload, and the API client's checks and failures. |

## Chosen values

| Setting | Value | Why |
|---|---|---|
| Name | After NFC normalization and trimming: 1–16 characters (`NAME_MAX_LENGTH`), only letters and digits of any script, spaces, `-` and `_` | A clean, readable list that is easy to test. NFC makes a decomposed `é` one letter. |
| Listed runs | Top 10 (`TOP_ENTRIES`) | Short page, small answers. |
| Ranking | Wins ↓, then lives left ↓; on a tie, the earlier run first | A place that was reached is kept. Fewer rounds follow from more lives left. |
| Run id | `crypto.randomUUID()` per run, in `RunState.runId` | Unique across runs and tabs. Lives in the run, so B6 saves it along. |
| Run id already stored | 200 with the stored entry (201 for a new run) | A retry after a lost answer is safe and never adds a run twice. |
| Request timeout | 10 s (`HALL_OF_FAME_TIMEOUT_MS`) | Above the API's maximum latency of 5 s, like the opponent search. |
| Simulated latency and failure | Same `latency`, `fail`, `API_LATENCY` and `API_FAIL` as `/api/opponents` | Loading and error states can be tried out, and the QUALITY.md check "retry a failed hall of fame submission" works with `API_FAIL=true`. |
| Rule values on the server | Copies of `WINS_TO_VICTORY` (5), `START_LIVES` (3) and `NAME_MAX_LENGTH` (16) in `server/hallOfFame.js` | The server is plain JavaScript and can't import the TypeScript modules. `server/hallOfFame.test.js` fails if a copy differs. |

## Decision log

### 2026-11-22 · Separate endpoints for submitting and listing
- **Chose:** `POST /api/runs` to submit a finished run, `GET /api/hall-of-fame` for the top 10; both with the same `latency`, `fail` and `API_FAIL` simulation as `/api/opponents`
- **Instead of:** `GET` and `POST` on one `/api/hall-of-fame` URL
- **Because:** submitting a run and reading the ranking are different actions; the simulation lets us show loading and error states and run the QUALITY.md check "retry a failed hall of fame submission"
- **Price:** two names for the same data
- **Evidence:** PR #14

### 2026-11-22 · Submission state lives in GameState
- **Chose:** `GameState.submission` (name, status, error, saved) with `submitBlocker` and pure transitions in `game.ts`, like the B5 search
- **Instead of:** local React state on the result page
- **Because:** once saved, the client blocks every further submission, also after visiting the hall of fame page; the typed name survives a failed attempt
- **Price:** another field B6 has to save, plus a policy for a reload while sending
- **Evidence:** PR #[n]

### 2026-11-22 · Server checks plausibility, doesn't replay runs
- **Chose:** the client sends the summary and the round results; the server accepts every run that is possible under the rules (one complete run, every number and the outcome follow from the results) and rejects the rest with a clear error
- **Instead of:** replaying a seed and action log on the server, or a server-issued seed per run
- **Because:** meets "reject invalid or implausible data" without sharing TypeScript with the server, changing B6's save format or making the run start depend on the unreliable API
- **Price:** a made-up but possible run (e.g. a perfect 5–0 via curl) is accepted; rule values are copied to the server, `server/hallOfFame.test.js` keeps them equal
- **Evidence:** PR #14

## Tested by

| What | How | ✓ |
|---|---|---|
| Every battle result is recorded in order, and a finished run has as many rounds as results. | `npm test -- src/run.test.ts` | |
| Valid and invalid names, a decomposed `é`, letters outside the BMP. | `npm test -- src/hallOfFame.test.ts` | |
| A run can only be sent once it is over and with a valid name, never twice at the same time, and never again after it was saved. | `npm test -- src/game.test.ts` | |
| A failed attempt keeps the name and shows the error; a retry clears it. | `npm test -- src/game.test.ts` | |
| A duplicate or late answer, or one for an abandoned run, changes nothing. | `npm test -- src/game.test.ts` | |
| The server accepts possible runs and rejects impossible or implausible ones with a clear error. | `npm test -- server/hallOfFame.test.js` | |
| The server ranks by wins, then lives, earlier run first; lists 10; stores a run id once. | `npm test -- server/hallOfFame.test.js` | |
| The server's copies of the rule values equal the client's. | `npm test -- server/hallOfFame.test.js`. Changing `WINS_TO_VICTORY` to 6 in `server/hallOfFame.js` turns the tests red. | |
| The client checks answers and explains server errors, network failures and timeouts. | `npm test -- src/api.test.ts` | |
| An impossible run sent with `curl` is rejected. | `curl -X POST -H "Content-Type: application/json" -d '{"runId":"1b9c6a4e-6f1e-4c55-9a39-2f0f5f3c1d2a","name":"Cheater","outcome":"victory","wins":6,"lives":3,"rounds":6,"results":["win","win","win","win","win","win"]}' localhost:4200/api/runs` → 400 `results go on after the run was over` | |
| The same run sent twice is stored once. | `curl` the same valid body twice → 201, then 200 with the same entry. `GET /api/hall-of-fame` lists it once. | |
| Saving a finished run shows "Saving…", then the rank; the link opens the list with the run marked. | Browser. Finish a run, enter a name, click "Save run". | |
| A failed submission shows the error, keeps the name and can be retried without retyping. | Browser. Run `npx vite` and `API_FAIL=true npm run server` separately, click "Save run", restart the server without `API_FAIL`, click "Save run" again. | |
| A double click on "Save run" sends one request. | Browser. Double-click and check the Network tab. | |
| The hall of fame page shows loading, empty and error states, and "Try again" works. | Browser. Open `/hall-of-fame` on a fresh server (empty), and with `API_FAIL=true` (error). | |
| After saving, the result page keeps the saved state when coming back from the hall of fame. | Browser. Save, open the hall of fame, go back to the result page. | |