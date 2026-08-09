import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRunOutcome,
  AWAY_SCHOOLS,
  bankRunProgress,
  buildingFor,
  dailyCheckIn,
  dayKey,
  discoverSchool,
  DISTANCE_ORIGIN,
  effectiveTokenRate,
  foodToWellFed,
  getHungerSpeedMultiplier,
  getHungerStaminaBonus,
  getHungerTokenMultiplier,
  HUNGER,
  hungerTier,
  MAX_ACTIVE_SCHOOLS,
  MEALS_PER_DAY,
  mealSize,
  mealsToday,
  PLAYTIME_TOKENS_PER_HOUR,
  SCHOOL_SPACING,
  schoolMiles,
  toggleSchoolSupport,
  UNITS_PER_MILE,
  decoySavvyDecay,
  decoySavvyLimit,
  DEEP_SCHOOL,
  earnPlaytimeTokens,
  getBagCapacity,
  getBoostMultiplier,
  getBubbleDurationMultiplier,
  getBubbleRadiusMultiplier,
  getDecoyCount,
  getMaxHealth,
  getMaxStamina,
  getRareFoodBonus,
  getSonarCooldown,
  hasCheckedInToday,
  nextCheckInReward,
  RunStats,
  SCHOOLS,
  SchoolId,
  STARTER_SAVE,
  WORLD,
  xpForLevel,
  zoneForChunk,
  zoneForX,
} from "../app/game/model";
import { ACHIEVEMENTS, newlyEarnedAchievements } from "../app/game/achievements";
import { SKINS, THEMES } from "../app/game/cosmetics";
import { ChunkManager, createChunk } from "../app/game/world";
import { ENEMY_ARCHETYPES } from "../app/game/enemies";
import { exclusiveGroupTaken, TALENTS, talentPointsForLevel } from "../app/game/talents";

test("procedural chunks are deterministic for a run seed", () => {
  assert.deepEqual(createChunk(5, 424242), createChunk(5, 424242));
  assert.notDeepEqual(createChunk(5, 424242), createChunk(5, 424243));
});

test("generated routes always provide cover, rewards, and legal bounds", () => {
  for (let index = 0; index < 30; index += 1) {
    const chunk = createChunk(index, 8675309);
    assert.ok(chunk.covers.length >= 2, `chunk ${index} has no safe cover rhythm`);
    assert.ok(chunk.pickups.length >= 10, `chunk ${index} has too few rewards`);
    assert.ok(chunk.pickups.every((pickup) => pickup.y > WORLD.surfaceY && pickup.y < WORLD.floorY));
    assert.ok(chunk.pickups.every((pickup) => pickup.x >= index * WORLD.chunkWidth && pickup.x <= (index + 1) * WORLD.chunkWidth));
    assert.ok(chunk.sharks.every((shark) => shark.y > WORLD.surfaceY && shark.y < WORLD.floorY));
  }
});

test("the tutorial reef starts with a safe buffer", () => {
  const first = createChunk(0, 1234);
  assert.ok(first.pickups.every((pickup) => pickup.x >= 350));
  assert.ok(first.sharks.every((shark) => shark.homeX >= 700));
});

test("endless chunk manager recycles distant sections", () => {
  const manager = new ChunkManager(17);
  manager.update(0, 1200);
  const startingIndexes = manager.active().map((chunk) => chunk.index);
  assert.ok(startingIndexes.includes(0));
  manager.update(18000, 1200);
  const distantIndexes = manager.active().map((chunk) => chunk.index);
  assert.ok(!distantIndexes.includes(0), "origin chunk should be recycled far from home");
  assert.ok(distantIndexes.length <= 8, "active chunks should remain bounded");
});

test("ocean zones progress from reef to kelp to deep water", () => {
  assert.equal(zoneForX(0).id, "reef");
  assert.equal(zoneForX(5000).id, "kelp");
  assert.equal(zoneForX(14000).id, "deep");
  assert.equal(zoneForChunk(0).id, "reef");
  assert.equal(zoneForChunk(6).id, "kelp");
  assert.equal(zoneForChunk(16).id, "deep");
  assert.equal(zoneForX(DEEP_SCHOOL.x).id, "deep", "Midnight Shoal must live in deep water");
});

