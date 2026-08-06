import { Chunk, WORLD } from "./model";

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createChunk(index: number, runSeed: number): Chunk {
  const random = mulberry32((runSeed ^ Math.imul(index + 47, 2654435761)) >>> 0);
  const start = index * WORLD.chunkWidth;
  const pickups: Chunk["pickups"] = [];
  const covers: Chunk["covers"] = [];
  const sharks: Chunk["sharks"] = [];
  const rocks: Chunk["rocks"] = [];

  const coverCount = index === 0 ? 3 : 2 + Math.floor(random() * 3);
  for (let i = 0; i < coverCount; i++) {
    const x = index === 0
      ? start + 500 + i * 125
      : start + 170 + i * ((WORLD.chunkWidth - 260) / coverCount) + random() * 90;
    const height = index === 0 && i === 0 ? 290 : 105 + random() * 95;
    covers.push({ id: `c-${index}-${i}`, x, y: WORLD.floorY - height, width: 76 + random() * 34, height });
  }

  const pickupCount = index === 0 ? 14 : 10 + Math.floor(random() * 9);
  for (let i = 0; i < pickupCount; i++) {
    const junk = i > 4 && random() < 0.28;
    const rare = index > 1 && random() < Math.min(0.06 + index * 0.004, 0.18);
    const x = index === 0
      ? start + 350 + random() * (WORLD.chunkWidth - 400)
      : start + 115 + random() * (WORLD.chunkWidth - 180);
    const y = WORLD.surfaceY + 80 + random() * (WORLD.floorY - WORLD.surfaceY - 155);
    const foodTypes = rare ? ["glowfruit"] : ["plankton", "shrimp", "algae"];
    const junkTypes = ["plastic", "metal", "glass"];
    const types = junk ? junkTypes : foodTypes;
    pickups.push({
      id: `p-${index}-${i}`,
      x: index === 0 && i === 0 ? 370 : x,
      y: index === 0 && i === 0 ? 360 : y,
      kind: index === 0 && i === 0 ? "food" : junk ? "junk" : "food",
      subtype: index === 0 && i === 0 ? "plankton" : types[Math.floor(random() * types.length)] as Chunk["pickups"][number]["subtype"],
      size: rare ? 2 : 1,
      value: rare ? 4 : junk ? 1 : 1 + (random() > 0.78 ? 1 : 0),
      collected: false,
      rare,
    });
  }

  const sharkCount = index === 0 ? 1 : index > 1 ? 1 + (random() > 0.68 ? 1 : 0) : 1;
  for (let i = 0; i < sharkCount; i++) {
    const x = start + (index === 0 ? 780 : 310 + random() * 440);
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

  return {
    index,
    pickups,
    covers,
    sharks,
    rocks,
    current: index > 1 && random() > 0.76 ? (random() > 0.5 ? 1 : -1) * (16 + random() * 20) : 0,
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
