import { describe, expect, it } from "vitest";
import {
  advanceReplay,
  editName,
  fightBlocker,
  isReplayDone,
  leaveBattle,
  newGame,
  searchFailed,
  showFrame,
  skipReplay,
  startBattle,
  startSearch,
  startSubmit,
  submitBlocker,
  submitFailed,
  submitSucceeded,
  updateRun,
} from "../game";
import { getItem } from "../items";
import { applyBattleResult, buyItem, moveItem, rerollShop, runOutcome, sellItem } from "../run";
import { loadGame, readSave, RELOAD_MESSAGES, SAVE_VERSION, toSave } from "../save";
import { BACKPACK_SIZE, mulberry32, SHOP_SIZE } from "../shop";
import type { GameState, Opponent, RunState, SaveData, SavedRun, Side } from "../types";

const RUN_ID = "0b6f7c9e-2d5a-4c1b-9e3f-8a7d6c5b4a39";

/** A test opponent. With two Hunting Bows it knocks out a hero who only heals. */
const opponentFor = (round: number, hp = 60): Opponent => ({
  id: "test-ogre",
  name: "Test Ogre",
  icon: "👹",
  hp,
  round,
  items: ["hunting-bow", "hunting-bow"],
});

/** A fresh game whose backpack holds these items, paid with the start gold. */
function gameWith(itemIds: string[]): GameState {
  const game = newGame(7, RUN_ID);
  const backpack = game.run.backpack.map((_, index) => (itemIds[index] ? { uid: `item-${index + 1}`, itemId: itemIds[index] } : null));
  const price = itemIds.reduce((sum, itemId) => sum + getItem(itemId).price, 0);
  return { ...game, run: { ...game.run, gold: game.run.gold - price, backpack, nextUid: itemIds.length + 1 } };
}

const fight = (game: GameState, opponent = opponentFor(game.run.round)) =>
  startBattle(startSearch(game, "search-1"), "search-1", opponent);

/** A battle the hero loses: a Healing Herb can't hurt the opponent. */
const lostBattle = () => fight(gameWith(["healing-herb"]));

/** A run that ended with three lost battles, on the result screen. */
function finishedGame(): GameState {
  const game = gameWith(["healing-herb"]);
  const losses: Side[] = ["opponent", "opponent", "opponent"];
  return { ...game, phase: "finished", run: losses.reduce(applyBattleResult, game.run) };
}

const savedEntry = { entry: { id: RUN_ID, name: "Zoë", outcome: "defeat" as const, wins: 0, lives: 0, rounds: 3 }, rank: 4 };
const sendingGame = () => startSubmit(editName(finishedGame(), "Zoë"));
const savedGame = () => submitSucceeded(sendingGame(), RUN_ID, savedEntry);

/** Saves the game and loads it again, like a reload. */
const reload = (game: GameState) => loadGame(JSON.stringify(toSave(game))).game;

describe("a reload continues every screen", () => {
  it("continues the shop exactly as it was, so a reload is no free reroll", () => {
    let game = newGame(7, RUN_ID);
    game = updateRun(game, (run) => buyItem(run, 0));
    game = updateRun(game, rerollShop);
    game = updateRun(game, (run) => moveItem(run, 0, 4));

    expect(reload(game)).toEqual(game);
  });

  it("turns a running search into a cancelled one: same shop, a message and a retry", () => {
    const shop = gameWith(["hunting-bow"]);
    const resumed = reload(startSearch(shop, "search-1"))!;

    expect(resumed).toMatchObject({ phase: "shop", searchId: null, error: RELOAD_MESSAGES.search, battle: null });
    expect(resumed.run).toEqual(shop.run);
    expect(fightBlocker(resumed)).toBeNull();
    expect(startBattle(resumed, "search-1", opponentFor(1))).toBe(resumed);
  });

  it("continues a battle at the saved frame, with the same opponent and result", () => {
    const battle = showFrame(lostBattle(), 3);
    const resumed = reload(battle)!;

    expect(resumed.phase).toBe("battle");
    expect(resumed.battle).toEqual({ ...battle.battle, resumed: true });
    expect(resumed.run).toEqual(battle.run);
  });

  it("keeps the result of a battle that was saved after its last frame, without adding it again", () => {
    const ended = skipReplay(lostBattle());
    const resumed = reload(ended)!;

    expect(resumed.run).toEqual(ended.run);
    expect(resumed.run.results).toEqual(["loss"]);
    expect(leaveBattle(skipReplay(resumed))).toMatchObject({ phase: "shop", run: { round: 2, lives: 2 } });
  });

  it("keeps the result screen with the typed name", () => {
    const game = editName(finishedGame(), "Zoë");

    expect(reload(game)).toEqual(game);
  });

  it("turns a reload while sending into a failed attempt that keeps the name", () => {
    const resumed = reload(sendingGame())!;

    expect(resumed.submission).toEqual({ name: "Zoë", status: "editing", error: RELOAD_MESSAGES.submit, saved: null });
    expect(submitBlocker(resumed)).toBeNull();
  });

  it("keeps a saved hall of fame entry, so the run is never sent again", () => {
    const resumed = reload(savedGame())!;

    expect(resumed.submission.saved).toEqual(savedEntry);
    expect(submitBlocker(resumed)).toBe("Already in the hall of fame");
  });
});