test("deeper zones yield more valuable food on average", () => {
  const averageFoodValue = (indexes: number[]) => {
    let total = 0;
    let count = 0;
    for (const index of indexes) {
      for (const seed of [11, 222, 3333, 44444, 55555]) {
        for (const pickup of createChunk(index, seed).pickups) {
          if (pickup.kind !== "food") continue;
          total += pickup.value;
          count += 1;
        }
      }
    }
    return total / count;
  };
  const reef = averageFoodValue([1, 2]);
  const kelp = averageFoodValue([3, 4, 5]);
  const deep = averageFoodValue([7, 8, 9]);
  assert.ok(reef < kelp, `kelp food (${kelp}) should beat reef food (${reef})`);
  assert.ok(kelp < deep, `deep food (${deep}) should beat kelp food (${kelp})`);
});

test("bag upgrades and level requirements scale predictably", () => {
  assert.equal(getBagCapacity(STARTER_SAVE), 6);
  assert.equal(getBagCapacity({ ...STARTER_SAVE, bagLevel: 2 }), 14);
  assert.equal(xpForLevel(1), 80);
  assert.ok(xpForLevel(5) > xpForLevel(2));
});

test("extraction banks the haul into the chosen school", () => {
  const run = { food: 8, salvage: 4, distance: 1200, predatorsEscaped: 1, creaturesHelped: 1, rareDiscoveries: 0, duration: 80 };
  const before = structuredClone(STARTER_SAVE);
  const result = bankRunProgress(before, run, "reef");
  assert.equal(result.save.bankedFood, 8);
  assert.equal(result.save.salvage, 4);
  assert.ok(result.earnedXp > 0);
  assert.equal(before.bankedFood, 0, "banking must not mutate the previous save");
  const deepResult = bankRunProgress(before, run, "deep");
  assert.ok(deepResult.save.schools.deep.food > 0 || deepResult.save.schools.deep.level > 1, "deep deliveries must feed the deep school");
  assert.equal(deepResult.save.schools.reef.food, 0, "deep deliveries must not feed the reef school");
});

test("the forager fish delivers bonus food on heavy hauls", () => {
  const run = { food: 8, salvage: 0, distance: 500, predatorsEscaped: 0, creaturesHelped: 0, rareDiscoveries: 0, duration: 60 };
  const swift = bankRunProgress({ ...structuredClone(STARTER_SAVE), fishType: "swift" }, run, "reef");
  const forager = bankRunProgress({ ...structuredClone(STARTER_SAVE), fishType: "forager" }, run, "reef");
  assert.equal(swift.foodDelivered, 8);
  assert.equal(forager.foodDelivered, 10);
});

test("school levels unlock tangible perks, but only while supported", () => {
  const base = structuredClone(STARTER_SAVE);
  assert.equal(getMaxHealth(base), 3);
  assert.equal(getMaxStamina(base), 100);
  assert.equal(getDecoyCount(base), 2);
  assert.equal(getSonarCooldown(base), 8);
  assert.equal(getRareFoodBonus(base), 0);
  const grown = structuredClone(STARTER_SAVE);
  grown.schools.reef.level = 4;
  grown.schools.deep.level = 3;
  grown.activeSchools = ["reef", "deep"];
  assert.equal(getMaxHealth(grown), 4);
  assert.equal(getMaxStamina(grown), 115);
  assert.equal(getDecoyCount(grown), 3);
  assert.equal(getSonarCooldown(grown), 5);
  assert.equal(getRareFoodBonus(grown), 1);
  // Drop support and the same levels stop paying out — that is the whole trade.
  const dropped = { ...grown, activeSchools: ["reef" as SchoolId] };
  assert.equal(getSonarCooldown(dropped), 8, "an unsupported school grants nothing");
  assert.equal(getRareFoodBonus(dropped), 0);
  assert.equal(getMaxHealth(dropped), 4, "supported schools keep their perks");
});

test("aggro radii scale from minion to lieutenant to boss", () => {
  const minion = ENEMY_ARCHETYPES["needlefish"];
  const lieutenant = ENEMY_ARCHETYPES["reef-shark"];
  const boss = ENEMY_ARCHETYPES["ancient-shark"];
  assert.ok(minion.visionRadius < lieutenant.visionRadius && lieutenant.visionRadius < boss.visionRadius);
  assert.ok(minion.hearingRadius < lieutenant.hearingRadius && lieutenant.hearingRadius < boss.hearingRadius);
  assert.ok(minion.disengageRadius < lieutenant.disengageRadius && lieutenant.disengageRadius < boss.disengageRadius);
});

