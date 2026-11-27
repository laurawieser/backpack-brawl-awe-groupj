import { useEffect, useState, type ReactNode } from "react";
import { newGame } from "../game";
import { loadGame, readSave, SAVE_KEY, toSave } from "../save";
import { GameContext, type GameContextValue } from "./GameContext";
import { readStoredSave, removeStoredSave, writeStoredSave } from "./storage";

const randomSeed = () => Math.floor(Math.random() * 2 ** 32);

/**
 * Holds the game state for all routes, so it survives navigating between pages, and keeps it in
 * `localStorage`, so it survives a reload (B6).
 */
export function GameProvider({ children }: { children: ReactNode }) {
  const [loaded] = useState(() => loadGame(readStoredSave()));
  const [game, setGame] = useState(loaded.game);
  const [discardedSave, setDiscardedSave] = useState(loaded.discarded);

  // Saves every change. Without a run there is nothing to continue, so a discarded save is removed too.
  useEffect(() => {
    if (game) writeStoredSave(JSON.stringify(toSave(game)));
    else removeStoredSave();
  }, [game]);

  // Another tab changed the run: continue with its state, so an outdated tab can't overwrite a result.
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== SAVE_KEY) return;
      const { game: other } = readSave(event.newValue);
      if (!other) return;
      setGame(other);
      setDiscardedSave(false);
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const value: GameContextValue = {
    game,
    discardedSave,
    // Every run gets a UUID, so the hall of fame stores it only once (see `RunState.runId`).
    startNewRun: () => {
      setDiscardedSave(false);
      setGame(newGame(randomSeed(), crypto.randomUUID()));
    },
    update: (transition) => setGame((current) => (current ? transition(current) : current)),
  };

  return <GameContext value={value}>{children}</GameContext>;
}
