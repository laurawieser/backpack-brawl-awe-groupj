import { useEffect, useRef } from "react";
import { fetchOpponent } from "../api";
import { Backpack } from "../components/Backpack";
import { FightBar } from "../components/FightBar";
import { RulesPanel } from "../components/RulesPanel";
import { RunHeader } from "../components/RunHeader";
import { Shop } from "../components/Shop";
import { fightBlocker, searchFailed, startBattle, startSearch, updateRun } from "../game";
import { buyItem, rerollShop, sellItem } from "../run";
import { useActiveGame } from "../state/GameContext";

export function ShopPage() {
  const { game, update } = useActiveGame();
  const { run, phase } = game;

  // Aborted when the page closes, so a search doesn't outlive the shop it was started from.
  const pageOpen = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    pageOpen.current = controller;
    return () => controller.abort();
  }, []);

  function handleBuy(offerIndex: number) {
    update((current) => updateRun(current, (currentRun) => buyItem(currentRun, offerIndex)));
  }

  function handleReroll() {
    update((current) => updateRun(current, rerollShop));
  }

  function handleSell(slotIndex: number) {
    update((current) => updateRun(current, (currentRun) => sellItem(currentRun, slotIndex)));
  }

  // Once the opponent is found the phase becomes "battle" and RequireRoute redirects to the battle page.
  // Each click gets its own id; startBattle and searchFailed ignore responses for any other search.
  async function handleFindOpponent() {
    if (fightBlocker(game) !== null) return;
    const searchId = crypto.randomUUID();
    update((current) => startSearch(current, searchId));
    try {
      const opponent = await fetchOpponent(run.round, pageOpen.current?.signal);
      update((current) => startBattle(current, searchId, opponent));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Opponent search failed.";
      update((current) => searchFailed(current, searchId, message));
    }
  }

  return (
    <>
      <RunHeader run={run} />
      <FightBar phase={phase} blocker={fightBlocker(game)} error={game.error} onFight={handleFindOpponent} />

      {/* While searching, the whole shop/backpack area is disabled so the fighting build can't change. */}
      <fieldset disabled={phase !== "shop"} className="grid min-w-0 gap-4 disabled:opacity-60 lg:grid-cols-[1fr_16rem_18rem]">
        <Shop run={run} onBuy={handleBuy} onReroll={handleReroll} />
        <Backpack run={run} onSell={handleSell} />
        <aside className="flex flex-col gap-4">
          <RulesPanel open={run.round === 1} />
        </aside>
      </fieldset>
    </>
  );
}
