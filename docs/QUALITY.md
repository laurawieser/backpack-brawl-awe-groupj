# Quality goals

Status: draft

*Not chosen: performance (small local game) and maintainability (covered by our workflow, not a separate goal).*

## Expected usage

A single player in a browser plays short runs, often refreshes, and sometimes tries to cheat.
The backend is slow and unreliable on purpose, and battles run without player input.

## 1. Clarity

Players can see why they won or lost.

- **Reason:** battles play out automatically, so effects like poison, burn and set bonuses seem random unless explained (B3, B4).
- **Approach:** rule texts are built from the game's own constants; every effect appears in the battle view, the log and a tooltip; blocked actions show the reason up front.
- **Cost:** less freedom in how the texts are worded.
- **Check:** PR checklist "mechanic explained?"; a test that a changed value changes its text; one person who has never played watches a battle and explains the result.

## 2. Resilience

A failing backend or corrupted save never leaves the player stuck.

- **Reason:** the API fails by design, and stored data can be outdated or broken (B5, B6, B7).
- **Approach:** validate everything that comes from outside before using it; versioned saves; failed requests keep the player's input for a retry.
- **Cost:** extra code, and an incompatible save is discarded instead of migrated.
- **Check:** run with `API_FAIL=true`; unit tests that load broken saves; retry a failed hall of fame submission.

## 3. Fairness

No click sequence, refresh or forged request bends the rules.

- **Reason:** if gold, items or results can be duplicated or dodged, the hall of fame is worthless (B1, B5, B6, B7).
- **Approach:** one rule function guards both the button and the action; stale opponent responses are ignored; the save locks in shop and battle state; the server re-checks every submitted run.
- **Cost:** some rules are duplicated on the server.
- **Check:** unit tests for buy/sell/reroll/move sequences and double responses; refresh while losing a battle; send an impossible run with `curl`.