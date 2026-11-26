import { countEquippedSetItems, getActiveItemSets, getItemSet, ITEM_SETS } from "../items";
import { describeSetBonus, SET_HELP } from "../rules";

export function SetBadge({ itemId }: { itemId: string }) {
  const set = getItemSet(itemId);
  if (!set) return null;

  return (
    <span title={SET_HELP[set.id]} className="rounded border border-gold/40 px-1 text-xs text-gold">
      {set.name}
    </span>
  );
}

export function SetBonuses({ itemIds, showProgress = false }: { itemIds: string[]; showProgress?: boolean }) {
  const sets = showProgress ? ITEM_SETS : getActiveItemSets(itemIds);
  if (sets.length === 0) return null;

  return (
    <ul aria-label={showProgress ? "Set progress" : "Active set bonuses"} className="text-xs text-muted">
      {sets.map((set) => {
        const pieces = countEquippedSetItems(set.id, itemIds);
        return (
          <li key={set.id} title={SET_HELP[set.id]}>
            {set.name}{showProgress ? ` ${pieces}/${set.itemIds.length}` : ""} · {describeSetBonus(set.id, pieces)}
          </li>
        );
      })}
    </ul>
  );
}
