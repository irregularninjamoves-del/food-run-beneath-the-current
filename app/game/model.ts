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

export type PickupKind = "food" | "junk" | "bubble";
export type FishType = "swift" | "forager";
export type SchoolId = "reef" | "deep";

export const FISH_TYPES: Record<FishType, {
  name: string;
  speed: number;
  bagBonus: number;
  staminaRegen: number;
  burstCost: number;
  gatherRadius: number;
  description: string;
}> = {
  swift: {
    name: "Swift Fish",
    speed: 1.18,
    bagBonus: -2,
    staminaRegen: 1.35,
    burstCost: 0.85,
    gatherRadius: 30,
    description: "Fast, hard to catch, quick to recover — but the bag stays light.",
  },
  forager: {
    name: "Forager Fish",
    speed: 0.88,
    bagBonus: 3,
    staminaRegen: 1,
    burstCost: 1.1,
    gatherRadius: 46,
    description: "A wide reach and heavy hauls — every 4 food delivered feeds 1 extra.",
  },
};

export const SCHOOLS: Record<SchoolId, { name: string; location: string; requiredBase: number; description: string }> = {
  reef: { name: "Sunbeam Shoal", location: "Shallow Reef", requiredBase: 12, description: "A safe young school learning to thrive." },
  deep: { name: "Midnight Shoal", location: "Deep Water", requiredBase: 20, description: "A distant school surviving beyond the kelp." },
};

export interface SchoolProgress { level: number; food: number; population: number; }

export interface SchoolPerkDef { level: number; name: string; description: string }

export const SCHOOL_PERKS: Record<SchoolId, SchoolPerkDef[]> = {
  reef: [
    { level: 2, name: "Bubble Craft", description: "+1 bubble decoy every dive" },
    { level: 3, name: "Reef Vigor", description: "+15 maximum stamina" },
    { level: 4, name: "Guardian Bond", description: "+1 heart every dive" },
    { level: 5, name: "Resonant Pop", description: "Bubble pops reach 40% farther" },
  ],
  deep: [
    { level: 2, name: "Glow Harvest", description: "Rare food is worth +1" },
    { level: 3, name: "Echo Tuning", description: "Sonar recharges 3s sooner" },
    { level: 4, name: "Abyss Grace", description: "Bursting drains 20% less stamina" },
    { level: 5, name: "Deep Charge", description: "Bubble craft effects last 50% longer" },
  ],
};

export interface Pickup {
  id: string;
  x: number;
  y: number;
  kind: PickupKind;
  subtype: "plankton" | "shrimp" | "algae" | "glowfruit" | "plastic" | "metal" | "glass" | "bubblepearl";
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
  stunned: number;
  sleeping: number;
  feared: number;
  decoySavvy: number;
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

export type ZoneId = "reef" | "kelp" | "deep";

export interface ZoneDef { id: ZoneId; name: string; startX: number; hint: string }

export const ZONES: ZoneDef[] = [
  { id: "reef", name: "Shallow Reef", startX: 0, hint: "common food, gentle water" },
  { id: "kelp", name: "Kelp Forest", startX: 2700, hint: "richer food, thicker cover, sharper hunters" },
  { id: "deep", name: "Deep Water", startX: 5400, hint: "rare glowfruit, and the things that guard it" },
];

export function zoneForX(x: number): ZoneDef {
  let zone = ZONES[0];
  for (const candidate of ZONES) if (x >= candidate.startX) zone = candidate;
  return zone;
}

export const zoneForChunk = (index: number) => zoneForX(index * WORLD.chunkWidth + WORLD.chunkWidth / 2);

export const DEEP_SCHOOL = { x: 5800, y: 390 };

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

export const getMaxHealth = (save: SaveData) => 3 + (save.schools.reef.level >= 4 ? 1 : 0);
export const getMaxStamina = (save: SaveData) => 100 + (save.schools.reef.level >= 3 ? 15 : 0);
export const getDecoyCount = (save: SaveData) => 2 + (save.schools.reef.level >= 2 ? 1 : 0);
export const getSonarCooldown = (save: SaveData) => (save.schools.deep.level >= 3 ? 5 : 8);
export const getBurstDrainMultiplier = (save: SaveData) => (save.schools.deep.level >= 4 ? 0.8 : 1);
export const getRareFoodBonus = (save: SaveData) => (save.schools.deep.level >= 2 ? 1 : 0);
export const getBubbleRadiusMultiplier = (save: SaveData) => (save.schools.reef.level >= 5 ? 1.4 : 1);
export const getBubbleDurationMultiplier = (save: SaveData) => (save.schools.deep.level >= 5 ? 1.5 : 1);

/** How many pops a hunter falls for before ignoring decoys; smarter tiers wise up sooner. */
export const decoySavvyLimit = (tier: EnemyTier) => (tier === "minion" ? 4 : 2);
/** Effect strength decays as a hunter grows savvy to repeated pops. */
export const decoySavvyDecay = (savvy: number) => Math.max(0.4, 1 - savvy * 0.25);

export const xpForLevel = (level: number) => 80 + (level - 1) * 55;

export const schoolFoodGoal = (schoolId: SchoolId, level: number) =>
  SCHOOLS[schoolId].requiredBase + (level - 1) * 16;

export function bankRunProgress(save: SaveData, run: RunStats, schoolId: SchoolId = save.selectedSchool) {
  const foodDelivered = run.food + (save.fishType === "forager" ? Math.floor(run.food / 4) : 0);
  const earnedXp = Math.round(foodDelivered * 10 + run.salvage * 5 + Math.min(run.distance / 25, 65) + run.creaturesHelped * 18 + run.predatorsEscaped * 9);
  const next = { ...save };
  const school = { ...next.schools[schoolId] };
  school.food += foodDelivered;
  let schoolLevelGained = false;
  while (school.food >= schoolFoodGoal(schoolId, school.level)) {
    school.food -= schoolFoodGoal(schoolId, school.level);
    school.level += 1;
    school.population += schoolId === "reef" ? 5 : 7;
    schoolLevelGained = true;
  }
  next.schools = { ...next.schools, [schoolId]: school };
  next.selectedSchool = schoolId;
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
