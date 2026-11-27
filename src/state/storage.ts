import { SAVE_KEY } from "../save";

/**
 * Access to the save in `localStorage` (B6). The storage can be missing, blocked or full
 * (e.g. in private browsing); then the game isn't saved, but it keeps working.
 */

export function readStoredSave(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredSave(raw: string): void {
  try {
    localStorage.setItem(SAVE_KEY, raw);
  } catch {
    // Full or blocked: the game goes on without saving.
  }
}

export function removeStoredSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Blocked: there is nothing to remove.
  }
}
