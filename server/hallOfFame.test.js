import { describe, expect, it } from "vitest";
import * as client from "../src/hallOfFame.ts";
import * as rules from "../src/run.ts";
import {
  createHallOfFame,
  NAME_MAX_LENGTH,
  nameError,
  START_LIVES,
  TOP_ENTRIES,
  validateRun,
  WINS_TO_VICTORY,
} from "./hallOfFame.js";

describe("copies of the client's rules", () => {
  it("uses the same run rules as src/run.ts", () => {
    expect(WINS_TO_VICTORY).toBe(rules.WINS_TO_VICTORY);
    expect(START_LIVES).toBe(rules.START_LIVES);
  });

  it("uses the same name length as src/hallOfFame.ts", () => {
    expect(NAME_MAX_LENGTH).toBe(client.NAME_MAX_LENGTH);
  });

  it.each([
    "Martin",
    "Zoë Grey",
    "Laura_W-2",
    "李小龙",
    "  Laura  ",
    "Rene\u0301",
    "𝐀".repeat(NAME_MAX_LENGTH),
    "x".repeat(NAME_MAX_LENGTH),
    "x".repeat(NAME_MAX_LENGTH + 1),
    "",
    "   ",
    "Martin 🎒",
    "<b>Laura</b>",
    "Lau\tra",
  ])("accepts or rejects the name %j like the client", (name) => {
    expect(nameError(name) === null).toBe(client.nameBlocker(name) === null);
  });
});

const RUN_ID = "0b9c6a4e-6f1e-4c55-9a39-2f0f5f3c1d2a";
const victory = {
  runId: RUN_ID,
  name: "Martin",
  outcome: "victory",
  wins: 5,
  lives: 2,
  rounds: 6,
  results: ["win", "loss", "win", "win", "win", "win"],
};
const defeat = {
  runId: RUN_ID,
  name: "Laura",
  outcome: "defeat",
  wins: 1,
  lives: 0,
  rounds: 4,
  results: ["loss", "win", "loss", "loss"],
};

describe("validateRun", () => {
  it("accepts a victory and stores the cleaned-up name", () => {
    expect(validateRun({ ...victory, name: "  Martin " })).toEqual({
      run: { id: RUN_ID, name: "Martin", outcome: "victory", wins: 5, lives: 2, rounds: 6 },
    });
  });

  it("accepts a defeat", () => {
    expect(validateRun(defeat)).toEqual({
      run: { id: RUN_ID, name: "Laura", outcome: "defeat", wins: 1, lives: 0, rounds: 4 },
    });
  });

  it("accepts the longest possible run", () => {
    const results = ["win", "win", "win", "win", "loss", "loss", "loss"];

    expect(validateRun({ ...defeat, wins: 4, rounds: 7, results }).run).toBeDefined();
  });

  it.each([
    ["no object", "run", "the body must be a JSON object"],
    ["null", null, "the body must be a JSON object"],
    ["a list", [], "the body must be a JSON object"],
    ["an unknown field", { ...victory, gold: 99 }, "unknown field: gold"],
    ["a missing run id", { ...victory, runId: undefined }, "runId must be a lowercase UUID"],
    ["a run id that isn't a UUID", { ...victory, runId: "run-1" }, "runId must be a lowercase UUID"],
    ["a name that isn't text", { ...victory, name: 42 }, "name must be text"],
    ["an empty name", { ...victory, name: "  " }, "name must not be empty"],
    ["a name that is too long", { ...victory, name: "x".repeat(NAME_MAX_LENGTH + 1) }, `name must be at most ${NAME_MAX_LENGTH} characters`],
    ["a name with markup", { ...victory, name: "<script>" }, "name may only contain letters, digits, spaces, - and _"],
    ["results that aren't a list", { ...victory, results: "win" }, "results must be a list"],
    ["an unknown result", { ...victory, results: ["win", "draw"] }, 'results may only contain "win" and "loss"'],
    ["no results", { ...defeat, results: [] }, "results describe a run that isn't over yet"],
    ["an unfinished run", { ...victory, results: ["win", "win"] }, "results describe a run that isn't over yet"],
    ["a sixth win", { ...victory, wins: 6, rounds: 7, results: [...victory.results, "win"] }, "results go on after the run was over"],
    ["a battle after the last life", { ...defeat, results: [...defeat.results, "win"] }, "results go on after the run was over"],
    ["wins that don't match the results", { ...victory, wins: 4 }, 'wins must be 5, the number of "win" results'],
    ["wins as text", { ...victory, wins: "5" }, 'wins must be 5, the number of "win" results'],
    ["lives that don't match the results", { ...victory, lives: 3 }, 'lives must be 2: 3 minus the number of "loss" results'],
    ["rounds that don't match the results", { ...victory, rounds: 5 }, "rounds must be 6, the number of results"],
    ["the wrong outcome", { ...defeat, outcome: "victory" }, 'outcome must be "defeat" for these results'],
  ])("rejects %s", (_case, body, error) => {
    expect(validateRun(body)).toEqual({ error });
  });
});

/** A stored run with the given numbers; its name is its id. */
const entry = (id, wins, lives) => ({
  id,
  name: id,
  outcome: wins === WINS_TO_VICTORY ? "victory" : "defeat",
  wins,
  lives,
  rounds: wins + START_LIVES - lives,
});

describe("createHallOfFame", () => {
  it("ranks more wins first, then more lives, and keeps the earlier of two equal runs ahead", () => {
    const hall = createHallOfFame();
    hall.add(entry("a", 3, 0));
    hall.add(entry("b", 5, 1));
    hall.add(entry("c", 5, 3));
    hall.add(entry("d", 3, 0));

    expect(hall.top().map((run) => run.id)).toEqual(["c", "b", "a", "d"]);
  });

  it("returns the rank of a new run", () => {
    const hall = createHallOfFame();
    hall.add(entry("a", 5, 3));

    expect(hall.add(entry("b", 2, 0))).toEqual({ entry: entry("b", 2, 0), rank: 2, created: true });
  });

  it("stores a run id only once and returns the stored entry again", () => {
    const hall = createHallOfFame();
    const first = hall.add(entry("a", 2, 0));
    const again = hall.add({ ...entry("a", 5, 3), name: "Someone else" });

    expect(again).toEqual({ entry: first.entry, rank: 1, created: false });
    expect(hall.top()).toHaveLength(1);
  });

  it(`lists only the best ${TOP_ENTRIES} runs`, () => {
    const hall = createHallOfFame();
    for (let index = 0; index < TOP_ENTRIES; index += 1) hall.add(entry(`good-${index}`, 5, 3));
    const worst = hall.add(entry("worst", 0, 0));

    expect(hall.top()).toHaveLength(TOP_ENTRIES);
    expect(hall.top().map((run) => run.id)).not.toContain("worst");
    expect(worst.rank).toBe(TOP_ENTRIES + 1);
  });
});
