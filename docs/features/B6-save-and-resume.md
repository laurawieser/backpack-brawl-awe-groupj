# B6 · Save and resume

| Owner | Reviewer | Issue | PR | Status |
|---|---|---|---|---|
| Martin | Martin & Laura | #7 | #17 | merged |

## In short

After a browser refresh, the run continues where it was, on the matching screen. Malformed, incompatible or impossible saves never break the game; it falls back to a playable state. Refreshing is never a way to get a free reroll, a different opponent, a second result, or to avoid a loss.

The game is saved in `localStorage` after every change. A search or a hall of fame request doesn't survive a reload, so it ends like a failed one, with a message and a retry. A battle keeps its opponent and result and continues where it was. Open tabs share one run.

## Where it lives

| File | Role |
|---|---|
| `src/save.ts` | The save format (`toSave`, `SAVE_VERSION`), the checks that reject broken or impossible saves (`readSave`), the reload policy (`resumeAfterReload`) and its messages (`RELOAD_MESSAGES`). Pure functions, no browser needed. |
| `src/save.test.ts` | Every screen survives a reload, a reload at every frame of a lost battle, another tab's save, every state of 100 randomly played runs, 51 broken saves, and 5,000 randomly damaged ones. |
| `src/state/storage.ts` | Reads, writes and removes the save; a missing, blocked or full storage only means the game isn't saved. |
| `src/state/storage.test.ts` | Working, missing and failing storage. |
| `src/state/GameProvider.tsx` | Loads the save on start, saves every change, and takes over a change from another tab (`storage` event). |
| `src/state/GameContext.ts` | `discardedSave` for the notice on the start page. |
| `src/types.ts` | `SaveData`, and `BattleReplay.resumed` for a battle restored after a reload. |
| `src/game.ts` | `createReplay`, used by `startBattle` and to rebuild a saved battle. |
| `src/pages/StartPage.tsx` | "Continue run" or "See your result", "New run" with a hint, and the notice about a discarded save. |
| `src/components/BattleView.tsx` | Says that a resumed battle's result was fixed when it started. |

## Chosen values

| Setting | Value | Why |
|---|---|---|
| Storage | `localStorage`, key `backpack-brawl-save` | Survives closing the tab or the browser. |
| When it is saved | After every change of the game state, including every replay frame | A reload always continues from the latest state. |
| What is saved | Phase, the whole run, search id, the battle's opponent and frame, the submission's name, status and saved entry (`SaveData`) | The run includes the shop offers and the seed, so a reload can't reroll. Error messages are not kept. |
| Battle in the save | Only its opponent and the frame shown; the battle is simulated again when loading | Under 1 KB instead of 11–23 KB, and its result can't contradict the run. Battles are deterministic. |
| Save version | 1 (`SAVE_VERSION`), raised whenever `SaveData` or the battle rules change | A save from another version is discarded, not migrated (QUALITY.md). |
| Impossible saves | Rejected if wins, lives or the round don't follow from the results, results go on after the run ended, gold plus the prices of the backpack items exceed `START_GOLD + GOLD_PER_ROUND × (round − 1)`, an item or uid couldn't have been bought, the phase doesn't fit the run, the opponent doesn't fit the round, or the battle's result is (not) in the run before (from) its last frame | Each rule follows from the game's own code (`applyBattleResult`, `startNextRound`, `buyItem`, `showFrame`). Buying keeps gold plus item prices the same; selling and rerolling lower it. |
| Broken save | Removed, start page with "Your saved run couldn't be loaded, so it was discarded." (once) | The game stays playable, and the player knows why the run is gone. |
| Reload in the shop | Same shop, gold and backpack | No free reroll. |
| Reload during a search | Shop with "The reload cancelled the search. Try again." | Like leaving the shop during a search (B5). The request died with the page. |
| Reload during a battle | The replay continues at the saved frame: "Resumed after a reload. The result was fixed when the battle started." | The opponent and the result were fixed when the battle started. |
| Reload while sending to the hall of fame | Form with "The reload interrupted saving. Sending the run again is safe: the hall of fame stores it only once. Try again." The typed name stays. | The server stores a run id only once (B7). |
| Start page during a run | "Continue run" (or "See your result"), and "New run" with "A new run ends your current run." | A reload on `/` doesn't look like a lost run, and a click can't end it by accident. |
| Several tabs | A tab takes over every change another tab saves (`storage` event), without the reload policy | An outdated tab can't overwrite a result. |

### Known limits

- Opening the game in another tab while a search runs counts as a reload: that search is cancelled.
- A tab shows the search or the hall of fame request of another tab. If that tab is closed in the middle, reloading this tab ends it with the reload policy.
- A tab that is just opening reads the save a few milliseconds before it listens to other tabs. If another tab saves in between, the opening tab writes the older state back and that last action is undone. Every rule is deterministic, so this can't give a second result, another opponent or a dodged loss.
- Values changed by hand in the browser's storage are only rejected if they are impossible. The hall of fame server checks every submitted run again (B7).

## Decision log

### 2026-11-26 · Save in localStorage, tabs share one run
- **Chose:** `localStorage`; a tab takes over every change another tab saves (`storage` event)
- **Instead of:** `sessionStorage` (a duplicated tab copies the run and can dodge a loss), or `localStorage` without syncing tabs (an outdated tab overwrites a result)
- **Because:** the run survives closing the tab or the browser, and no tab can undo what another tab did
- **Price:** opening another tab during a search cancels that search; a few lines and a test more
- **Evidence:** PR #17, "another tab's save" in `src/save.test.ts`

