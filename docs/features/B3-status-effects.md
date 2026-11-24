# B3 · Status effects: poison and heal

| Owner | Reviewer | Issue | PR | Status |
|---|---|---|---|---|
| Laura | Martin | #4 | #[n] | in progress |

## In short

Two new battle effects. Poison adds stacks to the enemy; a poisoned fighter regularly loses HP per stack, and poison ignores block. Heal restores the fighter's own HP, never above max HP. Both are shown in the battle view, the combat log, the rules panel and tooltips.

## Where it lives

| File | Role |
|---|---|
| `src/types.ts`, `src/battle.ts` | Model and apply poison and healing and record them in replay frames and events. |
| `src/items.ts`, `server/opponents.js` | Define six shop items and equip the selected opponents with poison or heal. |
| `src/rules.ts`, `src/components/BattleView.tsx` | Explain the effects and display poison stacks and effect events in the replay. |
| `src/battle.test.ts` | Covers poison, healing, tick order, and shop availability. |

## Chosen values

| Setting | Value | Why |
|---|---|---|
| Poison damage interval | Every 2 seconds (4 battle ticks), measured from the start of combat | Both fighters use the same schedule. |
| Poison damage | 1 HP per stack on each poison tick, ignoring block | Each stack adds 1 HP of damage on every scheduled poison tick. |
| Poison stack duration | Stacks accumulate and last until the battle ends | Repeated applications increase poison damage over time. |

| New item | Effect per activation | Cooldown | Price |
|---|---|---|---|
| Venom Needle | Apply 1 poison stack to the enemy | 8 ticks (4 s) | 2 gold |
| Viper Fang | Apply 1 poison stack to the enemy | 6 ticks (3 s) | 4 gold |
| Toxic Flask | Apply 2 poison stacks to the enemy | 10 ticks (5 s) | 5 gold |
| Healing Herb | Restore up to 2 HP to the user | 6 ticks (3 s) | 2 gold |
| Restoration Charm | Restore up to 3 HP to the user | 6 ticks (3 s) | 4 gold |
| Greater Tonic | Restore up to 5 HP to the user | 8 ticks (4 s) | 5 gold |

## Decision log

### Poison timing and stack duration

- **Chose:** Use a shared battle clock for poison damage at 2 s, 4 s, 6 s, and so on. Stacks accumulate and last until the battle ends.
- **Instead of:** Starting a separate timer for each poisoned fighter or removing a stack after each poison tick.
- **Because:** The shared clock fits the existing battle loop and makes poison damage easier to follow in the combat log.
- **Price:** The wait until the first poison damage depends on when the first stack is applied. Persistent stacks make poison stronger in longer fights.

### Order within a battle tick

- **Chose:** Resolve ready player items in backpack order, then ready opponent items in their list order. Apply scheduled poison damage to both fighters, then check for knockouts. Newly applied stacks count immediately if poison damage is due. A ready heal can still resolve if its fighter has temporarily reached zero or negative HP. The fighter survives if their HP is above zero after the entire tick.
- **Instead of:** Applying poison damage before items or checking for knockouts as soon as an effect reduces a fighter to zero HP.
- **Because:** This preserves the existing end-of-tick knockout check and gives every ready item its effect before the outcome is decided.
- **Price:** A stack added on a scheduled poison tick deals damage immediately. A heal at full HP can have no effect before an enemy hit in the same tick. A heal can offset damage already taken that tick, and poison damage can still knock out the fighter after the heal.

### Catalog and opponent builds

- **Chose:** Add three poison items and three healing items to the shop catalog using the starting values above. Include one poison item and one healing item across selected opponent builds.
- **Instead of:** Retuning existing items or introducing the new effects only on the player side.
- **Because:** The new items preserve the roles of existing items and let players see both effects on either side of a fight.
- **Price:** The larger catalog changes the pool of shop offers. The new item values and affected opponent builds need playtesting.

| Round | Opponent | Replace | With | Why |
|---|---|---|---|---|
| 2 | Grave Tinker | Chipped Dagger | Venom Needle | Introduces poison early. The swap trades immediate damage for poison that builds over time while keeping the bow and shield. |
| 4 | Rusted Knight | Pot Lid | Healing Herb | Introduces healing in a later round. The swap trades a small source of block for capped healing while keeping the Oak Buckler. |

## Tested by

| What | How | ✓ |
|---|---|---|
| Poison stacks, bypasses block, and includes new stacks on a scheduled tick. | `npm test -- src/battle.test.ts` | |
| Heal is capped at max HP and can resolve before poison and the knockout check. | `npm test -- src/battle.test.ts` | |
| Shop rolls can offer all six new items. | `npm test -- src/battle.test.ts` | |
| Poison stacks and heal events are visible in the replay, and both effects are explained in the rules and tooltips. | Browser. Use the new items and inspect the fighter panels and combat log. | |
| Grave Tinker applies poison and Rusted Knight heals. | Browser. Reach rounds 2 and 4 and inspect the combat log. | |
