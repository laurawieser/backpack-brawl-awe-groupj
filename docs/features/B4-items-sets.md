# B4 · Item sets and Burn

| Owner | Reviewer | Issue | PR | Status |
|---|---|---|---|---|
| Laura | Martin | #5 | #[n] | in progress |

## In short

Items belong to sets. A set grants a bonus while 2 or more of its items are in a backpack, for the player and for opponents. There are at least 2 sets with at least 3 items each. The Fire set adds Burn: it stacks faster and hits harder than poison, is absorbed by block first, and decays until it wears off.

## Where it lives

| File | Role |
|---|---|
| `src/items.ts` | Defines Fire and Guard and counts distinct equipped pieces for set activation and bonus tiers. |
| `src/items.test.ts` | Tests set membership, activation, duplicate copies, and simultaneous activation of both sets. |
| `src/battle.ts` | Applies Guard starting block when each fighter is initialized. |
| `src/battle.test.ts` | Tests both Guard bonus tiers and loadouts that receive no starting block. |

## Chosen values

| Setting | Value | Why |
|---|---|---|
| Fire items | Chipped Dagger, Hunting Bow, Iron Cleaver | Reuses existing offensive items. |
| Guard items | Oak Buckler, Pot Lid, Spiked Shield | Reuses existing items that provide block. |
| Set activation | At least two distinct item IDs from the same set | Duplicate copies count as one set piece. |
| Guard starting block | 0 with fewer than two distinct Guard items, +2 with two, +4 with all three | Two pieces unlock the bonus, and the third piece makes it stronger. |

## Decision log

- **Reuse existing items for both sets.** This keeps the shop pool unchanged.
- **Count distinct item IDs toward activation.** Players activate a set by collecting different pieces. Duplicate copies can still be equipped.
- **Apply the Guard bonus once at battle start.** The same rule applies to both fighters. Two copies of Oak Buckler still count as one piece.

**To decide:**

- Confirm what triggers Burn and how many stacks it applies, when Burn deals damage, and how it decays.

## Tested by

| What | How | ✓ |
|---|---|---|
| Set members exist in the catalog. Empty, incomplete, mixed, and duplicate-only loadouts leave sets inactive. Both sets can activate at the same time. | `npm test -- src/items.test.ts` | |
| At tick 0, two distinct Guard items grant +2 block and three grant +4. Duplicate-only and no-Guard loadouts grant zero. The tests cover both fighters. | `npm test -- src/battle.test.ts` | ✓ |
