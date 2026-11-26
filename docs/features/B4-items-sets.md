# B4 · Item sets and Burn

| Owner | Reviewer | Issue | PR | Status |
|---|---|---|---|---|
| Laura | Martin | #5 | 16 | merged |

## In short

Fire and Guard each contain three items. Two distinct equipped pieces activate the set bonus, and the third strengthens it. Both fighters can use either bonus. Guard grants starting block. Fire applies Burn to the opposing fighter at battle start, and every Fire item activation adds one more stack, up to a maximum of 3. Burn stacks faster than Poison, ticks twice as often, deals more damage in total, consumes block before HP, and decays by one stack per tick. Opponents use Fire from round 6 on.

## Where it lives

| File | Role |
|---|---|
| `src/items.ts` | Defines Fire and Guard and counts distinct equipped pieces for set activation and bonus tiers. |
| `src/items.test.ts` | Tests set membership, activation, duplicate copies, and simultaneous activation of both sets. |
| `src/battle.ts` | Grants and logs Guard starting block, applies Fire starting stacks and Burn from Fire item activations up to `MAX_BURN_STACKS`, and resolves and logs Burn damage. |
| `src/types.ts` | Defines Burn stacks in replay snapshots and Burn events in the battle log. |
| `src/battle.test.ts` | Tests Guard bonus tiers and Burn application, the stack maximum, timing, block absorption, decay, and knockouts. |
| `server/opponents.js` | Opponents of rounds 3–5 use Hunting Bow copies, so Fire stays inactive until round 6. |
| `server/opponents.test.js` | Verifies that Fire is inactive for the opponents of rounds 1–5 and active from round 6 on. |
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
| Burn per Fire activation | +1 stack each time a Fire item activates while its owner's Fire set is active. Copies count, too. | Burn stacks faster than Poison: two Fire items add 2 stacks every 2 seconds, one Venom Needle adds 1 stack every 4 seconds. |
| Burn maximum | 3 stacks (`MAX_BURN_STACKS`). An activation at the maximum adds nothing and says so in the combat log. | Without a maximum, several Fire items outpace the decay and Burn grows for the whole battle (see Balance). 3 equals the full Fire starting bonus. |
| Burn damage and decay | First damage after 1 second, then every second (2 battle ticks), at 1 damage per remaining stack. Block absorbs damage before HP, and one stack expires after each damage tick. | Burn ticks twice as often as Poison and wears off on its own. Over a full battle, Chipped Dagger and Hunting Bow deal 75 Burn damage, one Venom Needle deals 56 Poison damage. |
| Fire opponents | From round 6 (Ash Golem, Hollow King). Rounds 3–5 use Hunting Bow copies with about the same damage per second. | Every weapon except the Spiked Shield belongs to Fire, so two different weapons always activate it. Keeping Burn out of rounds 3–5 keeps a victory reachable (see Balance). |

## Decision log

- **Reuse existing items for both sets.** This keeps the shop pool unchanged.
- **Require distinct pieces to activate and upgrade a set.** This rewards collecting different items and prevents cheap copies from unlocking or upgrading the bonus. Each equipped copy still activates normally and can add Burn once Fire is active.
- **Apply the Guard bonus once at battle start.** The same rule applies to both fighters. Two copies of Oak Buckler still count as one piece.

- **Apply Fire at battle start and on Fire item activations.** Each qualifying fighter applies 2 or 3 starting stacks to the opponent. Each Fire item activation adds 1 stack before scheduled status damage.
- **Resolve Burn after item activations and scheduled Poison damage, before checking for a knockout.** Block gained on that tick can absorb Burn. One stack expires even when block absorbs all the damage.

### 2026-11-26 · Cap Burn at 3 stacks, 1 damage per stack
- **Chose:** Burn deals 1 damage per stack and stops at 3 stacks; each Fire activation still adds 1.
- **Instead of:** unlimited stacks at 2 damage each, or a cap alone.
- **Because:** several Fire items outgrew the decay (up to 17 stacks, 600 damage), so no backpack could win from round 5 on. 3 matches the full Fire starting bonus.
- **Price:** Fire hits less hard. Burn beats Poison per second and in total (75 vs 56), not per hit.
- **Evidence:** PR #16, Balance section, `src/battle.test.ts`

### 2026-11-26 · Fire opponents only from round 6
- **Chose:** rounds 3–5 use Hunting Bow copies, so their Fire set stays inactive.
- **Instead of:** Fire from round 3 (every weapon except the Spiked Shield is a Fire item).
- **Because:** round 5 rose from 0 % to 7.5 % winning backpacks (9.2 % before B4).
- **Price:** round 6 is harder than before B4 (0.08 % instead of 1.3 %).
- **Evidence:** PR #16, Balance section, `server/opponents.test.js`

## Tested by