test("procedural distance tiers can generate all three enemy classes", () => {
  const tiers = new Set<string>();
  for (let index = 0; index < 180; index += 1) {
    for (const enemy of createChunk(index, 94017).sharks) tiers.add(enemy.tier);
  }
  assert.deepEqual([...tiers].sort(), ["boss", "lieutenant", "minion"]);
});

test("bosses only prowl deep water", () => {
  for (let index = 1; index < 120; index += 1) {
    for (const seed of [7, 77, 777]) {
      for (const enemy of createChunk(index, seed).sharks) {
        if (enemy.tier === "boss") assert.equal(zoneForChunk(index).id, "deep", `boss found in ${zoneForChunk(index).id} chunk ${index}`);
      }
    }
  }
});

test("obstacle chunks stay varied and always leave a passable route", () => {
  const kinds = new Set<string>();
  assert.equal(createChunk(0, 2211).hazards.length, 0, "home tutorial water must remain safe");
  for (let index = 1; index < 80; index += 1) {
    const chunk = createChunk(index, 2211);
    assert.ok(chunk.hazards.length >= 1);
    for (const hazard of chunk.hazards) {
      kinds.add(hazard.kind);
      if (hazard.kind === "net") {
        assert.ok(hazard.height <= 260, "partial nets must never block the full water column");
      }
    }
  }
  assert.deepEqual([...kinds].sort(), ["jellyfish", "net", "vent"]);
});

test("talents cover stealth, gathering, voyage, and bubble play styles", () => {
  assert.equal(talentPointsForLevel(1), 0);
  assert.equal(talentPointsForLevel(3), 1);
  assert.equal(talentPointsForLevel(5), 2);
  assert.equal(talentPointsForLevel(7), 3);
  assert.ok(TALENTS.every((talent) => !talent.name.toLowerCase().includes("weapon")));
  const branches = new Set(TALENTS.map((talent) => talent.branch));
  assert.deepEqual([...branches].sort(), ["bubble", "gathering", "stealth", "voyage"]);
  assert.equal(getBagCapacity({ ...STARTER_SAVE, unlockedTalents: ["deep-pockets"] }), 8);
  assert.equal(getBagCapacity({ ...STARTER_SAVE, fishType: "forager" }), 11);
});

test("level-five schools empower the chosen bubble craft", () => {
  const base = structuredClone(STARTER_SAVE);
  assert.equal(getBubbleRadiusMultiplier(base), 1);
  assert.equal(getBubbleDurationMultiplier(base), 1);
  const grown = structuredClone(STARTER_SAVE);
  grown.schools.reef.level = 5;
  grown.schools.deep.level = 5;
  grown.activeSchools = ["reef", "deep"];
  assert.equal(getBubbleRadiusMultiplier(grown), 1.4);
  assert.equal(getBubbleDurationMultiplier(grown), 1.5);
});

test("hunters wise up to repeated decoys, smarter tiers sooner", () => {
  assert.equal(decoySavvyLimit("minion"), 4);
  assert.equal(decoySavvyLimit("lieutenant"), 2);
  assert.equal(decoySavvyDecay(0), 1, "a fresh hunter falls for the full effect");
  assert.ok(decoySavvyDecay(1) < 1, "effects weaken after the first pop");
  assert.equal(decoySavvyDecay(9), 0.4, "effect strength never drops below the floor");
});

test("bubble pearls appear only in deep water and take no bag space", () => {
  for (const seed of [21, 4242, 90210]) {
    for (let index = 1; index <= 5; index += 1) {
      assert.ok(createChunk(index, seed).pickups.every((pickup) => pickup.kind !== "bubble"), `pearl found before deep water in chunk ${index}`);
    }
  }
  let found = 0;
  for (const seed of [21, 4242, 90210]) {
    for (let index = 6; index < 26; index += 1) {
      for (const pickup of createChunk(index, seed).pickups) {
        if (pickup.kind !== "bubble") continue;
        found += 1;
        assert.equal(pickup.size, 0, "pearls must not consume bag space");
      }
    }
  }
  assert.ok(found > 0, "deep water must sometimes offer bubble pearls");
});

