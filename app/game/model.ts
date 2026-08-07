import type { EnemyKind, EnemyTier } from "./enemies";
import type { TalentId } from "./talents";

export type Phase = "title" | "home" | "playing" | "results" | "defeat";
export type PredatorState =
  | "PATROL"
  | "SUSPICIOUS"
  | "INVESTIGATE"
  | "SEARCH"
  | "CHASE"
  | "LOST TARGET"
  | "RETURN";

export type PickupKind = "food" | "junk";
export type FishType = "swift" | "forager";
export type SchoolId = "reef" | "deep";

export const FISH_TYPES: Record<FishType, { name: string; speed: number; bagBonus: number; description: string }> = {
  swift: { name: "Swift Fish", speed: 1.16, bagBonus: -2, description: "Fast currents and cleaner escapes, but a lighter bag." },
  forager: { name: "Forager Fish", speed: 0.88, bagBonus: 3, description: "A slower swimmer built for valuable, heavy returns." },
};

export const SCHOOLS: Record<SchoolId, { name: string; location: string; requiredBase: number; description: string }> = {
  reef: { name: "Sunbeam Shoal", location: "Shallow Reef", requiredBase: 12, description: "A safe young school learning to thrive." },
  deep: { name: "Midnight Shoal", location: "Deep Water", requiredBase: 20, description: "A distant school surviving beyond the kelp." },
};

export interface SchoolProgress { level: number; food: number; population: number; }

export interface Pickup {
  id: string;
  x: number;
  y: number;
  kind: PickupKind;
  subtype: "plankton" | "shrimp" | "algae" | "glowfruit" | "plastic" | "metal" | "glass";
  size: number;
  value: number;
  collected: boolean;
  rare?: boolean;
}

export interface Cover {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type HazardKind = "jellyfish" | "net" | "vent";

export interface Hazard {
  id: string;
  kind: HazardKind;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  phase: number;
}

export interface Shark {
  id: string;
  x: number;
  y: number;
  vx: number;
  homeX: number;
  state: PredatorState;
  stateTime: number;
  facing: 1 | -1;
  lastKnownX: number;
  lastKnownY: number;
  attackCooldown: number;
  alert: number;
  kind: EnemyKind;
  tier: EnemyTier;
  warned: boolean;
}

export interface Chunk {
  index: number;
  pickups: Pickup[];
  covers: Cover[];
  sharks: Shark[];
  rocks: { x: number; y: number; r: number; variant: number }[];
  hazards: Hazard[];
  current: number;
}

export interface RunStats {
  food: number;
  salvage: number;
  distance: number;
  predatorsEscaped: number;
  creaturesHelped: number;
  rareDiscoveries: number;
  duration: number;
}

export interface SaveData {
  level: number;
  xp: number;
  bankedFood: number;
  salvage: number;
  bagLevel: number;
  successfulRuns: number;
  tutorialComplete: boolean;
  reefLevel: number;
  fishType: FishType;
  selectedSchool: SchoolId;
  schools: Record<SchoolId, SchoolProgress>;
  unlockedTalents: TalentId[];
  settings: {
    reducedMotion: boolean;
    highContrast: boolean;
    textScale: number;
    sound: boolean;
    music: boolean;
  };
}

export const WORLD = {
  chunkWidth: 900,
  surfaceY: 72,
  floorY: 660,
  playerRadius: 17,
  baseBagCapacity: 8,
  bagCapacityPerLevel: 4,
  dayLength: 110,
};

export const STARTER_SAVE: SaveData = {
  level: 1,
  xp: 0,
  bankedFood: 0,
  salvage: 0,
  bagLevel: 0,
  successfulRuns: 0,
  tutorialComplete: false,
  reefLevel: 0,
  fishType: "swift",
  selectedSchool: "reef",
  schools: { reef: { level: 1, food: 0, population: 8 }, deep: { level: 1, food: 0, population: 5 } },
  unlockedTalents: [],
  settings: {
    reducedMotion: false,
    highContrast: false,
    textScale: 1,
    sound: true,
    music: true,
  },
};

export const TUTORIAL_STEPS = [
  "Swim with WASD or the arrow keys",
  "Collect a glowing food cluster",
  "Hold Shift or Space to burst through the current",
  "Press E inside seaweed to hide",
  "Slip past the shark while it searches",
  "Find the whale and press E to receive help",
  "Collect ocean junk for crafting",
  "Follow the HOME marker and press E at the reef",
] as const;

export const getBagCapacity = (save: SaveData) =>
  WORLD.baseBagCapacity + save.bagLevel * WORLD.bagCapacityPerLevel + FISH_TYPES[save.fishType].bagBonus + (save.unlockedTalents.includes("deep-pockets") ? 2 : 0);

export const xpForLevel = (level: number) => 80 + (level - 1) * 55;

export function bankRunProgress(save: SaveData, run: RunStats) {
  const schoolId = save.selectedSchool;
  const foodDelivered = run.food + (save.fishType === "forager" && run.food >= 4 ? 1 : 0);
  const earnedXp = Math.round(foodDelivered * 10 + run.salvage * 5 + Math.min(run.distance / 25, 65) + run.creaturesHelped * 18 + run.predatorsEscaped * 9);
  const next = { ...save };
  const school = { ...next.schools[schoolId] };
  school.food += foodDelivered;
  const required = SCHOOLS[schoolId].requiredBase + (school.level - 1) * 10;
  let schoolLevelGained = false;
  while (school.food >= required + (school.level - 1) * 6) {
    school.food -= required + (school.level - 1) * 6;
    school.level += 1;
    school.population += schoolId === "reef" ? 5 : 7;
    schoolLevelGained = true;
  }
  next.schools = { ...next.schools, [schoolId]: school };
  next.bankedFood += foodDelivered;
  next.salvage += run.salvage;
  next.xp += earnedXp;
  next.successfulRuns += 1;
  next.reefLevel = next.schools.reef.level;
  let levelGained = false;
  while (next.xp >= xpForLevel(next.level)) {
    next.xp -= xpForLevel(next.level);
    next.level += 1;
    levelGained = true;
  }
  return { save: next, earnedXp, levelGained, foodDelivered, schoolLevelGained, schoolId };
}
