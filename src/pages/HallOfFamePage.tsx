import { useEffect, useState } from "react";
import { Link } from "react-router";
import { fetchHallOfFame, HALL_OF_FAME_ERRORS } from "../api";
import { HallOfFameList } from "../components/HallOfFameList";
import { routeForGame } from "../game";
import { RANKING_RULE } from "../hallOfFame";
import { useGame } from "../state/GameContext";
import type { HallOfFameEntry } from "../types";

/** The list while it loads, after loading failed, or once it is there. */
type ListState =
  | { status: "loading" }
  | { status: "failed"; error: string }
  | { status: "loaded"; entries: HallOfFameEntry[] };

/** The best runs. Reachable at any time, with or without a run in progress. */
export function HallOfFamePage() {
  const { game } = useGame();
  const [list, setList] = useState<ListState>({ status: "loading" });
  // "Try again" counts this up, which loads the list again.
  const [attempt, setAttempt] = useState(0);

  // Loads the list when the page opens and on every retry; leaving the page cancels the request.
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const entries = await fetchHallOfFame(controller.signal);
        setList({ status: "loaded", entries });
      } catch (error) {
        // A cancelled request belongs to a page that is gone, so nobody needs its error.
        if (controller.signal.aborted) return;
        setList({ status: "failed", error: error instanceof Error ? error.message : HALL_OF_FAME_ERRORS.unreachable });
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);

  function handleRetry() {
    setList({ status: "loading" });
    setAttempt((count) => count + 1);
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-lg border-2 border-gold bg-panel p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-3xl font-bold">🏆 Hall of fame</h2>
        <p className="text-sm text-muted">{RANKING_RULE}</p>
      </div>

      <div aria-live="polite">
        {list.status === "loading" && <p className="animate-pulse font-bold text-gold">📜 Unrolling the scroll of champions…</p>}

        {list.status === "failed" && (
          <div className="flex flex-col items-start gap-2">
            <p role="alert" className="text-life">
              ⚠️ {list.error}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-md bg-life px-4 py-2 font-display font-bold text-parchment hover:brightness-110"
            >
              Try again
            </button>
          </div>
        )}

        {list.status === "loaded" && list.entries.length === 0 && (
          <p className="text-muted">No runs yet. Finish a run and be the first to enter the hall of fame.</p>
        )}

        {list.status === "loaded" && list.entries.length > 0 && (
          <HallOfFameList entries={list.entries} highlightId={game?.run.runId ?? null} />
        )}
      </div>

      <Link to={routeForGame(game)} className="self-start underline hover:text-gold">
        {game ? "← Back to your run" : "← Back to the start"}
      </Link>
    </section>
  );
}
