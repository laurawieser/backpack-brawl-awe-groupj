# B5 · Resilient matchmaking

| Owner | Reviewer | Issue | PR | Status |
|---|---|---|---|---|
| Martin | Laura | #6 | #12 | in review |

## In short

Looking for an opponent is reliable. A running search is visible and can't be started twice. A failed API returns the player to a usable shop with a clear message and a retry. A battle only starts for the current round and search; slow, duplicate or late responses never restart a battle or apply a result twice.

Fixes starter bugs #2, #3 and #4.

## Where it lives

| File | Role |
|---|---|
| `src/types.ts` | `GameState.searchId` holds the id of the running search. `ApiError` types the API's error body. |
| `src/game.ts` | `fightBlocker` blocks a second search. `startSearch` stores the search id. `startBattle` and `searchFailed` only act for the current search, and `searchFailed` returns to the shop. |
| `src/api.ts` | `fetchOpponent` stops after a timeout or when cancelled, and turns every failure into a player-facing message. `parseOpponent` validates the response. |
| `src/pages/ShopPage.tsx` | Creates a new search id per click and cancels a running request when the shop page closes. |
| `src/components/FightBar.tsx` | Shows the running search and the error. The button label and disabled state come from `fightBlocker`. |
| `src/game.test.ts` | Double clicks, failure and retry, duplicate, late and stale responses, and the wrong round. |
| `src/api.test.ts` | Response validation, server error text, network failure, timeout and cancelling. |

## Chosen values

| Setting | Value | Why |
|---|---|---|
| Search timeout | 10 s (`SEARCH_TIMEOUT_MS`) | Above the API's maximum latency of 5 s, so only a hanging or missing server hits it. |
| Search id | `crypto.randomUUID()` per click | Unique across clicks and runs, so a response from an abandoned run never matches. |
| Max opponent items | 6 (`BACKPACK_SIZE`) | Same limit as the player's backpack, as documented in `docs/API.md`. |

## Decision log

### 2026-11-22 · 10 s timeout for the opponent search
- **Chose:** `fetchOpponent` stops after 10 s (`SEARCH_TIMEOUT_MS`) or when its caller cancels it
- **Instead of:** relying on fetch errors only
- **Because:** a hanging or missing server would leave the player searching forever; the API's maximum latency is 5 s
- **Price:** a working server slower than 10 s counts as failed
- **Evidence:** PR #12

### 2026-11-22 · A unique id per search
- **Chose:** each click gets an id from `crypto.randomUUID()`, stored in `GameState.searchId`; `startBattle` and `searchFailed` ignore every other id; leaving the shop cancels the request
- **Instead of:** a counter in the game state, or checking only phase and round
- **Because:** it also tells apart two searches of the same round and a search from an abandoned run
- **Price:** a new state field that B6 has to handle; the id comes from the page, not the rules
- **Evidence:** PR #12

### 2026-11-22 · No rules panel text for the search
- **Chose:** the search is explained only in the fight bar
- **Instead of:** a rule line built from the timeout constant
- **Because:** The search does not count as a game mechanic.
- **Price:** the 10 s timeout isn't explained up front
- **Evidence:** PR #12

## Tested by

| What | How | ✓ |
|---|---|---|
| A second search can't start while one is running. | `npm test -- src/game.test.ts` | |
| A failed search returns to a usable shop with the message, and a retry clears it. | `npm test -- src/game.test.ts` | |
| A duplicate or late response never starts or restarts a battle, and the result is applied once. | `npm test -- src/game.test.ts` | |
| A response from an earlier search or an abandoned run is ignored. | `npm test -- src/game.test.ts` | |
| An opponent for another round fails the search. | `npm test -- src/game.test.ts` | |
| Malformed or implausible opponents are rejected. | `npm test -- src/api.test.ts` | |
| Server errors, network failures, timeouts and cancelling give readable messages. | `npm test -- src/api.test.ts` | |
| Every server opponent passes the validation. | Rounds 1–12 from `server/opponents.js` checked against `parseOpponent`'s rules (Claude, one-off script). | |
| With `API_FAIL=true`, the shop stays usable, shows the message and allows a retry. | Browser. Start with `API_FAIL=true npm run dev`, click "Find opponent". | |
| A double click on "Find opponent" sends one request and the replay never restarts. | Browser. Double-click and check the Network tab. | |
| Without the API, the search fails with "The arena can't be reached". | Browser. Run only `npx vite`, click "Find opponent". | |
| Leaving the shop during a search cancels it, and coming back shows the message. | Browser. Click the logo while searching, then go back. | |