test("four schools ladder outward with distinct specialties", () => {
  const ids = Object.keys(SCHOOLS) as SchoolId[];
  assert.equal(ids.length, 4);
  assert.deepEqual(AWAY_SCHOOLS, ["riptide", "deep", "umbra"]);
  let previousX = -1;
  for (const id of ids) {
    assert.ok(SCHOOLS[id].position.x > previousX, "schools must sit progressively farther east");
    previousX = SCHOOLS[id].position.x;
    assert.ok(SCHOOLS[id].specialty.length > 0);
  }
  assert.equal(zoneForX(SCHOOLS.riptide.position.x).id, "kelp");
  assert.equal(zoneForX(SCHOOLS.umbra.position.x).id, "deep");
});

test("schools sit a true five miles apart, so each one is a longer voyage", () => {
  assert.equal(schoolMiles("reef"), 0);
  assert.equal(schoolMiles("riptide"), 5);
  assert.equal(schoolMiles("deep"), 10);
  assert.equal(schoolMiles("umbra"), 15);
  const gaps = [
    SCHOOLS.deep.position.x - SCHOOLS.riptide.position.x,
    SCHOOLS.umbra.position.x - SCHOOLS.deep.position.x,
  ];
  for (const gap of gaps) assert.equal(gap, SCHOOL_SPACING, "consecutive schools stay exactly five miles apart");
  assert.ok(SCHOOLS.umbra.position.x - DISTANCE_ORIGIN >= 15 * UNITS_PER_MILE, "the last school is a fifteen-mile haul");
});

test("only three of the four schools can be supported at once", () => {
  let save = structuredClone(STARTER_SAVE);
  assert.deepEqual(save.activeSchools, ["reef"], "you start supporting the home reef alone");
  assert.equal(save.schools.umbra.discovered, false);

  // The first three schools you find are taken on automatically.
  for (const id of ["riptide", "deep"] as SchoolId[]) {
    const found = discoverSchool(save, id);
    assert.ok(found.discovered && found.autoSupported, `${id} should be adopted on discovery`);
    save = found.save;
  }
  assert.equal(save.activeSchools.length, MAX_ACTIVE_SCHOOLS);

  // The fourth is found but cannot be supported until a slot frees up.
  const fourth = discoverSchool(save, "umbra");
  assert.ok(fourth.discovered, "the fourth school is still discovered");
  assert.equal(fourth.autoSupported, false, "but it cannot claim a full slot");
  save = fourth.save;
  assert.equal(toggleSchoolSupport(save, "umbra").error !== null, true, "supporting a fourth is refused");

  const freed = toggleSchoolSupport(save, "riptide");
  assert.equal(freed.error, null);
  const swapped = toggleSchoolSupport(freed.save, "umbra");
  assert.equal(swapped.error, null, "a freed slot can be filled");
  assert.deepEqual(swapped.save.activeSchools, ["reef", "deep", "umbra"]);
  assert.equal(discoverSchool(swapped.save, "umbra").discovered, false, "rediscovery never fires twice");

  const soleSupport = toggleSchoolSupport(structuredClone(STARTER_SAVE), "reef");
  assert.ok(soleSupport.error, "you cannot abandon your last school");
});

test("schools build upward at levels 25, 50, and 100", () => {
  assert.equal(buildingFor(1).tier, 0);
  assert.equal(buildingFor(24).nextAt, 25);
  assert.equal(buildingFor(25).name, "Coral Hut");
  assert.equal(buildingFor(49).tier, 1);
  assert.equal(buildingFor(50).name, "Coral Tower");
  assert.equal(buildingFor(99).tier, 2);
  assert.equal(buildingFor(100).name, "Coral Spire");
  assert.equal(buildingFor(100).nextAt, null, "the spire is the last build");
  let previous = -1;
  for (const level of [1, 25, 50, 100]) {
    const stories = buildingFor(level).stories;
    assert.ok(stories > previous, "each tier stacks another story rather than spreading out");
    previous = stories;
  }
});

