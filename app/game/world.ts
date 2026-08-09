import { Chunk, Pickup, WORLD, zoneForChunk } from "./model";
import { ENEMY_ARCHETYPES, EnemyKind } from "./enemies";

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FOOD_VALUES = { plankton: 1, algae: 1, shrimp: 2, glowfruit: 4 } as const;

type FoodSubtype = keyof typeof FOOD_VALUES;

// Each zone tunes food quality, junk share, cover density, and predator mix so
// pushing east always trades safety for value.
const ZONE_TUNING = {
  reef: { junkChance: 0.18, rareChance: 0.02, coverCount: 3, hazardMax: 1, foodWeights: [["plankton", 0.5], ["algae", 0.3], ["shrimp", 0.2]] as [FoodSubtype, number][] },
  kelp: { junkChance: 0.24, rareChance: 0.08, coverCount: 4, hazardMax: 2, foodWeights: [["plankton", 0.25], ["algae", 0.2], ["shrimp", 0.55]] as [FoodSubtype, number][] },
  deep: { junkChance: 0.26, rareChance: 0.16, coverCount: 2, hazardMax: 3, foodWeights: [["plankton", 0.2], ["algae", 0.1], ["shrimp", 0.7]] as [FoodSubtype, number][] },
};

function weightedFood(random: () => number, weights: [FoodSubtype, number][]): FoodSubtype {
  let roll = random();
  for (const [subtype, weight] of weights) {
    if (roll < weight) return subtype;
    roll -= weight;
  }
  return weights[weights.length - 1][0];
}

