import { MAX_ACTIVE_SCHOOLS, SaveData, SCHOOL_ORDER, SchoolId, STARTER_SAVE } from "./model";

const SAVE_KEY = "food-run-beneath-the-current-v1";

export function loadSave(): SaveData {
  if (typeof window === "undefined") return STARTER_SAVE;
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return structuredClone(STARTER_SAVE);
    const base = structuredClone(STARTER_SAVE);
    // Merge each school individually so saves written before feeding, buildings,
    // or discovery existed still gain those fields instead of dropping them.
    const schools = { ...base.schools };
    for (const id of SCHOOL_ORDER) {
      const saved = parsed.schools?.[id];
      if (saved && typeof saved === "object") schools[id] = { ...schools[id], ...saved };
      // Any school an older save had already levelled up counts as found.
      if (schools[id].level > 1 || schools[id].food > 0) schools[id].discovered = true;
    }
    const active = Array.isArray(parsed.activeSchools)
      ? parsed.activeSchools.filter((id: SchoolId) => SCHOOL_ORDER.includes(id))
      : SCHOOL_ORDER.filter((id) => schools[id].discovered);
    const activeSchools = (active.length ? active : ["reef" as SchoolId]).slice(0, MAX_ACTIVE_SCHOOLS);
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...parsed.settings },
      schools,
      activeSchools,
      stats: { ...base.stats, ...parsed.stats },
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