test("the 7-day check-in ladder pays 1 through 7, resets on misses, then cycles", () => {
  const DAY = 86_400_000;
  const start = Date.UTC(2026, 7, 10, 15);
  let save = structuredClone(STARTER_SAVE);
  for (let day = 0; day < 9; day += 1) {
    const result = dailyCheckIn(save, start + day * DAY);
    const expected = (day % 7) + 1;
    assert.equal(result.granted, expected, `day ${day + 1} of a perfect streak pays ${expected}`);
    save = result.save;
  }
  assert.equal(save.reefTokens, 28 + 1 + 2, "a perfect week pays 28, then the cycle restarts at 1");
  const repeat = dailyCheckIn(save, start + 8 * DAY + 60_000);
  assert.equal(repeat.granted, 0, "checking in twice in one day pays nothing");
  const lapsed = dailyCheckIn(save, start + 20 * DAY);
  assert.equal(lapsed.granted, 1, "missing days resets the streak to day 1");
  assert.ok(hasCheckedInToday(lapsed.save, start + 20 * DAY));
  assert.equal(nextCheckInReward(lapsed.save, start + 21 * DAY), 2, "tomorrow continues the streak");
});

/** A save whose supported schools have all eaten their four meals today. */
function wellFedSave(nowMs: number) {
  const save = dailyCheckIn(structuredClone(STARTER_SAVE), nowMs).save;
  for (const id of save.activeSchools) {
    const school = save.schools[id];
    save.schools[id] = {
      ...school,
      fedToday: MEALS_PER_DAY * mealSize(school),
      lastFedDay: dayKey(nowMs),
      lastFedAt: nowMs,
    };
  }
  return save;
}

test("playtime converts to tokens only after check-in, at 0.1 per hour", () => {
  const now = Date.UTC(2026, 7, 10, 15);
  const notCheckedIn = structuredClone(STARTER_SAVE);
  assert.equal(earnPlaytimeTokens(notCheckedIn, 3600, now).minted, 0, "no check-in, no pay");
  assert.equal(earnPlaytimeTokens(notCheckedIn, 3600, now).save.tokenFraction, 0, "not even fractions accrue");
  // A school fed exactly three meals is neutral: the base rate, no modifiers.
  const save = dailyCheckIn(structuredClone(STARTER_SAVE), now).save;
  const reef = save.schools.reef;
  save.schools.reef = { ...reef, fedToday: 3 * mealSize(reef), lastFedDay: dayKey(now), lastFedAt: now };
  assert.equal(mealsToday(save.schools.reef, now), 3);
  assert.equal(getHungerTokenMultiplier(save, now), 1, "three meals is exactly neutral");
  const halfHour = earnPlaytimeTokens(save, 1800, now);
  assert.ok(Math.abs(halfHour.save.tokenFraction - 0.05) < 1e-9, "30 minutes of play banks 0.05");
  let running = halfHour.save;
  let minted = 0;
  for (let i = 0; i < 20; i += 1) {
    const step = earnPlaytimeTokens(running, 1800, now);
    minted += step.minted;
    running = step.save;
  }
  assert.equal(minted, 1, "10.5 hours of play mints exactly 1 token");
});

