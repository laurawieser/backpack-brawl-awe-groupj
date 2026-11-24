# B4 · Item sets and Burn

| Owner | Reviewer | Issue | PR | Status |
|---|---|---|---|---|
| Laura | Martin | #5 | #[n] | in progress |

## In short

Items belong to sets. A set grants a bonus while 2 or more of its items are in a backpack, for the player and for opponents. There are at least 2 sets with at least 3 items each. The Fire set adds Burn: it stacks faster and hits harder than poison, is absorbed by block first, and decays until it wears off.

## Where it lives

| File | Role |
|---|---|
| `src/items.ts` | Defines the Fire and Guard sets and determines which sets are active for a list of equipped item IDs. |
| `src/items.test.ts` | Tests set membership, activation, duplicate copies, and simultaneous activation of both sets. |

## Chosen values

| Setting | Value | Why |
|---|---|---|
| Fire items | Chipped Dagger, Hunting Bow, Iron Cleaver | Reuses existing offensive items. |
| Guard items | Oak Buckler, Pot Lid, Spiked Shield | Reuses existing items that provide block. |
| Set activation | At least two distinct item IDs from the same set | Duplicate copies count as one set piece. |

## Decision log

- **Reuse existing items for both sets.** This keeps the shop pool unchanged.
- **Count distinct item IDs toward activation.** Players activate a set by collecting different pieces. Duplicate copies can still be equipped.

**To decide:**

- Confirm what triggers Burn and how many stacks it applies, when Burn deals damage, and how it decays.
- Confirm the Guard bonus and its value.

## Tested by

| What | How | ✓ |
|---|---|---|
| Set members exist in the catalog. Empty, incomplete, mixed, and duplicate-only loadouts leave sets inactive. Both sets can activate at the same time. | `npm test -- src/items.test.ts` | |
