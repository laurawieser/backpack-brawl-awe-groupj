import { useState } from "react";
import { TICK_SECONDS } from "../battle";
import { describeEffects, getItem } from "../items";
import { moveBlocker, sellBlocker, sellPrice } from "../run";
import { BACKPACK_COLS, itemIdsOf } from "../shop";
import type { ItemDef, RunState } from "../types";
import { SetBadge, SetBonuses } from "./ItemSets";

/** Hover text for a backpack slot: name, effects and cooldown. */
const tooltip = (item: ItemDef) =>
  [item.name, ...describeEffects(item.effects).map(({ label }) => label), `⏱️ every ${item.cooldown * TICK_SECONDS}s`].join("\n");

interface BackpackProps {
  run: RunState;
  onSell: (slotIndex: number) => void;
  onMove: (fromSlot: number, toSlot: number) => void;
}

export function Backpack({ run, onSell, onMove }: BackpackProps) {
  const { backpack } = run;
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selectedSlot = backpack.findIndex((slot) => slot?.uid === selectedItemId);
  const hasSelection = selectedSlot !== -1;

  function handleSlotClick(index: number) {
    if (!hasSelection) {
      setSelectedItemId(backpack[index]?.uid ?? null);
      return;
    }

    if (moveBlocker(run, selectedSlot, index) !== null) return;

    onMove(selectedSlot, index);
    setSelectedItemId(null);
  }

  return (
    <section className="rounded-lg border border-panel-edge bg-panel p-4">
      <h2 className="font-display text-xl font-bold">🎒 Backpack</h2>
      <p className="mb-3 text-sm text-muted">
        {hasSelection
          ? "Choose a highlighted slot to move or swap."
          : "Select an item to move it. Hover over it to see its stats."}
      </p>

      {hasSelection && (
        <button
          type="button"
          onClick={() => setSelectedItemId(null)}
          className="mb-3 rounded-md border border-gold/40 px-2 py-1 text-sm"
        >
          Cancel selection
        </button>
      )}

      <div className="mb-3">
        <SetBonuses itemIds={itemIdsOf(backpack)} showProgress />
      </div>
      <ul
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${BACKPACK_COLS}, minmax(0, 1fr))` }}
      >
        {backpack.map((slot, index) => {
          const item = slot ? getItem(slot.itemId) : null;
          const sellReason = slot ? sellBlocker(run, index) : null;
          const price = slot ? sellPrice(slot.itemId) : null;
          const isSelected = index === selectedSlot;
          const canMoveHere = hasSelection && moveBlocker(run, selectedSlot, index) === null;
          const slotLabel = item ? `${item.name}, slot ${index + 1}` : `empty slot ${index + 1}`;
          const actionLabel = hasSelection
            ? `${item ? "Swap with" : "Move to"} ${slotLabel}`
            : `Select ${slotLabel}`;

          return (
            <li
              key={slot?.uid ?? `empty-${index}`}
              title={item ? tooltip(item) : undefined}
              className={[
                "flex aspect-square flex-col items-center justify-center gap-1 rounded-md border-2 p-1",
                item ? "border-gold/40 bg-ink/40" : "border-dashed border-panel-edge",
                isSelected ? "ring-2 ring-gold" : "",
                canMoveHere ? "ring-2 ring-emerald-400" : "",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => handleSlotClick(index)}
                disabled={hasSelection ? !canMoveHere : item === null}
                aria-label={isSelected ? `Selected ${slotLabel}` : actionLabel}
                className="flex w-full flex-1 flex-col items-center justify-center gap-1 rounded-sm text-center text-xs leading-tight enabled:cursor-pointer focus-visible:outline-2 focus-visible:outline-gold"
              >
                {item && (
                  <span className="text-3xl leading-none sm:text-4xl" aria-hidden>
                    {item.icon}
                  </span>
                )}
                <span>{item?.name ?? "Empty"}</span>
                {item && <SetBadge itemId={item.id} />}
                {isSelected && <span className="text-gold">Selected</span>}
                {canMoveHere && (
                  <span className="text-emerald-300">{item ? "Swap here" : "Move here"}</span>
                )}
              </button>

              {item && (
                <button
                  type="button"
                  onClick={() => onSell(index)}
                  disabled={sellReason !== null}
                  aria-label={sellReason ?? `Sell for ${price} 🪙 (${item.name})`}
                  className="rounded-md bg-gold px-2 py-1 text-xs font-bold text-ink hover:brightness-110 disabled:bg-panel-edge disabled:text-muted"
                >
                  {sellReason ?? `Sell for ${price} 🪙`}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
