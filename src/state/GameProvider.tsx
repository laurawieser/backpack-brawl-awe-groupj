import { useState, type ReactNode } from "react";
import { newGame } from "../game";
import type { GameState } from "../types";
import { GameContext, type GameContextValue } from "./GameContext";

const randomSeed = () => Math.floor(Math.random() * 2 ** 32);

/** Holds the game state for all routes, so it survives navigating between pages. */
export function GameProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<GameState | null>(null);

  const value: GameContextValue = {
    game,
    // Every run gets a UUID, so the hall of fame stores it only once (see `RunState.runId`).
    startNewRun: () => setGame(newGame(randomSeed(), crypto.randomUUID())),
    update: (transition) => setGame((current) => (current ? transition(current) : current)),
  };

  return <GameContext value={value}>{children}</GameContext>;
}
