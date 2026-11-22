import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOpponent, parseOpponent, SEARCH_ERRORS } from "./api";

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
