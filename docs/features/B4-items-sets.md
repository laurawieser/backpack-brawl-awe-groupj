# B4 · Item sets and Burn

| Owner | Reviewer | Issue | PR | Status |
|---|---|---|---|---|
| Laura | Martin | #5 | #[n] | in progress |

## In short

Fire and Guard each contain three items. Two distinct equipped pieces activate the set bonus, and the third strengthens it. Both fighters can use either bonus. Guard grants starting block, and Fire applies Burn to the opposing fighter at battle start. Burn ticks more often than Poison, deals more damage per stack, and consumes block before HP.

## Where it lives

| File | Role |
|---|---|
| `src/items.ts` | Defines Fire and Guard and counts distinct equipped pieces for set activation and bonus tiers. |
| `src/items.test.ts` | Tests set membership, activation, duplicate copies, and simultaneous activation of both sets. |
| `src/battle.ts` | Grants Guard starting block, applies Fire starting stacks, and resolves and logs Burn damage. |
| `src/types.ts` | Defines Burn stacks in replay snapshots and Burn events in the battle log. |
| `src/battle.test.ts` | Tests Guard bonus tiers and Burn application, timing, block absorption, and decay. |

## Chosen values

| Setting | Value | Why |
|---|---|---|
| Fire items | Chipped Dagger, Hunting Bow, Iron Cleaver | Reuses existing offensive items. |
| Guard items | Oak Buckler, Pot Lid, Spiked Shield | Reuses existing items that provide block. |
| Set activation | At least two distinct item IDs from the same set | Duplicate copies count as one set piece. |
| Guard starting block | 0 with fewer than two distinct Guard items, +2 with two, +4 with all three | Two pieces unlock the bonus, and the third piece makes it stronger. |
| Fire starting Burn | 0 with fewer than two distinct Fire items, 2 stacks with two, 3 with all three | The third piece increases the opening damage. |
| Burn damage and decay | First damage after 1 second, then every second (2 battle ticks), at 2 damage per remaining stack. Block absorbs damage before HP, and one stack expires after each damage tick. | Burn hits harder per stack and more often than Poison, and wears off on its own. |

## Decision log

- **Reuse existing items for both sets.** This keeps the shop pool unchanged.
- **Count distinct item IDs toward activation.** Players activate a set by collecting different pieces. Duplicate copies can still be equipped.
- **Apply the Guard bonus once at battle start.** The same rule applies to both fighters. Two copies of Oak Buckler still count as one piece.

- **Apply Fire once at battle start.** Each qualifying fighter applies Burn to the opposing fighter.
- **Resolve Burn after item activations and scheduled Poison damage, before checking for a knockout.** Block gained on that tick can absorb Burn. One stack expires even when block absorbs all the damage.

## Tested by

| What | How | ✓ |
|---|---|---|
| Set members exist in the catalog. Empty, incomplete, mixed, and duplicate-only loadouts leave sets inactive. Both sets can activate at the same time. | `npm test -- src/items.test.ts` | ✓ |
| Fire applies 2 or 3 starting stacks to the opposing fighter. Both sides can apply Burn, and duplicate copies alone leave Fire inactive. | `npm test -- src/battle.test.ts` | ✓ |
| Three starting stacks produce 6, 4, and 2 damage at ticks 2, 4, and 6. Block absorbs damage before HP, and one stack expires even if all the damage is blocked. | `npm test -- src/battle.test.ts` | ✓ |
| Set badges and bonus tiers update when buying and selling items. Active bonuses and remaining Burn stacks are visible in battle, and the rules panel and tooltips explain the bonuses. | Browser test after the UI changes. | |
| At tick 0, two distinct Guard items grant +2 block and three grant +4. Duplicate-only and no-Guard loadouts grant zero. The tests cover both fighters. | `npm test -- src/battle.test.ts` | ✓ |