test("four meals a day earns a bonus; going hungry costs tokens, speed, and stamina", () => {
  const now = Date.UTC(2026, 7, 10, 15);
  const school = structuredClone(STARTER_SAVE).schools.reef;
  const meal = mealSize(school);
  assert.ok(meal >= 4, "a meal is never trivially small");

  // The full ladder, from an unfed school to a well-fed one.
  const expected: [number, string, number][] = [
    [0, "starving", -0.1],
    [1, "hungry", -0.05],
    [2, "peckish", -0.02],
    [3, "fed", 0],
    [4, "well-fed", 0.01],
  ];
  for (const [meals, tier, tokenDelta] of expected) {
    assert.equal(hungerTier(meals), tier, `${meals} meals reads as ${tier}`);
    assert.equal(HUNGER[hungerTier(meals)].tokenDelta, tokenDelta);
  }
  assert.equal(hungerTier(9), "well-fed", "overfeeding never penalises");

  const wellFed = wellFedSave(now);
  assert.equal(mealsToday(wellFed.schools.reef, now), MEALS_PER_DAY);
  assert.ok(Math.abs(getHungerTokenMultiplier(wellFed, now) - 1.01) < 1e-9, "a well-fed school pays +1%");
  assert.equal(getHungerSpeedMultiplier(wellFed, now), 1, "well-fed fish swim at full speed");
  assert.equal(getHungerStaminaBonus(wellFed, now), 0);
  assert.ok(Math.abs(effectiveTokenRate(wellFed, now) - PLAYTIME_TOKENS_PER_HOUR * 1.01) < 1e-9);

  const unfed = dailyCheckIn(structuredClone(STARTER_SAVE), now).save;
  assert.equal(mealsToday(unfed.schools.reef, now), 0, "yesterday's food does not carry over");
  assert.ok(Math.abs(getHungerTokenMultiplier(unfed, now) - 0.9) < 1e-9, "an unfed school costs 10%");
  assert.ok(getHungerSpeedMultiplier(unfed, now) < 1, "hungry schools swim slower");
  assert.ok(getHungerSpeedMultiplier(unfed, now) >= 0.94, "but the debuff stays small");
  assert.equal(getHungerStaminaBonus(unfed, now), -10);
  assert.equal(foodToWellFed(unfed.schools.reef, now), MEALS_PER_DAY * meal);

  // Three well-fed schools stack their bonuses; unsupported ones are ignored.
  const trio = wellFedSave(now);
  trio.activeSchools = ["reef", "riptide", "deep"];
  for (const id of trio.activeSchools) {
    const entry = trio.schools[id];
    trio.schools[id] = { ...entry, discovered: true, fedToday: MEALS_PER_DAY * mealSize(entry), lastFedDay: dayKey(now), lastFedAt: now };
  }
  assert.ok(Math.abs(getHungerTokenMultiplier(trio, now) - 1.03) < 1e-9, "three well-fed schools pay +3%");
});

test("deliveries feed the school they are carried to", () => {
  const now = Date.UTC(2026, 7, 10, 15);
  const start = dailyCheckIn(structuredClone(STARTER_SAVE), now).save;
  const meal = mealSize(start.schools.reef);
  const run: RunStats = { food: meal, salvage: 0, distance: 300, predatorsEscaped: 0, creaturesHelped: 0, rareDiscoveries: 0, duration: 40 };

  let save = start;
  for (let delivery = 1; delivery <= MEALS_PER_DAY; delivery += 1) {
    const banked = bankRunProgress(save, run, "reef", 1, now);
    save = banked.save;
    assert.equal(banked.mealsToday, delivery, `delivery ${delivery} is meal ${delivery}`);
    assert.equal(banked.nowWellFed, delivery === MEALS_PER_DAY, "well fed is announced exactly once");
  }
  assert.equal(mealsToday(save.schools.reef, now), MEALS_PER_DAY);
  assert.ok(Math.abs(getHungerTokenMultiplier(save, now) - 1.01) < 1e-9);

  // Feeding one school leaves the others as hungry as they were.
  const other = { ...save, activeSchools: ["reef", "riptide"] as SchoolId[] };
  other.schools.riptide = { ...other.schools.riptide, discovered: true };
  assert.equal(mealsToday(other.schools.riptide, now), 0, "food is not shared between schools");
  assert.ok(Math.abs(getHungerTokenMultiplier(other, now) - 0.91) < 1e-9, "+1% well fed, −10% unfed");

  // A run that banks nothing is not a meal.
  const empty: RunStats = { ...run, food: 0 };
  assert.equal(bankRunProgress(save, empty, "reef", 1, now).mealsGained, 0);
});

test("reef boosts multiply playtime earning and deliveries, and stack duration", () => {
  const now = Date.UTC(2026, 7, 10, 15);
  const save = dailyCheckIn(structuredClone(STARTER_SAVE), now).save;
  const reef = save.schools.reef;
  save.schools.reef = { ...reef, fedToday: 3 * mealSize(reef), lastFedDay: dayKey(now), lastFedAt: now };
  save.boostPercent = 10;
  save.boostExpiresAt = now + 3_600_000;
  assert.equal(getBoostMultiplier(save, now), 1.1);
  assert.equal(getBoostMultiplier(save, save.boostExpiresAt + 1), 1, "expired boosts do nothing");
  const boostedHour = earnPlaytimeTokens(save, 3600, now);
  assert.ok(Math.abs(boostedHour.save.tokenFraction - 0.11) < 1e-9, "a boosted hour banks 0.11");
  const run: RunStats = { food: 10, salvage: 0, distance: 500, predatorsEscaped: 0, creaturesHelped: 0, rareDiscoveries: 0, duration: 60 };
  const banked = bankRunProgress({ ...structuredClone(STARTER_SAVE), fishType: "swift" }, run, "reef", 1.1);
  assert.equal(banked.foodDelivered, 11, "a +10% boost turns 10 food into 11");
});

