import type { HallOfFameEntry } from "../types";

interface HallOfFameListProps {
  /** Best first, as the server sends them, so an entry's position is its rank. */
  entries: HallOfFameEntry[];
  /** Id of the player's own run, marked in the list; `null` if there is none. */
  highlightId: string | null;
}

const CELL = "px-3 py-2";

export function HallOfFameList({ entries, highlightId }: HallOfFameListProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="text-xs uppercase tracking-wider text-muted">
          <tr>
            <th scope="col" className={CELL}>Rank</th>
            <th scope="col" className={CELL}>Name</th>
            <th scope="col" className={CELL}>Result</th>
            <th scope="col" className={`${CELL} text-right`}>Wins</th>
            <th scope="col" className={`${CELL} text-right`}>Lives left</th>
            <th scope="col" className={`${CELL} text-right`}>Rounds</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const own = entry.id === highlightId;
            return (
              <tr
                key={entry.id}
                aria-current={own ? "true" : undefined}
                className={`border-t border-panel-edge ${own ? "bg-gold/15 font-bold text-gold" : ""}`}
              >
                <td className={CELL}>#{index + 1}</td>
                <td className={CELL}>
                  {entry.name}
                  {own && " (your run)"}
                </td>
                <td className={CELL}>{entry.outcome === "victory" ? "👑 Victory" : "🪦 Defeat"}</td>
                <td className={`${CELL} text-right`}>{entry.wins}</td>
                <td className={`${CELL} text-right`}>{entry.lives}</td>
                <td className={`${CELL} text-right`}>{entry.rounds}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
