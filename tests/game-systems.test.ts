import assert from "node:assert/strict";
import test from "node:test";
import {
  accrueReefTokens,
  applyRunOutcome,
  AWAY_SCHOOLS,
  bankRunProgress,
  decoySavvyDecay,
  decoySavvyLimit,
  DEEP_SCHOOL,
  getBagCapacity,
  getBubbleDurationMultiplier,
  getBubbleRadiusMultiplier,
  getDecoyCount,
  getMaxHealth,
  getMaxStamina,
  getRareFoodBonus,
  getSonarCooldown,
  OFFLINE_TOKEN_CAP_HOURS,
  RunStats,
  SCHOOLS,
  SchoolId,
  STARTER_SAVE,
  tokenRatePerHour,
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
  assert.equal(zoneForX(3000).id, "kelp");
  assert.equal(zoneForX(6000).id, "deep");
  assert.equal(zoneForChunk(0).id, "reef");
  assert.equal(zoneForChunk(4).id, "kelp");
  assert.equal(zoneForChunk(7).id, "deep");
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

test("school levels unlock tangible perks", () => {
  const base = structuredClone(STARTER_SAVE);
  assert.equal(getMaxHealth(base), 3);
  assert.equal(getMaxStamina(base), 100);
  assert.equal(getDecoyCount(base), 2);
  assert.equal(getSonarCooldown(base), 8);
  assert.equal(getRareFoodBonus(base), 0);
  const grown = structuredClone(STARTER_SAVE);
  grown.schools.reef.level = 4;
  grown.schools.deep.level = 3;
  assert.equal(getMaxHealth(grown), 4);
  assert.equal(getMaxStamina(grown), 115);
  assert.equal(getDecoyCount(grown), 3);
  assert.equal(getSonarCooldown(grown), 5);
  assert.equal(getRareFoodBonus(grown), 1);
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

test("reef tokens accrue from school levels over real time with an offline cap", () => {
  const save = structuredClone(STARTER_SAVE);
  assert.equal(tokenRatePerHour(save), 4, "four level-1 schools generate 4 tokens/hr");
  const started = accrueReefTokens(save, 1_000_000);
  assert.equal(started.earned, 0, "the first sync only starts the clock");
  const after20min = accrueReefTokens(started.save, 1_000_000 + 20 * 60_000);
  assert.equal(after20min.earned, 1, "4/hr earns 1 token in 20 minutes");
  assert.ok(after20min.save.tokenFraction > 0.3 && after20min.save.tokenFraction < 0.34, "fractional progress persists");
  const capped = accrueReefTokens(started.save, 1_000_000 + 1000 * 3_600_000);
  assert.equal(capped.earned, 4 * OFFLINE_TOKEN_CAP_HOURS, "offline earnings stop at the cap");
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
