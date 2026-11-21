# B1 · Shop economy

| Owner | Reviewer | Issue | PR | Status |
|---|---|---|---|---|
| Laura | Martin | #1 | #[n] | in progress |

## In short

Players can sell items from the backpack for half their price (rounded down) and reroll the shop offers for 1 gold. Every action either completes fully or changes nothing, and the UI explains why an action is blocked before the player tries it.

Also fixes starter bug #1: buying with a full backpack took the gold but lost the item.

## Where it lives

| File | Role |
|---|---|
| `src/run.ts` | Blocks purchases when the backpack is full and handles item sales. |
| `src/run.test.ts` | Covers full-backpack purchases, sale proceeds, and repeated sale attempts. |

## Chosen values

| Setting | Value | Why |
|---|---|---|
| Sell price | Half the item price, rounded down | Specified in B1. |

## Decision log

**To decide:**
- ** 

## Tested by

| What | How | ✓ |
|---|---|---|
| Buying with a full backpack leaves the run unchanged | `npm.cmd test -- src/run.test.ts` | |
| Selling a five-gold item credits two gold and clears its slot. | `npm.cmd test -- src/run.test.ts` | |
| Selling the same slot twice credits gold only once. | `npm.cmd test -- src/run.test.ts` | |