describe("a reload never changes a result", () => {
  it("ends a lost battle with exactly that loss, whatever frame the reload happens at", () => {
    const battle = lostBattle();
    const lastFrame = battle.battle!.result.frames.length - 1;
    const withoutReload = leaveBattle(skipReplay(battle));

    expect(withoutReload.run.results).toEqual(["loss"]);
    for (let frame = 0; frame <= lastFrame; frame++) {
      const resumed = reload(showFrame(battle, frame))!;
      expect(resumed.battle).toMatchObject({ frame, resumed: true });
      // A second reload after the end must not add the result again.
      const after = leaveBattle(skipReplay(reload(skipReplay(resumed))!));
      expect(after.run).toEqual(withoutReload.run);
      expect(after.phase).toBe(withoutReload.phase);
    }
  });

  it("keeps a won battle won", () => {
    const battle = fight(gameWith(["chipped-dagger", "hunting-bow"]), opponentFor(1, 1));

    expect(leaveBattle(skipReplay(reload(battle)!)).run.results).toEqual(["win"]);
  });
});

describe("another tab's save", () => {
  it.each([
    ["shop", gameWith(["hunting-bow"])],
    ["search", startSearch(gameWith(["hunting-bow"]), "search-1")],
    ["battle", showFrame(lostBattle(), 2)],
    ["ended battle", skipReplay(lostBattle())],
    ["submission", sendingGame()],
    ["saved run", savedGame()],
  ])("takes over the %s as it is and saves it back unchanged", (_, game) => {
    const raw = JSON.stringify(toSave(game));
    const { game: taken } = readSave(raw);

    expect(taken).toEqual(game);
    expect(JSON.stringify(toSave(taken!))).toBe(raw);
  });
});

/** The hall of fame's answer for a finished run. */
const entryFor = (run: RunState): SavedRun => ({
  entry: { id: run.runId, name: "Zoë", outcome: runOutcome(run)!, wins: run.wins, lives: run.lives, rounds: run.round },
  rank: 1,
});

/** One random click of a player: in the shop, during the search and the replay, and on the result screen. */
function randomStep(game: GameState, random: () => number): GameState {
  const pick = (count: number) => Math.floor(random() * count);
  switch (game.phase) {
    case "shop": {
      if (fightBlocker(game) === null && random() < 0.3) return startSearch(game, "search-1");
      const actions = [
        (run: RunState) => buyItem(run, pick(SHOP_SIZE)),
        (run: RunState) => sellItem(run, pick(BACKPACK_SIZE)),
        rerollShop,
        (run: RunState) => moveItem(run, pick(BACKPACK_SIZE), pick(BACKPACK_SIZE)),
      ];
      return updateRun(game, actions[pick(actions.length)]);
    }
    case "searching":
      if (random() < 0.1) return searchFailed(game, "search-1", "No opponent answered.");
      return startBattle(game, "search-1", opponentFor(game.run.round, 10 + pick(80)));
    case "battle":
      if (game.battle && isReplayDone(game.battle)) return leaveBattle(game);
      return random() < 0.05 ? skipReplay(game) : advanceReplay(game);
    case "finished":
      if (game.submission.status === "sending") {
        return random() < 0.3 ? submitFailed(game, RUN_ID, "The hall of fame is closed.") : submitSucceeded(game, RUN_ID, entryFor(game.run));
      }
      return game.submission.name === "" ? editName(game, "Zoë") : startSubmit(game);
  }
}