### 2026-11-26 · Save the battle as opponent and frame, simulate it again
- **Chose:** only the opponent and the frame shown are saved; loading rebuilds the battle with `createReplay`, the same code `startBattle` uses
- **Instead of:** saving the whole replay
- **Because:** under 1 KB instead of 11–23 KB, only the opponent has to be checked, and the result can't contradict the run
- **Price:** relies on deterministic battles; `SAVE_VERSION` must rise whenever the battle rules change
- **Evidence:** PR #17, "a reload never changes a result" in `src/save.test.ts`

### 2026-11-26 · Reload policy: requests end like failures, battles go on
- **Chose:** a reload cancels a search (shop with a message) and an unfinished hall of fame submission (form with a message, name kept); a battle continues at the saved frame
- **Instead of:** restarting the search automatically, or jumping to the end of the battle
- **Because:** reuses `searchFailed` and `submitFailed`, like leaving the shop during a search (B5); the opponent and result are fixed when the battle starts, so a reload can't give another opponent or avoid a loss
- **Price:** the player has to click "Find opponent" or "Save run" again; the game is saved on every replay frame
- **Evidence:** PR #17, a reload at every frame of a lost battle in `src/save.test.ts`

### 2026-11-26 · Reject impossible saves, discard them with a notice
- **Chose:** hand-written checks for types and for rules that follow from the game's code (wins, lives, round, gold plus item prices, uids, phase, opponent, battle result); a failing save is removed and the start page says so once
- **Instead of:** checking only the types, discarding silently, or repairing or migrating parts of a save
- **Because:** "impossible" saves are part of the requirement; the player knows why the run is gone; QUALITY.md says discard, don't migrate
- **Price:** the checks must change together with the rules; a possible but edited save (e.g. less gold) is accepted
- **Evidence:** PR #17, 51 broken saves, 5,000 damaged saves and 100 randomly played runs in `src/save.test.ts`

### 2026-11-26 · "Continue run" on the start page
- **Chose:** during a run the start page shows "Continue run" (or "See your result") and "New run" with "A new run ends your current run."
- **Instead of:** redirecting `/` to the run, or keeping only "New run"
- **Because:** a reload on `/` doesn't look like a lost run, and a click can't end it by accident
- **Price:** the start page has two states
- **Evidence:** PR #17, browser test in Tested by

### 2026-11-26 · Explain the reload policy when it happens
- **Chose:** messages where the reload has an effect: FightBar, hall of fame form, start page, and a line in the resumed battle
- **Instead of:** a "Saving" section in the rules panel, or both
- **Because:** the player sees the rule exactly when it applies; the battle line covers the requirement to communicate the replay policy
- **Price:** the policy isn't known before the first reload
- **Evidence:** PR #17, `RELOAD_MESSAGES` in `src/save.ts`

## Tested by

| What | How | ✓ |
|---|---|---|
| Every screen survives a reload: shop (same offers and seed), search (cancelled with a message), battle (same opponent, result and frame), result page (typed name), sending (back to the form with a message), saved entry (no second submission). | `npm test -- src/save.test.ts` | |
| A reload at every frame of a lost battle ends with exactly that loss, also with a second reload after the end. A won battle stays won. | `npm test -- src/save.test.ts` | |
| Another tab's save is taken over as it is and saved back unchanged, so tabs don't overwrite each other in a loop. | `npm test -- src/save.test.ts` | |
| Every state of 100 randomly played runs (shop, search, battle, result screen, hall of fame, reloads at random moments) is accepted and kept by a reload, so the checks never discard a legit run. Both a victory and a defeat are among them. | `npm test -- src/save.test.ts` | |
| 51 broken, impossible or outdated saves are discarded with the right reason; 5,000 randomly damaged saves never throw. | `npm test -- src/save.test.ts` | |
| A missing, blocked or full storage keeps the game working. | `npm test -- src/state/storage.test.ts` | |
| Reload in the shop, after a reroll and after moving items: everything stays the same. | Browser: buy, move, reroll, reload twice. | |
| Reload during the search: shop with the message, retry finds the opponent of the same round. | Browser: `API_LATENCY=2500 npm run server` and `npx vite`, click "Find opponent", reload. | |
| Reload while losing a battle (QUALITY.md fairness check): the replay continues, the defeat costs exactly one life, also after reloading on the result frame. | Browser: buy only a Healing Herb, fight, reload twice during the replay and once at the end. | |
| Reload while saving to the hall of fame: the form shows the message and keeps the name; saving again shows the rank, and the run is listed once. | Browser: with `API_LATENCY=2500`, click "Save run", reload, wait 3 s, click "Save run" again, open the hall of fame. | |
| A broken, impossible (999 gold) or outdated (version 2) save: start page with the notice, the save is removed, "New run" works. | Browser: DevTools → Application → Local Storage → edit `backpack-brawl-save`, reload. | |
| Two tabs: a purchase, the search, the battle and its result show up in the other tab without a reload; the result counts once. | Browser: open the game in two tabs and play in one. | |
| With blocked storage a whole round can be played; after a reload the run is gone without a notice. | Browser: block site data for localhost, play a round, reload. | |
