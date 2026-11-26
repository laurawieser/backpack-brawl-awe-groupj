import { expect, it } from "vitest";
import { getActiveItemSets } from "../src/items.ts";
import { OPPONENTS, opponentForRound } from "./opponents.js";

const activeSets = (round) => getActiveItemSets(opponentForRound(round).items).map((set) => set.id);

it("keeps Fire inactive for the opponents of rounds 1 to 5", () => {
  for (let round = 1; round <= 5; round++) expect(activeSets(round)).not.toContain("fire");
});

it("gives Fire to the opponents from round 6 on", () => {
  for (let round = 6; round <= OPPONENTS.length + 2; round++) expect(activeSets(round)).toContain("fire");
});