describe("every state that playing can reach", () => {
  it("is accepted and kept by a reload, in 100 randomly played runs", () => {
    const random = mulberry32(2026);
    const endings = new Set<string>();

    for (let n = 0; n < 100; n++) {
      let game = newGame(Math.floor(random() * 2 ** 32), RUN_ID);
      // The step limit ends a run that got stuck in the shop without items and gold.
      for (let step = 0; step < 2000 && game.submission.status !== "saved"; step++) {
        game = random() < 0.03 ? reload(game)! : randomStep(game, random);
        const raw = JSON.stringify(toSave(game));
        const { game: read, problem } = readSave(raw);
        expect(problem, raw).toBeNull();
        expect(JSON.stringify(toSave(read!))).toBe(raw);
        const resumed = reload(game)!;
        expect(resumed.run).toEqual(game.run);
        expect(resumed.battle?.result).toEqual(game.battle?.result);
      }
      endings.add(String(runOutcome(game.run)));
    }
    // Both ways a run can end were played.
    expect([...endings]).toEqual(expect.arrayContaining(["victory", "defeat"]));
  });
});

/** The save as JSON, with the given values replaced. */
function changed(save: SaveData, ...changes: [path: (string | number)[], value: unknown][]): string {
  const copy: unknown = JSON.parse(JSON.stringify(save));
  for (const [path, value] of changes) {
    let target = copy as Record<string | number, unknown>;
    for (const key of path.slice(0, -1)) target = target[key] as Record<string | number, unknown>;
    target[path[path.length - 1]] = value;
  }
  return JSON.stringify(copy);
}