export function createChunk(index: number, runSeed: number): Chunk {
  const random = mulberry32((runSeed ^ Math.imul(index + 47, 2654435761)) >>> 0);
  const start = index * WORLD.chunkWidth;
  const zone = zoneForChunk(index);
  const tuning = ZONE_TUNING[zone.id];
  const pickups: Chunk["pickups"] = [];
  const covers: Chunk["covers"] = [];
  const sharks: Chunk["sharks"] = [];
  const rocks: Chunk["rocks"] = [];
  const hazards: Chunk["hazards"] = [];
  const ambient: Chunk["ambient"] = [];

  const ambientCount = 1 + (random() > 0.45 ? 1 : 0);
  for (let i = 0; i < ambientCount; i++) {
    ambient.push({
      x: start + 120 + random() * (WORLD.chunkWidth - 240),
      y: WORLD.surfaceY + 90 + random() * (WORLD.floorY - WORLD.surfaceY - 220),
      count: 3 + Math.floor(random() * 4),
      phase: random() * Math.PI * 2,
    });
  }

  const coverCount = index === 0 ? 3 : Math.max(2, tuning.coverCount + (random() > 0.55 ? 1 : 0) - (random() > 0.8 ? 1 : 0));
  for (let i = 0; i < coverCount; i++) {
    const x = index === 0
      ? start + 500 + i * 125
      : start + 170 + i * ((WORLD.chunkWidth - 260) / coverCount) + random() * 90;
    const height = index === 0 && i === 0 ? 290 : 105 + random() * (zone.id === "kelp" ? 130 : 95);
    covers.push({ id: `c-${index}-${i}`, x, y: WORLD.floorY - height, width: 76 + random() * 34, height });
  }

  const bossEvent = zone.id === "deep" && random() < 0.13;
  const sharkCount = index === 0 || bossEvent ? 1 : zone.id === "reef" ? 1 : zone.id === "kelp" ? 1 + (random() > 0.5 ? 1 : 0) : 2;
  for (let i = 0; i < sharkCount; i++) {
    const kind: EnemyKind = index === 0
      ? "reef-shark"
      : bossEvent
        ? "ancient-shark"
        : zone.id === "reef"
          ? "needlefish"
          : zone.id === "kelp"
            ? random() < 0.45 ? "needlefish" : "reef-shark"
            : random() < 0.2 ? "needlefish" : "reef-shark";
    const archetype = ENEMY_ARCHETYPES[kind];
    const x = start + (index === 0 ? 780 : bossEvent ? 690 : 310 + random() * 440);
    sharks.push({
      id: `s-${index}-${i}`,
      x,
      y: 180 + random() * 320,
      vx: 0,
      homeX: x,
      state: "PATROL",
      stateTime: 0,
      facing: random() > 0.5 ? 1 : -1,
      lastKnownX: x,
      lastKnownY: 330,
      attackCooldown: 0,
      alert: 0,
      kind,
      tier: archetype.tier,
      warned: false,
      stunned: 0,
      sleeping: 0,
      feared: 0,
      decoySavvy: 0,
    });
  }

  const pickupCount = index === 0 ? 14 : 12 + Math.floor(random() * 8);
  for (let i = 0; i < pickupCount; i++) {
    const junk = i > 4 && random() < tuning.junkChance;
    const rare = index > 0 && !junk && random() < tuning.rareChance;
    let x = index === 0
      ? start + 350 + random() * (WORLD.chunkWidth - 400)
      : start + 115 + random() * (WORLD.chunkWidth - 180);
    let y = WORLD.surfaceY + 80 + random() * (WORLD.floorY - WORLD.surfaceY - 155);
    if (rare && sharks.length > 0 && zone.id !== "reef") {
      // Rare finds cluster near a hunter's territory: the reward advertises the risk.
      const guard = sharks[Math.floor(random() * sharks.length)];
      x = Math.max(start + 115, Math.min(start + WORLD.chunkWidth - 65, guard.homeX + (random() - 0.5) * 320));
      y = WORLD.surfaceY + 110 + random() * (WORLD.floorY - WORLD.surfaceY - 220);
    }
    const subtype: Pickup["subtype"] = junk
      ? (["plastic", "metal", "glass"] as const)[Math.floor(random() * 3)]
      : rare
        ? "glowfruit"
        : weightedFood(random, tuning.foodWeights);
    const value = junk ? 1 : FOOD_VALUES[subtype as FoodSubtype];
    pickups.push({
      id: `p-${index}-${i}`,
      x: index === 0 && i === 0 ? 370 : x,
      y: index === 0 && i === 0 ? 360 : y,
      kind: index === 0 && i === 0 ? "food" : junk ? "junk" : "food",
      subtype: index === 0 && i === 0 ? "plankton" : subtype,
      size: rare ? 2 : 1,
      value: index === 0 && i === 0 ? 1 : value,
      collected: false,
      rare,
    });
  }

  if (zone.id === "deep" && random() < 0.55) {
    // Bubble pearls: deep-water treasures that recharge and supercharge the decoy.
    pickups.push({
      id: `p-${index}-pearl`,
      x: start + 150 + random() * (WORLD.chunkWidth - 280),
      y: WORLD.surfaceY + 110 + random() * (WORLD.floorY - WORLD.surfaceY - 220),
      kind: "bubble",
      subtype: "bubblepearl",
      size: 0,
      value: 1,
      collected: false,
    });
  }

  for (let i = 0; i < 5; i++) {
    rocks.push({
      x: start + random() * WORLD.chunkWidth,
      y: WORLD.floorY + 4,
      r: 22 + random() * 50,
      variant: Math.floor(random() * 3),
    });
  }

  if (index > 0) {
    const hazardCount = 1 + Math.floor(random() * tuning.hazardMax);
    for (let i = 0; i < hazardCount; i++) {
      let x = start + 170 + random() * (WORLD.chunkWidth - 260);
      for (let attempt = 0; attempt < 5 && covers.some((cover) => Math.abs(cover.x - x) < 115); attempt++) {
        x = start + 170 + random() * (WORLD.chunkWidth - 260);
      }
      const roll = random();
      const kind = zone.id === "kelp"
        ? roll < 0.3 ? "jellyfish" : roll < 0.78 ? "net" : "vent"
        : roll < 0.48 ? "jellyfish" : roll < 0.78 ? "net" : "vent";
      const fromFloor = random() > 0.5;
      const height = kind === "net" ? 135 + random() * 125 : kind === "vent" ? 38 : 50;
      hazards.push({
        id: `h-${index}-${i}`,
        kind,
        x,
        y: kind === "vent"
          ? WORLD.floorY - 8
          : kind === "net"
            ? fromFloor ? WORLD.floorY - height : WORLD.surfaceY + 28
            : WORLD.surfaceY + 105 + random() * (WORLD.floorY - WORLD.surfaceY - 210),
        width: kind === "net" ? 30 + random() * 24 : kind === "vent" ? 74 : 42,
        height,
        radius: kind === "jellyfish" ? 28 + random() * 10 : kind === "vent" ? 58 : 0,
        phase: random() * Math.PI * 2,
      });
    }
  }

  const currentChance = zone.id === "deep" ? 0.4 : zone.id === "kelp" ? 0.28 : 0.16;
  return {
    index,
    pickups,
    covers,
    sharks,
    rocks,
    hazards,
    ambient,
    current: index > 1 && random() < currentChance ? (random() > 0.5 ? 1 : -1) * (16 + random() * (zone.id === "deep" ? 30 : 20)) : 0,
  };
}

export class ChunkManager {
  chunks = new Map<number, Chunk>();
  constructor(public seed: number) {}

  update(cameraX: number, viewportWidth: number) {
    const first = Math.max(0, Math.floor((cameraX - 900) / WORLD.chunkWidth));
    const last = Math.ceil((cameraX + viewportWidth + 1500) / WORLD.chunkWidth);
    for (let i = first; i <= last; i++) {
      if (!this.chunks.has(i)) this.chunks.set(i, createChunk(i, this.seed));
    }
    for (const index of this.chunks.keys()) {
      if (index < first - 1 || index > last + 1) this.chunks.delete(index);
    }
  }

  active() {
    return [...this.chunks.values()];
  }
}
