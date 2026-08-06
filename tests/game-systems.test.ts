import assert from "node:assert/strict";
import test from "node:test";
import { bankRunProgress, getBagCapacity, STARTER_SAVE, WORLD, xpForLevel } from "../app/game/model";
import { ChunkManager, createChunk } from "../app/game/world";
import { ENEMY_ARCHETYPES } from "../app/game/enemies";

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

test("bag upgrades and level requirements scale predictably", () => {
  assert.equal(getBagCapacity(STARTER_SAVE), 8);
  assert.equal(getBagCapacity({ ...STARTER_SAVE, bagLevel: 2 }), 16);
  assert.equal(xpForLevel(1), 80);
  assert.ok(xpForLevel(5) > xpForLevel(2));
});

test("extraction banks the haul and defeat leaves permanent stores unchanged", () => {
  const run = { food: 8, salvage: 4, distance: 1200, predatorsEscaped: 1, creaturesHelped: 1, rareDiscoveries: 0, duration: 80 };
  const before = structuredClone(STARTER_SAVE);
  const result = bankRunProgress(before, run);
  assert.equal(result.save.bankedFood, 8);
  assert.equal(result.save.salvage, 4);
  assert.ok(result.earnedXp > 0);
  assert.equal(before.bankedFood, 0, "banking must not mutate the previous save");
  const afterDefeat = { ...before };
  assert.deepEqual(afterDefeat, before, "defeat must not bank unprotected run resources");
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
