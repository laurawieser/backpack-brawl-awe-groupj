# B1 · Shop economy

| Owner | Reviewer | Issue | PR | Status |
|---|---|---|---|---|
| Laura | Martin | #1 | #[n] | in progress |

## In short

Players can sell items from the backpack for half their price (rounded down) and reroll the shop offers for 1 gold. Every action either completes fully or changes nothing, and the UI explains why an action is blocked before the player tries it.

Also fixes starter bug #1: buying with a full backpack took the gold but lost the item.

The purchase fix, sale rules, and reroll rules are covered by unit tests. The reroll button is connected and shows why rerolling is blocked when the player has no gold. The sell button and browser verification are pending.

## Where it lives

| File | Role |
|---|---|
| `src/run.ts` | Blocks purchases when the backpack is full, handles item sales, and rerolls offers using the current shop seed. |
| `src/run.test.ts` | Covers blocked purchases, sale proceeds, repeated sale attempts, and rerolls with and without enough gold. |
| `src/components/Shop.tsx` | Shows the reroll button, its price, and the blocker when the player cannot afford a reroll. |
| `src/pages/ShopPage.tsx` | Connects the reroll click to `rerollShop` through `updateRun`, which only applies shop actions during the shop phase. |

## Chosen values

| Setting | Value | Why |
|---|---|---|
| Sell price | Half the item price, rounded down | Specified in B1. |
| Reroll cost | 1 gold | Specified in B1. |

## Decision log

**To decide:**
- Confirm how to pass sale eligibility to the backpack component when wiring the sell button.

## Tested by

| What | How | ✓ |
|---|---|---|
| Buying with a full backpack leaves the run unchanged. | `npm.cmd test -- src/run.test.ts` | |
| Selling a five-gold item credits two gold and clears its slot. | `npm.cmd test -- src/run.test.ts` | |
| Selling the same slot twice credits gold only once. | `npm.cmd test -- src/run.test.ts` | |
| A reroll with exactly one gold spends it and updates the offers and seed. | `npm.cmd test -- src/run.test.ts` | |
| A reroll with zero gold reports the blocker and leaves the run unchanged. | `npm.cmd test -- src/run.test.ts` | |
| The reroll button spends one gold and shows the rolled offers. At zero gold, it displays `Not enough gold` and is disabled. | Browser, pending. Start a run and reroll until the balance reaches zero. | |
| The reroll button is disabled during opponent search. | Browser, pending. Start a search with an item in the backpack and at least one gold. | |