describe("broken saves are discarded", () => {
  const shop = toSave(gameWith(["hunting-bow", "chipped-dagger"]));
  const battle = toSave(showFrame(lostBattle(), 2));
  const ended = toSave(skipReplay(lostBattle()));
  const finished = toSave(savedGame());
  const lastFrame = lostBattle().battle!.result.frames.length - 1;

  it("starts without a run and without a message when there is no save", () => {
    expect(loadGame(null)).toEqual({ game: null, discarded: false });
  });

  it.each([
    ["empty text", "", "not JSON"],
    ["cut-off JSON", JSON.stringify(shop).slice(0, 40), "not JSON"],
    ["null", "null", "must be an object"],
    ["a list", "[]", "must be an object"],
    ["another version", changed(shop, [["version"], SAVE_VERSION + 1]), `version ${SAVE_VERSION + 1}`],
    ["no version", changed(shop, [["version"], undefined]), "version undefined"],
    ["unknown phase", changed(shop, [["phase"], "paused"]), "unknown phase"],
    ["no run", changed(shop, [["run"], undefined]), "run must be an object"],
    ["run id not a UUID", changed(shop, [["run", "runId"], "run-1"]), "runId"],
    ["run id in capitals", changed(shop, [["run", "runId"], RUN_ID.toUpperCase()]), "runId"],
    ["round 0", changed(shop, [["run", "round"], 0]), "round must be a whole number"],
    ["half a round", changed(shop, [["run", "round"], 1.5]), "round must be a whole number"],
    ["negative gold", changed(shop, [["run", "gold"], -1]), "gold must be"],
    ["gold as text", changed(shop, [["run", "gold"], "4"]), "gold must be"],
    ["seed too big", changed(shop, [["run", "seed"], 2 ** 32]), "seed"],
    ["nextUid 0", changed(shop, [["run", "nextUid"], 0]), "nextUid"],
    ["three shop offers", changed(shop, [["run", "shop"], shop.run.shop.slice(1)]), "shop"],
    ["unknown offer", changed(shop, [["run", "shop", 0], "golden-sword"]), "shop"],
    ["five backpack slots", changed(shop, [["run", "backpack"], shop.run.backpack.slice(1)]), "backpack must have"],
    ["unknown item", changed(shop, [["run", "backpack", 0, "itemId"], "golden-sword"]), "catalog"],
    ["broken uid", changed(shop, [["run", "backpack", 0, "uid"], "sword"]), "uid"],
    ["uid not given out yet", changed(shop, [["run", "backpack", 0, "uid"], "item-9"]), "uid"],
    ["uid twice", changed(shop, [["run", "backpack", 1, "uid"], "item-1"]), "own uid"],
    ["unknown result", changed(finished, [["run", "results", 0], "draw"]), "results may only"],
    ["results after the end", changed(finished, [["run", "results"], ["loss", "loss", "loss", "win"]], [["run", "wins"], 1], [["run", "round"], 4]), "go on after"],
    ["wins don't fit", changed(ended, [["run", "wins"], 1]), "wins and lives"],
    ["lives don't fit", changed(ended, [["run", "lives"], 3]), "wins and lives"],
    ["round doesn't fit", changed(ended, [["run", "round"], 3]), "round must follow"],
    ["more gold than earned", changed(shop, [["run", "gold"], 11]), "worth more"],
    ["six Greater Tonics in round 1", changed(shop, [["run", "gold"], 0], [["run", "nextUid"], 7], [["run", "backpack"], [1, 2, 3, 4, 5, 6].map((n) => ({ uid: `item-${n}`, itemId: "greater-tonic" }))]), "worth more"],
    ["shop after the run ended", changed(finished, [["phase"], "shop"], [["submission"], { name: "", status: "editing", saved: null }]), "phase doesn't fit"],
    ["result screen during the run", changed(shop, [["phase"], "finished"]), "phase doesn't fit"],
    ["search without id", changed(shop, [["phase"], "searching"]), "only a running search"],
    ["search id in the shop", changed(shop, [["searchId"], "search-1"]), "only a running search"],
    ["search id as a number", changed(shop, [["phase"], "searching"], [["searchId"], 42]), "search id must be text"],
    ["battle in the shop", changed(shop, [["battle"], battle.battle]), "only the battle phase"],
    ["battle phase without battle", changed(battle, [["battle"], null]), "needs a battle"],
    ["opponent with an unknown item", changed(battle, [["battle", "opponent", "items", 0], "golden-sword"]), "valid opponent"],
    ["opponent of another round", changed(battle, [["battle", "opponent", "round"], 7]), "valid opponent"],
    ["opponent without HP", changed(battle, [["battle", "opponent", "hp"], 0]), "valid opponent"],
    ["negative frame", changed(battle, [["battle", "frame"], -1]), "frame"],
    ["frame after the end", changed(battle, [["battle", "frame"], 999]), "frame"],
    ["last frame without the result", changed(battle, [["battle", "frame"], lastFrame]), "exactly from its last frame"],
    ["result before the last frame", changed(ended, [["battle", "frame"], 0]), "exactly from its last frame"],
    ["wrong result of the battle", changed(ended, [["run", "results"], ["win"]], [["run", "wins"], 1], [["run", "lives"], 3]), "this battle's"],
    ["no submission", changed(shop, [["submission"], undefined]), "submission must be an object"],
    ["unknown status", changed(finished, [["submission", "status"], "lost"]), "known status"],
    ["name during the run", changed(shop, [["submission", "name"], "Ana"]), "only a finished run"],
    ["saved without entry", changed(finished, [["submission", "saved"], null]), "belongs to the status saved"],
    ["entry of another run", changed(finished, [["submission", "saved", "entry", "id"], "1b9c6a4e-6f1e-4c55-9a39-2f0f5f3c1d2a"]), "not valid for this run"],
    ["entry while editing", changed(finished, [["submission", "status"], "editing"]), "belongs to the status saved"],
  ])("%s", (_, raw, problem) => {
    const read = readSave(raw);

    expect(read.game).toBeNull();
    expect(read.problem).toContain(problem);
    expect(loadGame(raw)).toEqual({ game: null, discarded: true });
  });

  it("never throws, and every save it accepts is saved again unchanged, for 5,000 randomly damaged saves", () => {
    const random = mulberry32(6);
    const pick = <T,>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
    const values: unknown[] = [undefined, null, -1, 0, 1, 2.5, 2 ** 32, "", "x", "win", "item-1", true, [], {}];
    const paths = (value: unknown, path: (string | number)[] = []): (string | number)[][] =>
      typeof value === "object" && value !== null
        ? Object.entries(value).flatMap(([key, child]) => [[...path, Array.isArray(value) ? Number(key) : key], ...paths(child, [...path, Array.isArray(value) ? Number(key) : key])])
        : [];
    const bases = [shop, battle, ended, finished, toSave(startSearch(gameWith(["pot-lid"]), "search-1"))];
    let accepted = 0;

    for (let n = 0; n < 5000; n++) {
      const base = pick(bases);
      const raw = changed(base, [pick(paths(base)), pick(values)]);
      expect(() => loadGame(raw)).not.toThrow();
      const { game } = readSave(raw);
      if (!game) continue;
      accepted += 1;
      expect(readSave(JSON.stringify(toSave(game))).game).toEqual(game);
    }
    // Some damage is harmless (e.g. another search id), most is caught.
    expect(accepted).toBeGreaterThan(0);
    expect(accepted).toBeLessThan(5000);
  });
});
