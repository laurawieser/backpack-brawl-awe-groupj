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
| `src/battle.ts` | Grants and logs Guard starting block, applies Fire starting stacks, and resolves and logs Burn damage. |
| `src/types.ts` | Defines Burn stacks in replay snapshots and Burn events in the battle log. |
| `src/battle.test.ts` | Tests Guard bonus tiers and Burn application, timing, block absorption, and decay. |
| `src/components/ItemSets.tsx` | Renders item badges, set progress, and active starting bonuses. |
| `src/components/ItemCard.tsx` and `src/components/Backpack.tsx` | Show item membership in the shop and backpack and the current set tiers in the backpack. |
| `src/components/BattleView.tsx` | Shows both fighters' item badges and active bonuses, remaining Burn stacks, and Burn events including the opening frame. |
| `src/rules.ts` | Explains sets and Burn in the rules panel and tooltips using the combat constants. |
| `src/rules.test.ts` | Verifies that changing the configured Burn damage updates the tooltip and the rules panel. |

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
| Set badges and bonus tiers update when buying and selling items. Active bonuses and remaining Burn stacks are visible in battle, and the rules panel and tooltips explain the bonuses. | Browser: buy two different Fire items, sell one, then re-equip it and add the third. Check the backpack tiers and play a battle. Check the opening Burn event and watch the stacks decrease. Repeat with Guard and check starting block. | |
| At tick 0, two distinct Guard items grant +2 block and three grant +4. Duplicate-only and no-Guard loadouts grant zero. The tests cover both fighters. | `npm test -- src/battle.test.ts` | ✓ |

The automated Clarity checks passed with npm run check. The battle tests verify the Guard log at tick 0 for both fighters, and the rules test verifies that a changed Burn damage value appears in both player-facing texts.

### Additional browser checks

- [ ] **Duplicate items.** Equip two Chipped Daggers with no other Fire item. Verify that Fire shows 1/3 and is inactive. Add a Hunting Bow and verify that Fire shows 2/3 and grants 2 starting Burn stacks. Sell one dagger and verify that the bonus stays active.
- [ ] **Opponent bonuses.** In round 3 against the Tollgate Ogre, check its Fire badges and 2-stack Fire bonus. Your fighter starts with 2 Burn stacks, and the application appears in the combat log at 0.0 s. In round 5 against the Pit Gladiator, verify that its Guard bonus shows +2 starting block, its block starts at 2, and the combat log shows the Guard grant at 0.0 s.
- [ ] **Clarity check.** Ask someone who has never played to watch a battle. Using the battle view, combat log, and tooltips, they should be able to explain who applied Burn, what absorbed the damage, why Guard provided starting block, and why the fight ended as it did.