test("cosmetic prices keep commons attainable and high tiers aspirational", () => {
  for (const item of [...SKINS, ...THEMES]) {
    if (item.cost === 0) continue;
    if (item.rarity === "common") assert.ok(item.cost <= 25, `${item.id} should stay attainable`);
    else if (item.rarity === "uncommon") assert.ok(item.cost >= 50, `${item.id} should take a couple of weeks`);
    else assert.ok(item.cost >= 200, `${item.id} should be a long-term goal`);
  }
});

test("run outcomes update lifetime records and preserve progress on failure", () => {
  const run: RunStats = { food: 5, salvage: 0, distance: 5200, predatorsEscaped: 0, creaturesHelped: 0, rareDiscoveries: 0, duration: 60 };
  const base = structuredClone(STARTER_SAVE);
  base.reefTokens = 9;
  base.achievements = ["first-swim"];
  const failed = applyRunOutcome(base, run, false);
  assert.equal(failed.save.stats.failedRuns, 1);
  assert.equal(failed.save.stats.maxDistance, 5200, "records persist even on failure");
  assert.equal(failed.save.reefTokens, 9, "failure never takes earned tokens");
  assert.ok(failed.save.achievements.includes("getting-brave"), "distance achievements land on failure too");
  const better = applyRunOutcome(failed.save, { ...run, distance: 6100 }, true);
  assert.equal(better.newRecord, true);
  assert.equal(better.save.stats.longestExtraction, 6100);
});

test("achievements are modular and threshold-ordered", () => {
  assert.ok(ACHIEVEMENTS.length >= 6);
  assert.equal(new Set(ACHIEVEMENTS.map((def) => def.id)).size, ACHIEVEMENTS.length, "achievement ids must be unique");
  const earned = newlyEarnedAchievements([], { maxDistance: 10000 });
  assert.deepEqual(earned.map((def) => def.id), ["first-swim", "getting-brave", "beyond-the-reef"]);
  assert.deepEqual(newlyEarnedAchievements(earned.map((def) => def.id), { maxDistance: 10000 }), [], "already-earned achievements never repeat");
});

test("cosmetics are valid, priced by rarity, and never free except starters", () => {
  for (const list of [SKINS, THEMES] as const) {
    assert.equal(new Set(list.map((item) => item.id)).size, list.length, "cosmetic ids must be unique");
    for (const item of list) {
      if (item.id === "starter" || item.id === "original") assert.equal(item.cost, 0);
      else assert.ok(item.cost > 0, `${item.id} must cost tokens`);
    }
  }
  assert.ok(STARTER_SAVE.ownedSkins.includes("starter"));
  assert.ok(STARTER_SAVE.ownedThemes.includes("original"));
});

test("only one bubble craft can ever be chosen", () => {
  const bubbleCrafts = TALENTS.filter((talent) => talent.exclusiveGroup === "bubble-craft");
  assert.equal(bubbleCrafts.length, 3, "stun, slumber, and guardian crafts are alternatives");
  const stun = bubbleCrafts.find((talent) => talent.id === "stun-bubble")!;
  const guardian = bubbleCrafts.find((talent) => talent.id === "guardian-bubble")!;
  assert.equal(exclusiveGroupTaken([], stun), null, "no craft chosen yet");
  assert.equal(exclusiveGroupTaken(["stun-bubble"], guardian)?.id, "stun-bubble", "choosing stun locks the guardian");
  assert.equal(exclusiveGroupTaken(["stun-bubble"], stun), null, "a chosen craft is not blocked by itself");
  assert.equal(exclusiveGroupTaken(["quiet-wake"], guardian), null, "other branches never lock bubble crafts");
});
