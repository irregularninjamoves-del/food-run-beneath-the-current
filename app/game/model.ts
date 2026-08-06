import type { EnemyKind, EnemyTier } from "./enemies";

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
  WORLD.baseBagCapacity + save.bagLevel * WORLD.bagCapacityPerLevel;

export const xpForLevel = (level: number) => 80 + (level - 1) * 55;

export function bankRunProgress(save: SaveData, run: RunStats) {
  const earnedXp = Math.round(run.food * 9 + run.salvage * 5 + Math.min(run.distance / 28, 60) + run.creaturesHelped * 18 + run.predatorsEscaped * 9);
  const next = { ...save };
  next.bankedFood += run.food;
  next.salvage += run.salvage;
  next.xp += earnedXp;
  next.successfulRuns += 1;
  next.reefLevel = Math.min(3, Math.floor(next.bankedFood / 18));
  let levelGained = false;
  while (next.xp >= xpForLevel(next.level)) {
    next.xp -= xpForLevel(next.level);
    next.level += 1;
    levelGained = true;
  }
  return { save: next, earnedXp, levelGained };
}
