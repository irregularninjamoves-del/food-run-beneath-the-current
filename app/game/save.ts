import { SaveData, STARTER_SAVE } from "./model";

const SAVE_KEY = "food-run-beneath-the-current-v1";

export function loadSave(): SaveData {
  if (typeof window === "undefined") return STARTER_SAVE;
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return structuredClone(STARTER_SAVE);
    return {
      ...structuredClone(STARTER_SAVE),
      ...parsed,
      settings: { ...STARTER_SAVE.settings, ...parsed.settings },
      schools: { ...STARTER_SAVE.schools, ...parsed.schools },
      stats: { ...STARTER_SAVE.stats, ...parsed.stats },
    };
  } catch {
    return structuredClone(STARTER_SAVE);
  }
}

export function persistSave(save: SaveData) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Progress remains valid for the current session when storage is unavailable.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
