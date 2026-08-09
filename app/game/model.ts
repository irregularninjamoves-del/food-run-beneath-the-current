import { newlyEarnedAchievements, type AchievementDef } from "./achievements";
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
export type SchoolId = "reef" | "riptide" | "deep" | "umbra";

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

/**
 * School geography. Run distance is measured in world units read as meters, so
 * schools are placed a true five miles apart — every one is a longer expedition
 * than the last, and the far shoals stay genuinely hard to reach.
 */
export const UNITS_PER_MILE = 1609;
export const SCHOOL_SPACING_MILES = 5;
export const SCHOOL_SPACING = SCHOOL_SPACING_MILES * UNITS_PER_MILE;
/** Distance readouts start at the reef mouth, not world zero. */
export const DISTANCE_ORIGIN = 225;

/** The home reef sits at the mouth; every later school is another 5 miles out. */
export const schoolPositionX = (index: number) =>
  index === 0 ? 120 : DISTANCE_ORIGIN + index * SCHOOL_SPACING;

export interface SchoolDef {
  name: string;
  location: string;
  requiredBase: number;
  description: string;
  specialty: string;
  /** Order from home; also drives the five-mile spacing. */
  index: number;
  position: { x: number; y: number };
  color: string;
  /** Why a player would spend one of their three support slots here. */
  longTermPerk: string;
}

export const SCHOOLS: Record<SchoolId, SchoolDef> = {
  reef: {
    name: "Sunbeam Shoal", location: "Shallow Reef", requiredBase: 12,
    description: "A safe young school learning to thrive.", specialty: "Balanced — decoys, stamina, hearts",
    index: 0, position: { x: schoolPositionX(0), y: 540 }, color: "#ffd75f",
    longTermPerk: "Reliable, close to home, easy to keep fed.",
  },
  riptide: {
    name: "Riptide Shoal", location: "Kelp Forest", requiredBase: 16,
    description: "Restless drifters who live for the rush of the current.", specialty: "Speed — swim, burst, stamina",
    index: 1, position: { x: schoolPositionX(1), y: 380 }, color: "#73d9e3",
    longTermPerk: "Five miles out. Faster swimming pays back every run.",
  },
  deep: {
    name: "Midnight Shoal", location: "Deep Water", requiredBase: 20,
    description: "A distant school surviving beyond the kelp.", specialty: "Survival — rare food, sonar, bursts",
    index: 2, position: { x: schoolPositionX(2), y: 390 }, color: "#78d7ca",
    longTermPerk: "Ten miles out. Richer hauls and longer bubble craft.",
  },
  umbra: {
    name: "Umbra Shoal", location: "Far Deep Water", requiredBase: 26,
    description: "Half-seen shapes that slip between the shadows.", specialty: "Stealth — dull predator senses",
    index: 3, position: { x: schoolPositionX(3), y: 400 }, color: "#c39bf0",
    longTermPerk: "Fifteen miles out. The hunters stop noticing you at all.",
  },
};

export const SCHOOL_ORDER: SchoolId[] = ["reef", "riptide", "deep", "umbra"];

/** How far out a school sits, in miles, for readable UI. */
export const schoolMiles = (id: SchoolId) => SCHOOLS[id].index * SCHOOL_SPACING_MILES;

export interface SchoolProgress {
  level: number;
  food: number;
  population: number;
  /** Food delivered here during `lastFedDay`; drives the meal count. */
  fedToday: number;
  lastFedDay: string;
  lastFedAt: number;
  discovered: boolean;
}

export interface SchoolPerkDef { level: number; name: string; description: string }

