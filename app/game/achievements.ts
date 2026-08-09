export type AchievementMetric = "maxDistance";

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  metric: AchievementMetric;
  /** Threshold in world pixels; 10px = 1 displayed meter. */
  threshold: number;
}

// Data-driven so new achievements (new metrics or thresholds) slot in without
// touching gameplay code. Distances are stored in world pixels.
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-swim", name: "First Swim", description: "Swim 100m from home", metric: "maxDistance", threshold: 1000 },
  { id: "getting-brave", name: "Getting Brave", description: "Swim 500m from home", metric: "maxDistance", threshold: 5000 },
  { id: "beyond-the-reef", name: "Beyond the Reef", description: "Swim 1,000m from home", metric: "maxDistance", threshold: 10000 },
  { id: "into-the-current", name: "Into the Current", description: "Swim 2,500m from home", metric: "maxDistance", threshold: 25000 },
  { id: "deep-explorer", name: "Deep Explorer", description: "Swim 5,000m from home", metric: "maxDistance", threshold: 50000 },
  { id: "where-no-fish-should-go", name: "Where No Fish Should Go", description: "Swim 10,000m from home", metric: "maxDistance", threshold: 100000 },
];

export interface AchievementProgress {
  maxDistance: number;
}

/** Returns definitions newly earned given current progress and already-unlocked ids. */
export function newlyEarnedAchievements(unlocked: string[], progress: AchievementProgress): AchievementDef[] {
  return ACHIEVEMENTS.filter((def) => !unlocked.includes(def.id) && progress[def.metric] >= def.threshold);
}
