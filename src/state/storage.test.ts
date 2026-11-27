import { afterEach, expect, it, vi } from "vitest";
import { SAVE_KEY } from "../save";
import { readStoredSave, removeStoredSave, writeStoredSave } from "./storage";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A `localStorage` stand-in that keeps its entries in a Map. */
function memoryStorage(entries = new Map<string, string>()): Storage {
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => {
      entries.delete(key);
    },
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

it("writes, reads and removes the save under its key", () => {
  const entries = new Map<string, string>();
  vi.stubGlobal("localStorage", memoryStorage(entries));

  writeStoredSave("{}");
  expect(entries.get(SAVE_KEY)).toBe("{}");
  expect(readStoredSave()).toBe("{}");

  removeStoredSave();
  expect(readStoredSave()).toBeNull();
});

it("keeps the game working when the storage is missing", () => {
  vi.stubGlobal("localStorage", undefined);

  expect(readStoredSave()).toBeNull();
  expect(() => writeStoredSave("{}")).not.toThrow();
  expect(() => removeStoredSave()).not.toThrow();
});

it("keeps the game working when the storage is blocked or full", () => {
  const failing = memoryStorage();
  const fail = () => {
    throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
  };
  vi.stubGlobal("localStorage", { ...failing, getItem: fail, setItem: fail, removeItem: fail });

  expect(readStoredSave()).toBeNull();
  expect(() => writeStoredSave("{}")).not.toThrow();
  expect(() => removeStoredSave()).not.toThrow();
});
