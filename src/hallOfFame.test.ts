import { describe, expect, it } from "vitest";
import { NAME_MAX_LENGTH, nameBlocker, normalizeName, runSubmission } from "./hallOfFame";
import { applyBattleResult, newRun } from "./run";
import type { Side } from "./types";

describe("nameBlocker", () => {
  it.each(["Martin", "Šimek Martin", "Laura_W-2", "李小龙", "a", "x".repeat(NAME_MAX_LENGTH), "  Laura  "])(
    "accepts %j",
    (name) => {
      expect(nameBlocker(name)).toBeNull();
    },
  );

  it.each([
    ["an empty name", "", "Enter your name"],
    ["only spaces", "   ", "Enter your name"],
    ["a name that is too long", "x".repeat(NAME_MAX_LENGTH + 1), `Use at most ${NAME_MAX_LENGTH} characters`],
    ["an emoji", "Martin 🎒", "Use only letters, digits, spaces, - and _"],
    ["markup", "<b>Laura</b>", "Use only letters, digits, spaces, - and _"],
    ["a tab inside", "Lau\tra", "Use only letters, digits, spaces, - and _"],
  ])("rejects %s", (_case, name, reason) => {
    expect(nameBlocker(name)).toBe(reason);
  });

  it("treats a decomposed é like a single letter", () => {
    const decomposed = "René";

    expect(nameBlocker(decomposed)).toBeNull();
    expect(normalizeName(decomposed)).toBe("René");
  });

  it("counts a letter outside the BMP as one character", () => {
    // U+1D400 is a letter that takes two UTF-16 units.
    expect(nameBlocker("𝐀".repeat(NAME_MAX_LENGTH))).toBeNull();
  });
});

describe("runSubmission", () => {
  it("is null while the run is still going", () => {
    expect(runSubmission(newRun(123, "run-1"), "Martin")).toBeNull();
  });

  it("sends the run's numbers, its results and the cleaned-up name", () => {
    const sides: Side[] = ["player", "opponent", "opponent", "player", "opponent"];
    const run = sides.reduce(applyBattleResult, newRun(123, "run-1"));

    expect(runSubmission(run, "  Martin ")).toEqual({
      runId: "run-1",
      name: "Martin",
      outcome: "defeat",
      wins: 2,
      lives: 0,
      rounds: 5,
      results: ["win", "loss", "loss", "win", "loss"],
    });
  });
});