| What | How | ✓ |
|---|---|---|
| Set members exist in the catalog. Empty, incomplete, mixed, and duplicate-only loadouts leave sets inactive. Both sets can activate at the same time. | `npm test -- src/items.test.ts` | ✓ |
| Fire applies 2 or 3 starting stacks to the opposing fighter. Both sides can apply Burn, and duplicate copies alone leave Fire inactive. | `npm test -- src/battle.test.ts` | ✓ |
| Without further applications, three starting stacks produce 3, 2, and 1 damage at ticks 2, 4, and 6. Block absorbs damage before HP, and one stack expires even if all the damage is blocked. | `npm test -- src/battle.test.ts` | ✓ |
| Fire item activations add Burn, copies included. An activation at the maximum adds 0 and logs why. Six Fire items never push Burn above 3 stacks over a full battle. | `npm test -- src/battle.test.ts` | ✓ |
| Fire is inactive for the opponents of rounds 1–5 and active from round 6 on. | `npm test -- server/opponents.test.js` | ✓ |
| Set badges and bonus tiers update when buying and selling items. Active bonuses and remaining Burn stacks are visible in battle, and the rules panel and tooltips explain the bonuses. | Browser: buy two different Fire items, sell one, then re-equip it and add the third. Check the backpack tiers and play a battle. Check the opening Burn event, the decay, and the additional stacks from Fire item activations. Repeat with Guard and check starting block. | |
| At tick 0, two distinct Guard items grant +2 block and three grant +4. Duplicate-only and no-Guard loadouts grant zero. The tests cover both fighters. | `npm test -- src/battle.test.ts` | ✓ |

The automated Clarity checks passed with npm run check. The battle tests verify the Guard log at tick 0 for both fighters, and the rules test verifies that a changed Burn damage value appears in both player-facing texts.

The battle tests also cover Burn from active Fire item activations, duplicate copies, a Burn knockout, and Poison resolving before Burn and the knockout check. In the full-length comparison against a passive target without block, two Fire pieces start dealing status damage earlier and deal more total status damage than one Venom Needle.

### Balance

We simulated every backpack of 1 to 6 items (18,563 combinations, gold ignored) against the opponent of each round. The table shows the share of backpacks that win. It is an upper bound for comparing versions, not a real player's chance. A victory needs five wins, so in practice rounds 1–5 must be winnable.

| Version | R3 | R4 | R5 | R6 | R7 |
|---|---|---|---|---|---|
| Before B4 | 63.7 % | 15.3 % | 9.2 % | 1.3 % | 0.01 % |
| Burn at battle start only, 2 damage per stack | 52.5 % | 6.7 % | 3.5 % | 0.25 % | 0 % |
| +1 Burn per Fire activation, no maximum | 1.3 % | 0.04 % | 0 % | 0 % | 0 % |
| Same, with a maximum of 3 stacks | 8.4 % | 0.5 % | 0 % | 0 % | 0 % |
| **Current: 1 damage per stack, maximum 3, Fire opponents from round 6** | **76.1 %** | **15.2 %** | **7.5 %** | 0.08 % | 0 % |

Without a maximum, the Tollgate Ogre's two Chipped Daggers and Hunting Bow added 3 stacks every 2 seconds while only 2 decayed. Burn grew to 17 stacks and dealt 600 damage in one battle. No backpack could win from round 5 on, so a victory was impossible. A maximum alone did not fix this, because every opponent from round 3 on had Fire.

We kept Poison at its B3 values. Making it tick every 4 seconds would have allowed weaker Burn, but it changed rounds 4 and 5 by at most 0.1 percentage points and mainly weakens the player, who uses Poison more than the opponents do.

Round 6 stays much harder than before B4. It only matters after a loss in rounds 1–5.

### Additional browser checks

- [ ] **Combat log icons and Fire activations.** Equip Chipped Dagger and Hunting Bow. At 2.0 s both add Burn before the scheduled Burn damage. Check that Burn shows 🔥, Guard starting block shows 🛡️, and Poison shows ☠️.
- [ ] **Burn maximum.** Equip two Chipped Daggers and a Hunting Bow. At 2.0 s the first two activations add Burn, the third logs that the opponent already has the maximum of 3 Burn stacks. The Burn counter never shows more than 3.
- [ ] **Duplicate items.** Equip two Chipped Daggers with no other Fire item. Verify that Fire shows 1/3 and is inactive. Add a Hunting Bow and verify that Fire shows 2/3 and grants 2 starting Burn stacks. Sell one dagger and verify that the bonus stays active.
- [ ] **Opponent bonuses.** In round 3 against the Tollgate Ogre, check that both Hunting Bows show a Fire badge, no active Fire bonus is listed, and your fighter gets no Burn. In round 5 against the Pit Gladiator, verify that its Guard bonus shows +2 starting block, its block starts at 2, the combat log shows the Guard grant at 0.0 s, and no Fire bonus is listed. In round 6 against the Ash Golem, check its 3-stack Fire bonus. Your fighter starts with 3 Burn stacks, and the application appears in the combat log at 0.0 s.
- [ ] **Clarity check.** Ask someone who has never played to watch a battle. Using the battle view, combat log, and tooltips, they should be able to explain who applied Burn, what absorbed the damage, why Guard provided starting block, and why the fight ended as it did.
