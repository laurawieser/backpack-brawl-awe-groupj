# B2 · Backpack arrangement

| Owner | Reviewer | Issue | PR | Status |
|---|---|---|---|---|
| Laura | Martin | #3 | #[n] | in progress |

## In short

Players can select an item in the backpack, see that it is selected, and move it to another slot. Moving onto an occupied slot swaps the two items. The UI shows which moves are possible, and a selection can be cancelled.

## Where it lives

| File | Role |
|---|---|
| `src/run.ts` | Validates source and target slots and moves or swaps items without mutating the original backpack. |
| `src/run.test.ts` | Covers moving into an empty slot, swapping occupied slots, and rejecting a move from an empty slot. |
| `src/components/Backpack.tsx` | Handles two-click selection, calls `moveBlocker` to highlight valid targets, and lets the player cancel the selection. |
| `src/pages/ShopPage.tsx` | Passes the current run to the backpack and applies moves through the shop-phase guard in `updateRun`. |

## Chosen values

| Setting | Value | Why |
|---|---|---|
| Slot behavior | Move into an empty slot or swap with an occupied slot | Specified in B2. |

## Decision log

### Two-click backpack interaction

- **Chose:** Select an item, then click a highlighted destination slot. The player can cancel the selection at any time.
- **Instead of:** Drag-and-drop.
- **Because:** Standard buttons work with mouse, touch, and keyboard, and valid destinations are visible before the player moves an item.
- **Price:** Moving or swapping an item requires two clicks.
- **Evidence:** The B2 browser checks below cover selection, target highlighting, moving, swapping, and cancellation. 

## Tested by

| What | How | ✓ |
|---|---|---|
| Moving to an empty slot preserves the original backpack. | `npm.cmd test -- src/run.test.ts` | |
| Moving onto an occupied slot swaps both items. | `npm.cmd test -- src/run.test.ts` | |
| Moving from an empty slot reports a blocker and leaves the run unchanged. | `npm.cmd test -- src/run.test.ts` | |
| Selecting an item highlights it and its valid targets. | Browser, passed (Laura). Buy two items and select one. Check the selected item and target markings. | |
| Selecting an empty target moves the item and clears its previous slot. | Browser, passed (Laura). Select an item, then click an empty target. | |
| Selecting an occupied target swaps the two items. | Browser, passed (Laura). Select an item, then click another occupied slot. | |
| Cancel selection removes the highlights and leaves the items in place. | Browser, passed (Laura). Select an item, then click **Cancel selection**. | |
| Sell works independently of the move controls. | Browser, passed (Laura). Use **Sell** and check that it sells the item without triggering a move. | |