export const SCHOOL_PERKS: Record<SchoolId, SchoolPerkDef[]> = {
  reef: [
    { level: 2, name: "Bubble Craft", description: "+1 bubble decoy every dive" },
    { level: 3, name: "Reef Vigor", description: "+15 maximum stamina" },
    { level: 4, name: "Guardian Bond", description: "+1 heart every dive" },
    { level: 5, name: "Resonant Pop", description: "Bubble pops reach 40% farther" },
  ],
  riptide: [
    { level: 2, name: "Slipcurrent", description: "Swim speed +4%" },
    { level: 3, name: "Tailwind", description: "Burst speed +8%" },
    { level: 4, name: "Second Wind", description: "Stamina recovers 20% faster" },
    { level: 5, name: "Eye of the Storm", description: "Currents push you 25% less" },
  ],
  deep: [
    { level: 2, name: "Glow Harvest", description: "Rare food is worth +1" },
    { level: 3, name: "Echo Tuning", description: "Sonar recharges 3s sooner" },
    { level: 4, name: "Abyss Grace", description: "Bursting drains 20% less stamina" },
    { level: 5, name: "Deep Charge", description: "Bubble craft effects last 50% longer" },
  ],
  umbra: [
    { level: 2, name: "Soft Fins", description: "Predator hearing −10%" },
    { level: 3, name: "Dusk Veil", description: "Predator sight −8%" },
    { level: 4, name: "Night Cache", description: "+1 bubble decoy every dive" },
    { level: 5, name: "Umbral Skin", description: "Bursting is 25% quieter" },
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
  /** Ambient schools of tiny fish; they scatter from predators as a living warning. */
  ambient: { x: number; y: number; count: number; phase: number }[];
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

export interface LifetimeStats {
  maxDistance: number;
  totalDistance: number;
  longestExtraction: number;
  failedRuns: number;
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
  /** Up to three schools you actively support; only these grant perks. */
  activeSchools: SchoolId[];
  unlockedTalents: TalentId[];
  stats: LifetimeStats;
  achievements: string[];
  reefTokens: number;
  tokenFraction: number;
  checkInStreak: number;
  ownedSkins: string[];
  activeSkin: string;
  ownedThemes: string[];
  activeTheme: string;
  boostPercent: number;
  boostExpiresAt: number;
  lastSeenAt: number;
  lastCheckInDay: string;
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

/**
 * Zone bands are stretched to match the five-mile school spacing, so each
 * school still sits in the water its name promises: Riptide in the kelp at
 * five miles, Midnight and Umbra in the deep beyond ten.
 */
export const ZONES: ZoneDef[] = [
  { id: "reef", name: "Shallow Reef", startX: 0, hint: "common food, gentle water" },
  { id: "kelp", name: "Kelp Forest", startX: 4000, hint: "richer food, thicker cover, sharper hunters" },
  { id: "deep", name: "Deep Water", startX: 12000, hint: "rare glowfruit, and the things that guard it" },
];

export function zoneForX(x: number): ZoneDef {
  let zone = ZONES[0];
  for (const candidate of ZONES) if (x >= candidate.startX) zone = candidate;
  return zone;
}

export const zoneForChunk = (index: number) => zoneForX(index * WORLD.chunkWidth + WORLD.chunkWidth / 2);

export const DEEP_SCHOOL = SCHOOLS.deep.position;

/** Non-reef schools players can physically deliver to (the reef uses the home zone). */
export const AWAY_SCHOOLS: SchoolId[] = ["riptide", "deep", "umbra"];

/** The economy is deliberately slow: tokens are earned by showing up and playing, never by idling. */
export const PLAYTIME_TOKENS_PER_HOUR = 0.1;
export const CHECK_IN_CYCLE_DAYS = 7;

/**
 * Purchasable, time-limited +10% boosts: a token sink that speeds the reef up.
 * Longer windows give better value per minute; buying extends an active boost.
 */
export const BOOST_PERCENT = 10;
export const REEF_BOOSTS = [
  { id: "boost-5m", name: "5 MIN", cost: 1, minutes: 5 },
  { id: "boost-10m", name: "10 MIN", cost: 2, minutes: 10 },
  { id: "boost-15m", name: "15 MIN", cost: 3, minutes: 15 },
  { id: "boost-1h", name: "1 HOUR", cost: 5, minutes: 60 },
  { id: "boost-4h", name: "4 HOURS", cost: 8, minutes: 240 },
  { id: "boost-12h", name: "12 HOURS", cost: 12, minutes: 720 },
  { id: "boost-24h", name: "24 HOURS", cost: 18, minutes: 1440 },
] as const;

export const getBoostMultiplier = (save: SaveData, nowMs: number) =>
  nowMs < save.boostExpiresAt ? 1 + save.boostPercent / 100 : 1;

/** Local calendar-day key used for daily check-ins. */
export const dayKey = (nowMs: number) => new Date(nowMs).toDateString();

export const hasCheckedInToday = (save: SaveData, nowMs: number) => save.lastCheckInDay === dayKey(nowMs);

// ---------------------------------------------------------------------------
// Schools you support, how hungry they are, and what they build
// ---------------------------------------------------------------------------

/** Four schools exist in the ocean; you can only support three at once. */
export const MAX_ACTIVE_SCHOOLS = 3;

export const isSchoolActive = (save: SaveData, id: SchoolId) => save.activeSchools.includes(id);

export const activeSchoolIds = (save: SaveData): SchoolId[] =>
  SCHOOL_ORDER.filter((id) => save.activeSchools.includes(id) && save.schools[id].discovered);

/** Perks only flow from schools you actively support — that is the whole trade. */
const perkLevel = (save: SaveData, id: SchoolId) => (isSchoolActive(save, id) ? save.schools[id].level : 0);

/** A school eats four meals a day; bigger schools need a bigger meal. */
export const MEALS_PER_DAY = 4;
export const mealSize = (school: SchoolProgress) => Math.min(16, Math.max(4, Math.round(school.population / 4)));

export type HungerTier = "well-fed" | "fed" | "peckish" | "hungry" | "starving";

export interface HungerEffect {
  tier: HungerTier;
  label: string;
  /** Added to the Reef Token rate multiplier, per supported school. */
  tokenDelta: number;
  /** Multiplied into swim speed. */
  speed: number;
  /** Flat change to maximum stamina. */
  stamina: number;
  note: string;
}

/**
 * Deliberately gentle: three meals is neutral, four earns a small bonus, and
 * an unfed school is a nudge rather than a punishment. Debuffs are recoverable
 * inside a single session.
 */
export const HUNGER: Record<HungerTier, HungerEffect> = {
  "well-fed": { tier: "well-fed", label: "WELL FED", tokenDelta: 0.01, speed: 1, stamina: 0, note: "+1% Reef Tokens" },
  fed: { tier: "fed", label: "FED", tokenDelta: 0, speed: 1, stamina: 0, note: "Steady — one more meal earns the bonus" },
  peckish: { tier: "peckish", label: "PECKISH", tokenDelta: -0.02, speed: 0.98, stamina: 0, note: "−2% tokens · you swim a little heavy" },
  hungry: { tier: "hungry", label: "HUNGRY", tokenDelta: -0.05, speed: 0.96, stamina: -5, note: "−5% tokens · −5 stamina" },
  starving: { tier: "starving", label: "NEEDS FOOD", tokenDelta: -0.1, speed: 0.94, stamina: -10, note: "−10% tokens · −10 stamina" },
};

/** Food delivered here today; yesterday's deliveries do not carry over. */
export const foodToday = (school: SchoolProgress, nowMs: number) =>
  school.lastFedDay === dayKey(nowMs) ? school.fedToday : 0;

export const mealsToday = (school: SchoolProgress, nowMs: number) =>
  Math.min(MEALS_PER_DAY, Math.floor(foodToday(school, nowMs) / mealSize(school)));

export function hungerTier(meals: number): HungerTier {
  if (meals >= MEALS_PER_DAY) return "well-fed";
  if (meals === 3) return "fed";
  if (meals === 2) return "peckish";
  if (meals === 1) return "hungry";
  return "starving";
}

export const schoolHunger = (save: SaveData, id: SchoolId, nowMs: number): HungerEffect =>
  HUNGER[hungerTier(mealsToday(save.schools[id], nowMs))];

/** Food still owed today before this school is well fed. */
export const foodToWellFed = (school: SchoolProgress, nowMs: number) =>
  Math.max(0, MEALS_PER_DAY * mealSize(school) - foodToday(school, nowMs));

/** Hunger across every supported school folds into one token multiplier. */
export function getHungerTokenMultiplier(save: SaveData, nowMs: number) {
  const ids = activeSchoolIds(save);
  if (!ids.length) return 1;
  let multiplier = 1;
  for (const id of ids) multiplier += schoolHunger(save, id, nowMs).tokenDelta;
  return Math.max(0.5, multiplier);
}

/** A hungry community is a slower one — averaged so one lapse is not crippling. */
export function getHungerSpeedMultiplier(save: SaveData, nowMs: number) {
  const ids = activeSchoolIds(save);
  if (!ids.length) return 1;
  return ids.reduce((total, id) => total + schoolHunger(save, id, nowMs).speed, 0) / ids.length;
}

export function getHungerStaminaBonus(save: SaveData, nowMs: number) {
  const ids = activeSchoolIds(save);
  if (!ids.length) return 0;
  return Math.round(ids.reduce((total, id) => total + schoolHunger(save, id, nowMs).stamina, 0) / ids.length);
}

/** Reef Tokens per hour of play once boosts and hunger are applied. */
export const effectiveTokenRate = (save: SaveData, nowMs: number) =>
  PLAYTIME_TOKENS_PER_HOUR * getBoostMultiplier(save, nowMs) * getHungerTokenMultiplier(save, nowMs);

/**
 * Schools build upward as they grow: a hut at 25, a tower at 50, a spire at
 * 100. Sand and coral, narrow footprint, fish watching from the windows.
 */
export const BUILDING_LEVELS = [25, 50, 100] as const;

export interface BuildingDef { tier: 0 | 1 | 2 | 3; name: string; stories: number; nextAt: number | null }

export function buildingFor(level: number): BuildingDef {
  if (level >= 100) return { tier: 3, name: "Coral Spire", stories: 5, nextAt: null };
  if (level >= 50) return { tier: 2, name: "Coral Tower", stories: 3, nextAt: 100 };
  if (level >= 25) return { tier: 1, name: "Coral Hut", stories: 1, nextAt: 50 };
  return { tier: 0, name: "Open Shoal", stories: 0, nextAt: 25 };
}

/** The reward the NEXT check-in will pay, based on the current streak position. */
export function nextCheckInReward(save: SaveData, nowMs: number): number {
  if (hasCheckedInToday(save, nowMs)) return 0;
  const continues = save.lastCheckInDay === dayKey(nowMs - 86_400_000);
  return continues ? (save.checkInStreak % CHECK_IN_CYCLE_DAYS) + 1 : 1;
}

/**
 * Daily check-in: day 1 of the streak pays 1 token, rising to 7 by day 7,
 * then the cycle restarts. Missing a day resets the streak to day 1.
 * Checking in also unlocks today's playtime earning.
 */
export function dailyCheckIn(save: SaveData, nowMs: number): { save: SaveData; granted: number; streakDay: number } {
  if (hasCheckedInToday(save, nowMs)) return { save, granted: 0, streakDay: save.checkInStreak };
  const granted = nextCheckInReward(save, nowMs);
  return {
    save: { ...save, lastCheckInDay: dayKey(nowMs), checkInStreak: granted, reefTokens: save.reefTokens + granted },
    granted,
    streakDay: granted,
  };
}

/**
 * Converts active play time into Reef Tokens (0.1/hour, boosted while a Reef
 * Boost flows). Only counts after today's check-in; fractions persist.
 */
export function earnPlaytimeTokens(save: SaveData, playSeconds: number, nowMs: number): { save: SaveData; minted: number } {
  if (!hasCheckedInToday(save, nowMs) || playSeconds <= 0) return { save, minted: 0 };
  const progress = save.tokenFraction + (playSeconds / 3600) * effectiveTokenRate(save, nowMs);
  const minted = Math.floor(progress);
  return {
    save: { ...save, reefTokens: save.reefTokens + minted, tokenFraction: progress - minted },
    minted,
  };
}

/** Applies end-of-run lifetime stats and returns any newly earned achievements. */
export function applyRunOutcome(save: SaveData, run: RunStats, success: boolean): { save: SaveData; newRecord: boolean; earnedAchievements: AchievementDef[] } {
  const stats = { ...save.stats };
  stats.totalDistance += run.distance;
  const newRecord = stats.maxDistance > 0 && run.distance > stats.maxDistance;
  stats.maxDistance = Math.max(stats.maxDistance, run.distance);
  if (success) stats.longestExtraction = Math.max(stats.longestExtraction, run.distance);
  else stats.failedRuns += 1;
  const earnedAchievements = newlyEarnedAchievements(save.achievements, { maxDistance: stats.maxDistance });
  return {
    save: { ...save, stats, achievements: [...save.achievements, ...earnedAchievements.map((def) => def.id)] },
    newRecord,
    earnedAchievements,
  };
}

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
  schools: {
    reef: { level: 1, food: 0, population: 8, fedToday: 0, lastFedDay: "", lastFedAt: 0, discovered: true },
    riptide: { level: 1, food: 0, population: 6, fedToday: 0, lastFedDay: "", lastFedAt: 0, discovered: false },
    deep: { level: 1, food: 0, population: 5, fedToday: 0, lastFedDay: "", lastFedAt: 0, discovered: false },
    umbra: { level: 1, food: 0, population: 4, fedToday: 0, lastFedDay: "", lastFedAt: 0, discovered: false },
  },
  activeSchools: ["reef"],
  unlockedTalents: [],
  stats: { maxDistance: 0, totalDistance: 0, longestExtraction: 0, failedRuns: 0 },
  achievements: [],
  reefTokens: 0,
  tokenFraction: 0,
  checkInStreak: 0,
  ownedSkins: ["starter"],
  activeSkin: "starter",
  ownedThemes: ["original"],
  activeTheme: "original",
  boostPercent: 0,
  boostExpiresAt: 0,
  lastSeenAt: 0,
  lastCheckInDay: "",
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

export const getMaxHealth = (save: SaveData) => 3 + (perkLevel(save, "reef") >= 4 ? 1 : 0);
export const getMaxStamina = (save: SaveData, nowMs = 0) =>
  100 + (perkLevel(save, "reef") >= 3 ? 15 : 0) + (nowMs ? getHungerStaminaBonus(save, nowMs) : 0);
export const getDecoyCount = (save: SaveData) => 2 + (perkLevel(save, "reef") >= 2 ? 1 : 0) + (perkLevel(save, "umbra") >= 4 ? 1 : 0);
export const getSchoolSpeedMultiplier = (save: SaveData) => (perkLevel(save, "riptide") >= 2 ? 1.04 : 1);
export const getBurstSpeedMultiplier = (save: SaveData) => (perkLevel(save, "riptide") >= 3 ? 1.08 : 1);
export const getStaminaRegenMultiplier = (save: SaveData) => (perkLevel(save, "riptide") >= 4 ? 1.2 : 1);
export const getCurrentResistMultiplier = (save: SaveData) => (perkLevel(save, "riptide") >= 5 ? 0.75 : 1);
export const getPredatorHearingMultiplier = (save: SaveData) => (perkLevel(save, "umbra") >= 2 ? 0.9 : 1);
export const getPredatorVisionMultiplier = (save: SaveData) => (perkLevel(save, "umbra") >= 3 ? 0.92 : 1);
export const getBurstNoiseMultiplier = (save: SaveData) => (perkLevel(save, "umbra") >= 5 ? 0.75 : 1);
export const getSonarCooldown = (save: SaveData) => (perkLevel(save, "deep") >= 3 ? 5 : 8);
export const getBurstDrainMultiplier = (save: SaveData) => (perkLevel(save, "deep") >= 4 ? 0.8 : 1);
export const getRareFoodBonus = (save: SaveData) => (perkLevel(save, "deep") >= 2 ? 1 : 0);
export const getBubbleRadiusMultiplier = (save: SaveData) => (perkLevel(save, "reef") >= 5 ? 1.4 : 1);
export const getBubbleDurationMultiplier = (save: SaveData) => (perkLevel(save, "deep") >= 5 ? 1.5 : 1);

/** How many pops a hunter falls for before ignoring decoys; smarter tiers wise up sooner. */
export const decoySavvyLimit = (tier: EnemyTier) => (tier === "minion" ? 4 : 2);
/** Effect strength decays as a hunter grows savvy to repeated pops. */
export const decoySavvyDecay = (savvy: number) => Math.max(0.4, 1 - savvy * 0.25);

export const xpForLevel = (level: number) => 80 + (level - 1) * 55;

export const schoolFoodGoal = (schoolId: SchoolId, level: number) =>
  SCHOOLS[schoolId].requiredBase + (level - 1) * 16;

export function bankRunProgress(
  save: SaveData,
  run: RunStats,
  schoolId: SchoolId = save.selectedSchool,
  boostMultiplier = 1,
  nowMs = 0,
) {
  const foodDelivered = Math.round((run.food + (save.fishType === "forager" ? Math.floor(run.food / 4) : 0)) * boostMultiplier);
  const earnedXp = Math.round(foodDelivered * 10 + run.salvage * 5 + Math.min(run.distance / 25, 65) + run.creaturesHelped * 18 + run.predatorsEscaped * 9);
  const next = { ...save };
  const school = { ...next.schools[schoolId] };
  school.food += foodDelivered;
  // Every delivery is also a meal: today's food decides how well fed they are.
  const mealsBefore = nowMs ? mealsToday(school, nowMs) : 0;
  if (nowMs && foodDelivered > 0) {
    const today = dayKey(nowMs);
    school.fedToday = school.lastFedDay === today ? school.fedToday + foodDelivered : foodDelivered;
    school.lastFedDay = today;
    school.lastFedAt = nowMs;
  }
  const mealsAfter = nowMs ? mealsToday(school, nowMs) : 0;
  let schoolLevelGained = false;
  while (school.food >= schoolFoodGoal(schoolId, school.level)) {
    school.food -= schoolFoodGoal(schoolId, school.level);
    school.level += 1;
    school.population += schoolId === "reef" ? 5 : 7;
    schoolLevelGained = true;
  }
  const buildingUpgraded = buildingFor(school.level).tier > buildingFor(next.schools[schoolId].level).tier;
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
  return {
    save: next,
    earnedXp,
    levelGained,
    foodDelivered,
    schoolLevelGained,
    schoolId,
    mealsGained: Math.max(0, mealsAfter - mealsBefore),
    mealsToday: mealsAfter,
    nowWellFed: mealsBefore < MEALS_PER_DAY && mealsAfter >= MEALS_PER_DAY,
    buildingUpgraded,
    building: buildingFor(next.schools[schoolId].level),
  };
}

/**
 * Marks a school as found. The first three you meet become the ones you
 * support; a fourth has to wait for you to free a slot at home.
 */
export function discoverSchool(save: SaveData, id: SchoolId): { save: SaveData; discovered: boolean; autoSupported: boolean } {
  if (save.schools[id].discovered) return { save, discovered: false, autoSupported: false };
  const schools = { ...save.schools, [id]: { ...save.schools[id], discovered: true } };
  const canSupport = save.activeSchools.length < MAX_ACTIVE_SCHOOLS;
  return {
    save: {
      ...save,
      schools,
      activeSchools: canSupport ? [...save.activeSchools, id] : save.activeSchools,
    },
    discovered: true,
    autoSupported: canSupport,
  };
}

/** Toggles support for a discovered school, respecting the three-slot cap. */
export function toggleSchoolSupport(save: SaveData, id: SchoolId): { save: SaveData; error: string | null } {
  if (!save.schools[id].discovered) return { save, error: "You have not found that school yet." };
  if (save.activeSchools.includes(id)) {
    if (save.activeSchools.length === 1) return { save, error: "You must support at least one school." };
    return { save: { ...save, activeSchools: save.activeSchools.filter((entry) => entry !== id) }, error: null };
  }
  if (save.activeSchools.length >= MAX_ACTIVE_SCHOOLS) {
    return { save, error: `You can only support ${MAX_ACTIVE_SCHOOLS} schools — drop one first.` };
  }
  return { save: { ...save, activeSchools: [...save.activeSchools, id] }, error: null };
}
