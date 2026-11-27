import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchHallOfFame,
  fetchOpponent,
  HALL_OF_FAME_ERRORS,
  parseEntry,
  parseHallOfFame,
  parseOpponent,
  parseSavedRun,
  SEARCH_ERRORS,
  submitRun,
} from "../api";
import type { RunSubmission } from "../types";

const valid = {
  id: "mossback-hermit",
  name: "Mossback Hermit",
  icon: "🐢",
  hp: 25,
  items: ["chipped-dagger", "pot-lid"],
  round: 1,
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** A fetch that only settles when its signal aborts, like a server that never answers. */
const hangingFetch = (_url: string, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });

describe("parseOpponent", () => {
  it("accepts a valid opponent for the requested round", () => {
    expect(parseOpponent(valid, 1)).toEqual(valid);
  });

  it.each([
    ["not an object", "opponent"],
    ["null", null],
    ["a missing name", { ...valid, name: undefined }],
    ["an empty id", { ...valid, id: " " }],
    ["hp of 0", { ...valid, hp: 0 }],
    ["fractional hp", { ...valid, hp: 2.5 }],
    ["hp as text", { ...valid, hp: "25" }],
    ["items that aren't a list", { ...valid, items: "pot-lid" }],
    ["an unknown item", { ...valid, items: ["chipped-dagger", "laser-sword"] }],
    ["more items than a backpack holds", { ...valid, items: Array(7).fill("pot-lid") }],
    ["another round", { ...valid, round: 2 }],
  ])("rejects %s", (_case, data) => {
    expect(parseOpponent(data, 1)).toBeNull();
  });
});

describe("fetchOpponent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the validated opponent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, valid)));

    await expect(fetchOpponent(1)).resolves.toEqual(valid);
  });

  it("passes on the server's error text", async () => {
    const error = "The arena gates are shut. No challenger answered the call.";
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(503, { error })));

    await expect(fetchOpponent(1)).rejects.toThrow(error);
  });

  it("explains an error status without error text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Bad gateway", { status: 502 })));

    await expect(fetchOpponent(1)).rejects.toThrow(`${SEARCH_ERRORS.unreachable} (status 502)`);
  });

  it("rejects an invalid opponent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { ...valid, items: ["laser-sword"] })));

    await expect(fetchOpponent(1)).rejects.toThrow(SEARCH_ERRORS.invalid);
  });

  it("explains a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));

    await expect(fetchOpponent(1)).rejects.toThrow(SEARCH_ERRORS.unreachable);
  });

  it("gives up when no answer arrives in time", async () => {
    vi.stubGlobal("fetch", vi.fn(hangingFetch));

    await expect(fetchOpponent(1, undefined, 10)).rejects.toThrow(SEARCH_ERRORS.timeout);
  });

  it("stops when the search is cancelled", async () => {
    vi.stubGlobal("fetch", vi.fn(hangingFetch));
    const controller = new AbortController();

    const search = fetchOpponent(1, controller.signal);
    controller.abort();

    await expect(search).rejects.toThrow(SEARCH_ERRORS.cancelled);
  });
});

const entry = {
  id: "0b9c6a4e-6f1e-4c55-9a39-2f0f5f3c1d2a",
  name: "Martin",
  outcome: "victory",
  wins: 5,
  lives: 2,
  rounds: 6,
};

describe("parseEntry", () => {
  it("accepts a valid entry", () => {
    expect(parseEntry(entry)).toEqual(entry);
  });

  it.each([
    ["not an object", "entry"],
    ["null", null],
    ["a missing name", { ...entry, name: undefined }],
    ["an unknown outcome", { ...entry, outcome: "draw" }],
    ["negative wins", { ...entry, wins: -1 }],
    ["fractional lives", { ...entry, lives: 1.5 }],
    ["rounds as text", { ...entry, rounds: "6" }],
  ])("rejects %s", (_case, data) => {
    expect(parseEntry(data)).toBeNull();
  });
});

describe("parseHallOfFame", () => {
  it("accepts an empty list", () => {
    expect(parseHallOfFame([])).toEqual([]);
  });

  it("accepts a list of valid entries in the server's order", () => {
    const second = { ...entry, id: "second", wins: 3 };

    expect(parseHallOfFame([entry, second])).toEqual([entry, second]);
  });

  it("rejects a list with one malformed entry", () => {
    expect(parseHallOfFame([entry, { ...entry, wins: "5" }])).toBeNull();
  });

  it("rejects anything that isn't a list", () => {
    expect(parseHallOfFame({ entries: [entry] })).toBeNull();
  });
});

describe("parseSavedRun", () => {
  it("accepts the entry of the sent run with its rank", () => {
    expect(parseSavedRun({ entry, rank: 3 }, entry.id)).toEqual({ entry, rank: 3 });
  });

  it.each([
    ["an entry of another run", { entry: { ...entry, id: "other" }, rank: 1 }],
    ["a malformed entry", { entry: { ...entry, name: "" }, rank: 1 }],
    ["a rank of 0", { entry, rank: 0 }],
    ["a missing rank", { entry }],
  ])("rejects %s", (_case, data) => {
    expect(parseSavedRun(data, entry.id)).toBeNull();
  });
});

describe("fetchHallOfFame", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the validated list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, [entry])));

    await expect(fetchHallOfFame()).resolves.toEqual([entry]);
  });

  it("passes on the server's error text", async () => {
    const error = "The hall of fame is closed. Try again in a moment.";
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(503, { error })));

    await expect(fetchHallOfFame()).rejects.toThrow(error);
  });

  it("rejects an unreadable list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { entries: [entry] })));

    await expect(fetchHallOfFame()).rejects.toThrow(HALL_OF_FAME_ERRORS.invalid);
  });

  it("gives up when no answer arrives in time", async () => {
    vi.stubGlobal("fetch", vi.fn(hangingFetch));

    await expect(fetchHallOfFame(undefined, 10)).rejects.toThrow(HALL_OF_FAME_ERRORS.timeout);
  });
});

describe("submitRun", () => {
  const submission: RunSubmission = {
    runId: entry.id,
    name: "Martin",
    outcome: "victory",
    wins: 5,
    lives: 2,
    rounds: 6,
    results: ["win", "loss", "win", "win", "win", "win"],
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the run as JSON and returns the stored entry with its rank", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(201, { entry, rank: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(submitRun(submission)).resolves.toEqual({ entry, rank: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/runs");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(submission);
  });

  it("passes on the server's reason for a rejected run", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(400, { error: "name must not be empty" })));

    await expect(submitRun(submission)).rejects.toThrow("name must not be empty");
  });

  it("rejects an answer about another run", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(201, { entry: { ...entry, id: "other" }, rank: 1 })));

    await expect(submitRun(submission)).rejects.toThrow(HALL_OF_FAME_ERRORS.invalid);
  });

  it("explains a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));

    await expect(submitRun(submission)).rejects.toThrow(HALL_OF_FAME_ERRORS.unreachable);
  });

  it("gives up when no answer arrives in time", async () => {
    vi.stubGlobal("fetch", vi.fn(hangingFetch));

    await expect(submitRun(submission, 10)).rejects.toThrow(HALL_OF_FAME_ERRORS.timeout);
  });
});
