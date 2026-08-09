"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  accrueReefTokens,
  applyRunOutcome,
  AWAY_SCHOOLS,
  bankRunProgress,
  decoySavvyDecay,
  decoySavvyLimit,
  FISH_TYPES,
  FishType,
  getBagCapacity,
  getBubbleDurationMultiplier,
  getBubbleRadiusMultiplier,
  getBurstDrainMultiplier,
  getBurstNoiseMultiplier,
  getBurstSpeedMultiplier,
  getCurrentResistMultiplier,
  getDecoyCount,
  getMaxHealth,
  getMaxStamina,
  getPredatorHearingMultiplier,
  getPredatorVisionMultiplier,
  getRareFoodBonus,
  getSchoolSpeedMultiplier,
  getSonarCooldown,
  getStaminaRegenMultiplier,
  Phase,
  RunStats,
  SaveData,
  schoolFoodGoal,
  SCHOOL_PERKS,
  SCHOOLS,
  SchoolId,
  STARTER_SAVE,
  tokenRatePerHour,
  TUTORIAL_STEPS,
  WORLD,
  xpForLevel,
  ZoneId,
  zoneForX,
} from "./model";
import { ACHIEVEMENTS, newlyEarnedAchievements } from "./achievements";
import { findSkin, findTheme, SKINS, THEMES, type SkinColors } from "./cosmetics";
import { clearSave, loadSave, persistSave } from "./save";
import { ChunkManager } from "./world";
import { gameAudio } from "./audio";
import { ENEMY_ARCHETYPES, EnemyKind, TIER_COLORS } from "./enemies";
import { exclusiveGroupTaken, hasTalent, TALENTS, TalentId, talentPointsForLevel } from "./talents";

type Particle = { x: number; y: number; vx: number; vy: number; life: number; size: number; kind: "bubble" | "spark" };
type Floater = { x: number; y: number; text: string; color: string; life: number };
type DeliveryReport = { schoolId: SchoolId; foodDelivered: number; schoolLevelGained: boolean; population: number; schoolLevel: number; newRecord: boolean; achievements: string[] };

interface Runtime {
  phase: Phase;
  paused: boolean;
  inventory: boolean;
  save: SaveData;
  player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    facing: 1 | -1;
    health: number;
    stamina: number;
    staminaDelay: number;
    hidden: boolean;
    coverId: string | null;
    invulnerable: number;
    whaleShield: number;
    hazardCooldown: number;
  };
  chunks: ChunkManager;
  seed: number;
  cameraX: number;
  elapsed: number;
  run: RunStats;
  bagUsed: number;
  tutorialStep: number;
  tutorialFlags: { moved: boolean; burst: boolean; hid: boolean; chased: boolean; escaped: boolean; whale: boolean; junk: boolean };
  whale: { x: number; y: number; helped: boolean };
  particles: Particle[];
  floaters: Floater[];
  zoneId: ZoneId;
  lastDelivery: DeliveryReport | null;
  recordAnnounced: boolean;
  scannerCooldown: number;
  scannerPulse: number;
  traps: number;
  decoy: { x: number; y: number; vx: number; vy: number; life: number; popped: boolean; charged: boolean; slept: string[] } | null;
  chargedPop: boolean;
  shake: number;
  notice: string;
  noticeTime: number;
  uiClock: number;
  resultXp: number;
  levelGained: boolean;
}

interface UiSnapshot {
  phase: Phase;
  paused: boolean;
  inventory: boolean;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  hidden: boolean;
  stealth: string;
  threat: string;
  bagUsed: number;
  bagCapacity: number;
  run: RunStats;
  save: SaveData;
  tutorialStep: number;
  scannerCooldown: number;
  traps: number;
  notice: string;
  zoneName: string;
  nearHome: boolean;
  nearCover: boolean;
  nearWhale: boolean;
  nearSchool: SchoolId | null;
  resultXp: number;
  levelGained: boolean;
  lastDelivery: DeliveryReport | null;
}

const emptyRun = (): RunStats => ({
  food: 0,
  salvage: 0,
  distance: 0,
  predatorsEscaped: 0,
  creaturesHelped: 0,
  rareDiscoveries: 0,
  duration: 0,
});

function freshRuntime(save: SaveData): Runtime {
  const seed = Math.floor(Math.random() * 99999999);
  const chunks = new ChunkManager(seed);
  chunks.update(0, 1600);
  return {
    phase: "title",
    paused: false,
    inventory: false,
    save,
    player: {
      x: 210,
      y: 360,
      vx: 0,
      vy: 0,
      facing: 1,
      health: getMaxHealth(save),
      stamina: getMaxStamina(save),
      staminaDelay: 0,
      hidden: false,
      coverId: null,
      invulnerable: 0,
      whaleShield: 0,
      hazardCooldown: 0,
    },
    chunks,
    seed,
    cameraX: 0,
    elapsed: 0,
    run: emptyRun(),
    bagUsed: 0,
    tutorialStep: save.tutorialComplete ? TUTORIAL_STEPS.length : 0,
    tutorialFlags: { moved: false, burst: false, hid: false, chased: false, escaped: false, whale: false, junk: false },
    whale: { x: save.tutorialComplete ? 1750 : 1180, y: 260, helped: false },
    particles: [],
    floaters: [],
    zoneId: "reef",
    lastDelivery: null,
    recordAnnounced: false,
    scannerCooldown: 0,
    scannerPulse: 0,
    traps: getDecoyCount(save),
    decoy: null,
    chargedPop: false,
    shake: 0,
    notice: "",
    noticeTime: 0,
    uiClock: 0,
    resultXp: 0,
    levelGained: false,
  };
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const distance = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawFish(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, tilt: number, hidden: boolean, shield: boolean, variant: FishType = "swift", skin: SkinColors | null = null) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(facing, 1);
  if (shield) {
    ctx.strokeStyle = "rgba(121,244,255,.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 30 + Math.sin(performance.now() * 0.006) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = hidden ? 0.48 : 1;
  if (variant === "forager") {
    // The forager reads as a plump teal grazer: round body, fan tail, tall dorsal fin.
    const body = ctx.createLinearGradient(-18, -18, 18, 20);
    body.addColorStop(0, skin?.a ?? "#8be8c5");
    body.addColorStop(0.55, skin?.b ?? "#37b39b");
    body.addColorStop(1, skin?.c ?? "#1f7f8f");
    ctx.fillStyle = skin?.tail ?? "#2b9b8a";
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.quadraticCurveTo(-32, -19, -37, -10);
    ctx.quadraticCurveTo(-40, 0, -37, 10);
    ctx.quadraticCurveTo(-32, 19, -14, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-9, -15);
    ctx.quadraticCurveTo(-1, -28, 9, -14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin?.belly ?? "#d8f7e8";
    ctx.beginPath();
    ctx.ellipse(3, 8, 13, 6, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = "#fff7d9";
    ctx.beginPath();
    ctx.arc(9, -5, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#122b4d";
    ctx.beginPath();
    ctx.arc(10.5, -5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const body = ctx.createLinearGradient(-22, -15, 20, 18);
    body.addColorStop(0, skin?.a ?? "#ffbf4d");
    body.addColorStop(0.58, skin?.b ?? "#ff756b");
    body.addColorStop(1, skin?.c ?? "#ec3f73");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin?.tail ?? "#f05d72";
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-37, -14);
    ctx.lineTo(-33, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff7d9";
    ctx.beginPath();
    ctx.arc(11, -4, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#122b4d";
    ctx.beginPath();
    ctx.arc(12.5, -4, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.45)";
    ctx.beginPath();
    ctx.ellipse(2, -7, 10, 3, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPredator(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, state: string, alert: number, kind: EnemyKind) {
  const enemy = ENEMY_ARCHETYPES[kind];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * enemy.scale, enemy.scale);
  if (kind === "needlefish") {
    ctx.fillStyle = state === "CHASE" ? "#c79b51" : "#769da0";
    ctx.beginPath();
    ctx.ellipse(0, 0, 45, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(35, -3);
    ctx.lineTo(72, 0);
    ctx.lineTo(35, 3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-37, 0);
    ctx.lineTo(-57, -15);
    ctx.lineTo(-54, 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#11283c";
    ctx.beginPath();
    ctx.arc(25, -3, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = kind === "ancient-shark" ? (state === "CHASE" ? "#625477" : "#41566d") : state === "CHASE" ? "#7e91ad" : "#6783a0";
    ctx.beginPath();
    ctx.ellipse(0, 0, 48, 21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-39, 0);
    ctx.lineTo(-69, -25);
    ctx.lineTo(-63, 24);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-6, -17);
    ctx.lineTo(8, -42);
    ctx.lineTo(17, -15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = kind === "ancient-shark" ? "#aebcc4" : "#d6e2e8";
    ctx.beginPath();
    ctx.ellipse(15, 8, 30, 10, -0.04, 0, Math.PI);
    ctx.fill();
    if (kind === "ancient-shark") {
      ctx.strokeStyle = "rgba(218,226,225,.7)";
      ctx.lineWidth = 2;
      for (let scar = 0; scar < 3; scar++) {
        ctx.beginPath();
        ctx.moveTo(2 + scar * 7, -15);
        ctx.lineTo(-5 + scar * 7, 3);
        ctx.stroke();
      }
    }
    ctx.fillStyle = state === "CHASE" ? "#ff506c" : "#0e2338";
    ctx.beginPath();
    ctx.arc(27, -6, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  const label = state === "PATROL" && enemy.tier !== "boss" ? "" : `${enemy.tier.toUpperCase()} · ${state}`;
  if (label) {
    ctx.font = "700 10px var(--font-mono), monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = state === "CHASE" ? "#ff8092" : TIER_COLORS[enemy.tier];
    const labelY = y - 32 - enemy.scale * 15;
    ctx.fillText(label, x, labelY);
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.fillRect(x - 25, labelY + 7, 50, 3);
    ctx.fillStyle = state === "CHASE" ? "#ff5575" : "#f8d45b";
    ctx.fillRect(x - 25, labelY + 7, 50 * clamp(alert, 0, 1), 3);
  }
}

function drawWhale(ctx: CanvasRenderingContext2D, x: number, y: number, helped: boolean, time: number) {
  ctx.save();
  ctx.translate(x, y + Math.sin(time * 0.7) * 12);
  ctx.globalAlpha = helped ? 0.62 : 0.94;
  const whale = ctx.createLinearGradient(-90, -40, 85, 45);
  whale.addColorStop(0, "#355b89");
  whale.addColorStop(1, "#76b1cf");
  ctx.fillStyle = whale;
  ctx.beginPath();
  ctx.ellipse(0, 0, 92, 39, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-82, 0);
  ctx.quadraticCurveTo(-130, -47, -145, -25);
  ctx.quadraticCurveTo(-120, -4, -87, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-82, 4);
  ctx.quadraticCurveTo(-130, 48, -144, 26);
  ctx.quadraticCurveTo(-119, 8, -84, -3);
  ctx.fill();
  ctx.fillStyle = "#d6edf2";
  ctx.beginPath();
  ctx.ellipse(27, 16, 54, 16, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = "#102840";
  ctx.beginPath();
  ctx.arc(55, -10, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSeaweed(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, time: number, selected: boolean) {
  const stems = Math.max(4, Math.floor(width / 15));
  for (let i = 0; i < stems; i++) {
    const sx = x - width / 2 + (i + 0.5) * (width / stems);
    const sway = Math.sin(time * 1.6 + i) * 9;
    ctx.strokeStyle = selected ? "rgba(98,255,203,.92)" : i % 2 ? "#168c72" : "#1bb38b";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(sx, y + height);
    ctx.bezierCurveTo(sx - 12, y + height * 0.66, sx + sway, y + height * 0.35, sx + sway * 0.6, y);
    ctx.stroke();
  }
}

function drawPickup(ctx: CanvasRenderingContext2D, x: number, y: number, kind: string, subtype: string, rare: boolean, time: number) {
  const bob = Math.sin(time * 2 + x * 0.02) * 4;
  ctx.save();
  ctx.translate(x, y + bob);
  if (rare) {
    ctx.shadowColor = "#8dfff0";
    ctx.shadowBlur = 18;
  }
  if (kind === "bubble") {
    const pulse = 1 + Math.sin(time * 3 + x * 0.05) * 0.12;
    ctx.shadowColor = "#e9a8ff";
    ctx.shadowBlur = 16;
    ctx.strokeStyle = "rgba(233,168,255,.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 11 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(248,226,255,.92)";
    ctx.beginPath();
    ctx.arc(0, 0, 5 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.beginPath();
    ctx.arc(-2.5, -3, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "food") {
    ctx.fillStyle = rare ? "#8dffe6" : subtype === "algae" ? "#8ed85f" : subtype === "shrimp" ? "#ff9e97" : "#ffd75f";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc((i - 1) * 8, Math.sin(i * 3) * 5, rare ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.rotate(0.25);
    ctx.fillStyle = subtype === "plastic" ? "#ed8ab4" : subtype === "metal" ? "#a9c3c8" : "#73d9e3";
    roundedRect(ctx, -9, -8, 18, 16, 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(20,44,63,.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawJellyfish(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, time: number, phase: number) {
  const pulse = 1 + Math.sin(time * 2.2 + phase) * 0.08;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, 1 / pulse);
  ctx.shadowColor = "rgba(224,113,255,.7)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "rgba(211,112,238,.72)";
  ctx.beginPath();
  ctx.arc(0, 0, radius, Math.PI, 0);
  ctx.quadraticCurveTo(radius * 0.65, radius * 0.45, radius * 0.35, radius * 0.16);
  ctx.quadraticCurveTo(0, radius * 0.62, -radius * 0.35, radius * 0.16);
  ctx.quadraticCurveTo(-radius * 0.65, radius * 0.45, -radius, 0);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(237,174,255,.66)";
  ctx.lineWidth = 2;
  for (let strand = -2; strand <= 2; strand++) {
    ctx.beginPath();
    ctx.moveTo(strand * radius * 0.22, radius * 0.18);
    ctx.bezierCurveTo(strand * 8 + Math.sin(time * 2 + strand) * 7, radius * 0.8, strand * 7 - Math.sin(time + strand) * 8, radius * 1.3, strand * 5, radius * 1.75);
    ctx.stroke();
  }
  ctx.restore();
}

function drawNet(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, time: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "rgba(194,205,184,.7)";
  ctx.lineWidth = 2;
  for (let row = 0; row <= height; row += 18) {
    ctx.beginPath();
    ctx.moveTo(-width / 2, row);
    ctx.lineTo(width / 2, row + Math.sin(time + row) * 3);
    ctx.stroke();
  }
  for (let column = -width / 2; column <= width / 2; column += 15) {
    ctx.beginPath();
    ctx.moveTo(column, 0);
    ctx.lineTo(column + Math.sin(time * 0.8 + column) * 3, height);
    ctx.stroke();
  }
  ctx.fillStyle = "#df785e";
  for (let buoy = -width / 2; buoy <= width / 2; buoy += 18) {
    ctx.beginPath();
    ctx.arc(buoy, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVent(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, time: number, phase: number) {
  const active = Math.sin(time * 2.3 + phase) > 0.25;
  ctx.fillStyle = "#123a47";
  ctx.beginPath();
  ctx.ellipse(x, y + 8, radius * 0.75, 24, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = active ? "rgba(102,244,224,.7)" : "rgba(102,185,183,.28)";
  ctx.lineWidth = active ? 3 : 1.5;
  for (let bubble = 0; bubble < 7; bubble++) {
    const travel = (time * (active ? 95 : 28) + bubble * 29 + phase * 10) % (radius * 2.2);
    ctx.beginPath();
    ctx.arc(x + Math.sin(bubble * 2.4) * radius * 0.45, y - travel, 2 + bubble % 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function createAudioCue() {
  let audio: AudioContext | null = null;
  return (kind: "pickup" | "danger" | "bank" | "hurt" | "sonar", enabled: boolean) => {
    if (!enabled) return;
    try {
      audio ||= new AudioContext();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const frequencies = { pickup: 620, danger: 105, bank: 440, hurt: 150, sonar: 330 };
      oscillator.frequency.setValueAtTime(frequencies[kind], audio.currentTime);
      if (kind === "bank" || kind === "pickup") oscillator.frequency.exponentialRampToValueAtTime(frequencies[kind] * 1.45, audio.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(kind === "danger" ? 0.12 : 0.07, audio.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.18);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.2);
    } catch {
      // Audio is optional and must never interrupt play.
    }
  };
}

const audioCue = createAudioCue();

function protectOneFoodOnDefeat(g: Runtime) {
  if (hasTalent(g.save.unlockedTalents, "preserver") && g.run.food > 0) {
    g.run.food -= 1;
    g.save = { ...g.save, bankedFood: g.save.bankedFood + 1 };
  }
}

export default function FoodRunGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const held = useRef(new Set<string>());
  const touchStick = useRef({ x: 0, y: 0 });
  const touchStickPointer = useRef<number | null>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const actionQueue = useRef<string[]>([]);
  const [stickVisual, setStickVisual] = useState({ x: 0, y: 0 });
  const [resetArmed, setResetArmed] = useState(false);
  const [ui, setUi] = useState<UiSnapshot>(() => {
    const save = STARTER_SAVE;
    return {
      phase: "title", paused: false, inventory: false, health: 3, maxHealth: 3, stamina: 100, maxStamina: 100, hidden: false,
      stealth: "CLEAR", threat: "NO CONTACT", bagUsed: 0, bagCapacity: getBagCapacity(save), run: emptyRun(), save,
      tutorialStep: 0, scannerCooldown: 0, traps: 2, notice: "", zoneName: "Shallow Reef", nearHome: true,
      nearCover: false, nearWhale: false, nearSchool: null, resultXp: 0, levelGained: false, lastDelivery: null,
    };
  });

  const syncUi = useCallback((g: Runtime) => {
    let stealth = g.player.hidden ? "HIDDEN" : "CLEAR";
    let closestThreat = Number.POSITIVE_INFINITY;
    let threat = "NO CONTACT";
    for (const chunk of g.chunks.active()) {
      for (const shark of chunk.sharks) {
        const threatDistance = distance(g.player.x, g.player.y, shark.x, shark.y);
        if (threatDistance < closestThreat && threatDistance < 900) {
          closestThreat = threatDistance;
          threat = `${shark.tier.toUpperCase()} · ${Math.round(threatDistance / 10)}m`;
        }
        if (shark.state === "CHASE") stealth = "DETECTED";
        else if (stealth === "CLEAR" && !["PATROL", "RETURN"].includes(shark.state)) stealth = "SUSPICIOUS";
      }
    }
    const nearCover = g.chunks.active().some((chunk) => chunk.covers.some((cover) =>
      Math.abs(g.player.x - cover.x) < cover.width * 0.65 && g.player.y > cover.y - 20 && g.player.y < cover.y + cover.height + 16,
    ));
    setUi({
      phase: g.phase,
      paused: g.paused,
      inventory: g.inventory,
      health: g.player.health,
      maxHealth: getMaxHealth(g.save),
      stamina: g.player.stamina,
      maxStamina: getMaxStamina(g.save),
      hidden: g.player.hidden,
      stealth,
      threat,
      bagUsed: g.bagUsed,
      bagCapacity: getBagCapacity(g.save),
      run: { ...g.run },
      save: { ...g.save, settings: { ...g.save.settings } },
      tutorialStep: g.tutorialStep,
      scannerCooldown: g.scannerCooldown,
      traps: g.traps,
      notice: g.notice,
      zoneName: zoneForX(g.player.x).name,
      nearHome: g.player.x < 315,
      nearCover,
      nearWhale: !g.whale.helped && distance(g.player.x, g.player.y, g.whale.x, g.whale.y) < 150,
      nearSchool: g.player.x < 315
        ? "reef"
        : AWAY_SCHOOLS.find((id) => distance(g.player.x, g.player.y, SCHOOLS[id].position.x, SCHOOLS[id].position.y) < 160) ?? null,
      resultXp: g.resultXp,
      levelGained: g.levelGained,
      lastDelivery: g.lastDelivery,
    });
  }, []);

  const showNotice = (g: Runtime, text: string, duration = 2.2) => {
    g.notice = text;
    g.noticeTime = duration;
  };

  const beginExpedition = useCallback(() => {
    const g = runtimeRef.current;
    if (!g) return;
    const seed = Math.floor(Math.random() * 99999999);
    g.seed = seed;
    g.chunks = new ChunkManager(seed);
    g.chunks.update(0, 1600);
    g.phase = "playing";
    g.paused = false;
    g.inventory = false;
    g.player = { x: 225, y: 360, vx: 0, vy: 0, facing: 1, health: getMaxHealth(g.save), stamina: getMaxStamina(g.save), staminaDelay: 0, hidden: false, coverId: null, invulnerable: 0, whaleShield: 0, hazardCooldown: 0 };
    g.cameraX = 0;
    g.elapsed = 0;
    g.run = emptyRun();
    g.bagUsed = 0;
    g.floaters = [];
    g.zoneId = "reef";
    g.scannerCooldown = 0;
    g.scannerPulse = 0;
    g.traps = getDecoyCount(g.save);
    g.decoy = null;
    g.chargedPop = false;
    g.recordAnnounced = false;
    actionQueue.current = [];
    g.whale = { x: g.save.tutorialComplete ? 1750 : 1180, y: 260, helped: false };
    g.tutorialStep = g.save.tutorialComplete ? TUTORIAL_STEPS.length : 0;
    g.tutorialFlags = { moved: false, burst: false, hid: false, chased: false, escaped: false, whale: false, junk: false };
    showNotice(g, g.save.tutorialComplete ? "The current is open. Gather what you can—and come home." : "Lesson 1: feel the current, then swim east.", 3.5);
    gameAudio.setMusic("explore", g.save.settings.music);
    syncUi(g);
  }, [syncUi]);

  const buyCosmetic = useCallback((type: "skin" | "theme", id: string) => {
    const g = runtimeRef.current;
    if (!g) return;
    const item = type === "skin" ? SKINS.find((skin) => skin.id === id) : THEMES.find((theme) => theme.id === id);
    if (!item) return;
    const owned = type === "skin" ? g.save.ownedSkins : g.save.ownedThemes;
    if (owned.includes(id)) {
      g.save = type === "skin" ? { ...g.save, activeSkin: id } : { ...g.save, activeTheme: id };
      persistSave(g.save);
      syncUi(g);
      return;
    }
    if (g.save.reefTokens < item.cost) {
      showNotice(g, `Need ${item.cost - g.save.reefTokens} more Reef Tokens for ${item.name}.`, 2.2);
      syncUi(g);
      return;
    }
    g.save = {
      ...g.save,
      reefTokens: g.save.reefTokens - item.cost,
      ...(type === "skin"
        ? { ownedSkins: [...g.save.ownedSkins, id], activeSkin: id }
        : { ownedThemes: [...g.save.ownedThemes, id], activeTheme: id }),
    };
    persistSave(g.save);
    showNotice(g, `${item.name} unlocked and equipped!`, 2.4);
    audioCue("bank", g.save.settings.sound);
    syncUi(g);
  }, [syncUi]);

  const goHome = useCallback(() => {
    const g = runtimeRef.current;
    if (!g) return;
    g.save = accrueReefTokens(g.save, Date.now()).save;
    persistSave(g.save);
    g.phase = "home";
    g.paused = false;
    g.inventory = false;
    g.player.x = 210;
    g.player.y = 360;
    g.cameraX = 0;
    gameAudio.setMusic("home", g.save.settings.music);
    syncUi(g);
  }, [syncUi]);

  const bankRun = useCallback((g: Runtime, schoolId: SchoolId) => {
    const banked = bankRunProgress(g.save, g.run, schoolId);
    const outcome = applyRunOutcome(banked.save, g.run, true);
    const next = accrueReefTokens(outcome.save, Date.now()).save;
    g.levelGained = banked.levelGained;
    if (!next.tutorialComplete && g.tutorialStep >= TUTORIAL_STEPS.length - 1) next.tutorialComplete = true;
    g.save = next;
    g.resultXp = banked.earnedXp;
    g.lastDelivery = {
      schoolId,
      foodDelivered: banked.foodDelivered,
      schoolLevelGained: banked.schoolLevelGained,
      population: next.schools[schoolId].population,
      schoolLevel: next.schools[schoolId].level,
      newRecord: outcome.newRecord || (g.recordAnnounced && g.run.distance >= next.stats.maxDistance),
      achievements: outcome.earnedAchievements.map((def) => def.name),
    };
    for (let i = 0; i < 26; i++) {
      g.particles.push({ x: g.player.x, y: g.player.y, vx: (Math.random() - 0.5) * 190, vy: (Math.random() - 0.7) * 160, life: 0.7 + Math.random() * 0.7, size: 2 + Math.random() * 4, kind: "spark" });
    }
    showNotice(g, `${banked.foodDelivered} food fed to ${SCHOOLS[schoolId].name}${banked.schoolLevelGained ? " — the school grew!" : ""}`, 3);
    g.phase = "results";
    g.paused = false;
    g.inventory = false;
    persistSave(next);
    audioCue("bank", next.settings.sound);
    gameAudio.setMusic("home", next.settings.music);
    if (banked.schoolLevelGained) gameAudio.playSchoolLevelUp(next.settings.sound);
    else gameAudio.playCreature("dolphin", next.settings.sound);
    syncUi(g);
  }, [syncUi]);

  const chooseFish = useCallback((fishType: SaveData["fishType"]) => {
    const g = runtimeRef.current;
    if (!g) return;
    g.save = { ...g.save, fishType };
    persistSave(g.save);
    syncUi(g);
  }, [syncUi]);

  const craftBag = useCallback(() => {
    const g = runtimeRef.current;
    if (!g) return;
    const cost = 4 + g.save.bagLevel * 5;
    if (g.save.salvage < cost) {
      showNotice(g, `Need ${cost - g.save.salvage} more salvage for this weave.`);
    } else {
      g.save = { ...g.save, salvage: g.save.salvage - cost, bagLevel: g.save.bagLevel + 1 };
      persistSave(g.save);
      showNotice(g, `Bag upgraded — capacity ${getBagCapacity(g.save)}.`);
      audioCue("bank", g.save.settings.sound);
    }
    syncUi(g);
  }, [syncUi]);

  const updateSetting = useCallback((key: keyof SaveData["settings"], value: boolean | number) => {
    const g = runtimeRef.current;
    if (!g) return;
    g.save = { ...g.save, settings: { ...g.save.settings, [key]: value } };
    persistSave(g.save);
    if (key === "music") {
      if (!value) gameAudio.stopMusic();
      else gameAudio.setMusic(g.phase === "playing" ? "explore" : "home", true);
    }
    syncUi(g);
  }, [syncUi]);

  const unlockTalent = useCallback((id: TalentId) => {
    const g = runtimeRef.current;
    if (!g) return;
    const talent = TALENTS.find((entry) => entry.id === id);
    const points = talentPointsForLevel(g.save.level) - g.save.unlockedTalents.length;
    if (!talent || hasTalent(g.save.unlockedTalents, id)) return;
    const takenAlternative = exclusiveGroupTaken(g.save.unlockedTalents, talent);
    if (takenAlternative) {
      showNotice(g, `Your bubbles already carry ${takenAlternative.name} — one bubble craft only.`, 2.4);
    } else if (points <= 0 || g.save.level < talent.level || (talent.prerequisite && !hasTalent(g.save.unlockedTalents, talent.prerequisite))) {
      showNotice(g, talent?.prerequisite ? "Unlock the previous talent in this current first." : "Reach a higher level to earn another talent point.");
    } else {
      g.save = { ...g.save, unlockedTalents: [...g.save.unlockedTalents, id] };
      persistSave(g.save);
      showNotice(g, `${talent.name} unlocked — ${talent.description}.`, 3);
      audioCue("bank", g.save.settings.sound);
    }
    syncUi(g);
  }, [syncUi]);

  useEffect(() => {
    const g = freshRuntime(loadSave());
    const arrival = accrueReefTokens(g.save, Date.now());
    g.save = arrival.save;
    persistSave(g.save);
    if (arrival.earned > 0) showNotice(g, `YOUR REEF GREW WHILE YOU WERE AWAY — +${arrival.earned} Reef Token${arrival.earned === 1 ? "" : "s"}`, 8);
    runtimeRef.current = g;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate the UI from the persisted canvas runtime once on mount.
    syncUi(g);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    let frame = 0;
    let previous = performance.now();

    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Tab"].includes(event.key)) event.preventDefault();
      const key = event.key.toLowerCase();
      held.current.add(key);
      if (event.repeat) return;
      if (g.phase === "playing" && !g.paused && !g.inventory) {
        const impulse = 20;
        if (key === "d" || key === "arrowright") { g.player.vx += impulse; g.player.facing = 1; }
        if (key === "a" || key === "arrowleft") { g.player.vx -= impulse; g.player.facing = -1; }
        if (key === "w" || key === "arrowup") g.player.vy -= impulse;
        if (key === "s" || key === "arrowdown") g.player.vy += impulse;
        if (event.shiftKey && ["d", "a", "w", "s", "arrowright", "arrowleft", "arrowup", "arrowdown"].includes(key)) {
          g.player.stamina = Math.max(0, g.player.stamina - 4);
          g.player.staminaDelay = 0.9;
          g.tutorialFlags.burst = true;
        }
      }
      if (key === "escape" && g.phase === "playing") {
        g.paused = !g.paused;
        g.inventory = false;
        syncUi(g);
      } else if (key === "tab" && g.phase === "playing" && !g.paused) {
        g.inventory = !g.inventory;
        syncUi(g);
      } else if (key === "e" || key === "f" || key === "q") {
        actionQueue.current.push(key);
      } else if (key === "enter" && g.phase === "title") {
        g.phase = "home";
        gameAudio.setMusic("home", g.save.settings.music);
        syncUi(g);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => held.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const updateTutorial = () => {
      if (g.save.tutorialComplete || g.tutorialStep >= TUTORIAL_STEPS.length) return;
      const flags = g.tutorialFlags;
      const complete = [flags.moved, g.run.food > 0, flags.burst, flags.hid, flags.escaped, flags.whale, flags.junk, false];
      if (complete[g.tutorialStep]) {
        g.tutorialStep += 1;
        showNotice(g, g.tutorialStep < TUTORIAL_STEPS.length ? TUTORIAL_STEPS[g.tutorialStep] : "Training complete.", 2.8);
      }
    };

    const interact = () => {
      const awaySchool = AWAY_SCHOOLS.find((id) => distance(g.player.x, g.player.y, SCHOOLS[id].position.x, SCHOOLS[id].position.y) < 160);
      if (awaySchool) {
        if (g.run.food + g.run.salvage <= 0) showNotice(g, `${SCHOOLS[awaySchool].name} needs food, not an empty current.`);
        else bankRun(g, awaySchool);
        return;
      }
      if (g.player.x < 315) {
        if (g.run.food + g.run.salvage <= 0) showNotice(g, "Your bag is empty. The school needs food.");
        else if (!g.save.tutorialComplete && (g.tutorialStep < TUTORIAL_STEPS.length - 1 || g.run.food <= 0)) {
          showNotice(g, "Finish the training route before extracting your haul.", 2.2);
        }
        else {
          if (!g.save.tutorialComplete) g.tutorialStep = TUTORIAL_STEPS.length;
          bankRun(g, "reef");
        }
        return;
      }
      if (!g.whale.helped && distance(g.player.x, g.player.y, g.whale.x, g.whale.y) < 150) {
        g.whale.helped = true;
        g.player.whaleShield = 10;
        g.player.stamina = 100;
        g.run.creaturesHelped += 1;
        g.tutorialFlags.whale = true;
        g.player.vx += 120;
        showNotice(g, "Whale song: sheltered and carried by a gentle current.", 3.2);
        audioCue("bank", g.save.settings.sound);
        gameAudio.playCreature("whale", g.save.settings.sound);
        return;
      }
      let chosen: { id: string; x: number; y: number } | null = null;
      for (const chunk of g.chunks.active()) {
        for (const cover of chunk.covers) {
          if (Math.abs(g.player.x - cover.x) < cover.width * 0.65 && g.player.y > cover.y - 24 && g.player.y < cover.y + cover.height + 18) chosen = cover;
        }
      }
      if (chosen) {
        if (g.player.hidden && g.player.coverId === chosen.id) {
          g.player.hidden = false;
          g.player.coverId = null;
          showNotice(g, "You leave cover.", 1.2);
        } else {
          g.player.hidden = true;
          g.player.coverId = chosen.id;
          g.player.vx *= 0.15;
          g.player.vy *= 0.15;
          g.tutorialFlags.hid = true;
          showNotice(g, "Hidden — stay still and watch the shark's state.", 2.2);
        }
      } else showNotice(g, "Nothing close enough to interact with.", 1.3);
    };

    const update = (dt: number, width: number) => {
      if (g.phase !== "playing" || g.paused || g.inventory) return;
      g.elapsed += dt;
      g.run.duration = g.elapsed;
      g.player.invulnerable = Math.max(0, g.player.invulnerable - dt);
      g.player.whaleShield = Math.max(0, g.player.whaleShield - dt);
      g.player.hazardCooldown = Math.max(0, g.player.hazardCooldown - dt);
      g.scannerCooldown = Math.max(0, g.scannerCooldown - dt);
      g.scannerPulse = Math.max(0, g.scannerPulse - dt * 0.65);
      g.noticeTime = Math.max(0, g.noticeTime - dt);
      if (g.noticeTime === 0) g.notice = "";
      if (g.decoy) {
        g.decoy.life -= dt;
        if (!g.decoy.popped) {
          // The decoy flies as a projectile, then pops into a noisy bubble column.
          g.decoy.x += g.decoy.vx * dt;
          g.decoy.y += g.decoy.vy * dt;
          if (Math.random() < dt * 30) g.particles.push({ x: g.decoy.x, y: g.decoy.y, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 25, life: 0.6, size: 1.5 + Math.random() * 2.5, kind: "bubble" });
          const hitBounds = g.decoy.y < WORLD.surfaceY + 30 || g.decoy.y > WORLD.floorY - 18 || g.decoy.x < 110;
          if (g.decoy.life <= 0 || hitBounds) {
            g.decoy.popped = true;
            g.decoy.life = 5.5;
            g.decoy.y = clamp(g.decoy.y, WORLD.surfaceY + 40, WORLD.floorY - 25);
            for (let i = 0; i < 14; i++) g.particles.push({ x: g.decoy.x, y: g.decoy.y, vx: (Math.random() - 0.5) * 130, vy: (Math.random() - 0.8) * 110, life: 0.6 + Math.random() * 0.5, size: 2 + Math.random() * 4, kind: "bubble" });
            audioCue("sonar", g.save.settings.sound);
            // The pop is loud: minions and lieutenants snap toward it. Bosses ignore toys.
            const stunCraft = hasTalent(g.save.unlockedTalents, "stun-bubble");
            const guardianCraft = hasTalent(g.save.unlockedTalents, "guardian-bubble");
            const radiusMult = getBubbleRadiusMultiplier(g.save) * (g.decoy.charged ? 1.5 : 1);
            const durationMult = getBubbleDurationMultiplier(g.save) * (g.decoy.charged ? 1.5 : 1);
            for (const chunk of g.chunks.active()) {
              for (const shark of chunk.sharks) {
                if (shark.tier === "boss") continue;
                const popDistance = distance(shark.x, shark.y, g.decoy.x, g.decoy.y);
                if (popDistance >= 520 * radiusMult) continue;
                if (shark.decoySavvy >= decoySavvyLimit(shark.tier)) {
                  // This one has seen the trick too often to fall for it again.
                  g.floaters.push({ x: shark.x, y: shark.y - 44, text: "WISE TO IT", color: "#9fb9c9", life: 1.1 });
                  continue;
                }
                const potency = durationMult * decoySavvyDecay(shark.decoySavvy);
                shark.decoySavvy += 1;
                if (stunCraft && popDistance < 190 * radiusMult) shark.stunned = Math.max(shark.stunned, (shark.tier === "minion" ? 2 : 1) * potency);
                if (guardianCraft && shark.tier === "minion" && popDistance < 450 * radiusMult) {
                  shark.feared = 3.4 * potency;
                  shark.alert = 0;
                  continue;
                }
                if (shark.state !== "CHASE") {
                  shark.lastKnownX = g.decoy.x;
                  shark.lastKnownY = g.decoy.y;
                  shark.state = "INVESTIGATE";
                  shark.stateTime = 0;
                  shark.alert = Math.max(shark.alert, 0.4);
                }
              }
            }
          }
        }
        if (g.decoy && g.decoy.life <= 0) g.decoy = null;
      }
      for (const floater of g.floaters) {
        floater.y -= 30 * dt;
        floater.life -= dt;
      }
      g.floaters = g.floaters.filter((floater) => floater.life > 0).slice(-24);
      const zone = zoneForX(g.player.x);
      if (zone.id !== g.zoneId) {
        const enteringDeeper = zone.startX > (g.zoneId === "reef" ? 0 : g.zoneId === "kelp" ? 2700 : 5400);
        g.zoneId = zone.id;
        if (enteringDeeper) showNotice(g, `${zone.name.toUpperCase()} — ${zone.hint}.`, 3);
      }

      while (actionQueue.current.length) {
        const action = actionQueue.current.shift();
        if (action === "e") interact();
        if (action === "f") {
          if (g.scannerCooldown > 0) showNotice(g, `Scanner recharging: ${Math.ceil(g.scannerCooldown)}s`, 1.1);
          else {
            g.scannerCooldown = getSonarCooldown(g.save);
            g.scannerPulse = 1;
            showNotice(g, "Sonar: solid ring is sight; dashed ring is hearing. Your pulse is noisy.", 2.5);
            audioCue("sonar", g.save.settings.sound);
            for (const chunk of g.chunks.active()) {
              for (const shark of chunk.sharks) {
                if (Math.abs(shark.x - g.player.x) < ENEMY_ARCHETYPES[shark.kind].sonarRadius && shark.state === "PATROL") {
                  shark.state = "SUSPICIOUS";
                  shark.lastKnownX = g.player.x;
                  shark.lastKnownY = g.player.y;
                  shark.stateTime = 0;
                }
              }
            }
          }
        }
        if (action === "q") {
          if (g.traps <= 0) showNotice(g, "No bubble decoys left.", 1.2);
          else if (g.decoy && !g.decoy.popped) showNotice(g, "A decoy is already in the water.", 1.1);
          else {
            g.traps -= 1;
            g.decoy = { x: g.player.x + g.player.facing * 26, y: g.player.y, vx: g.player.facing * 430 + g.player.vx * 0.4, vy: -34, life: 0.85, popped: false, charged: g.chargedPop, slept: [] };
            showNotice(g, g.chargedPop ? "Supercharged bubble away — brace for a mighty pop." : "Bubble decoy fired — it pops loud where it lands.", 1.6);
            g.chargedPop = false;
          }
        }
      }

      const left = held.current.has("a") || held.current.has("arrowleft");
      const right = held.current.has("d") || held.current.has("arrowright");
      const up = held.current.has("w") || held.current.has("arrowup");
      const down = held.current.has("s") || held.current.has("arrowdown");
      const inputX = (right ? 1 : 0) - (left ? 1 : 0) + touchStick.current.x;
      const inputY = (down ? 1 : 0) - (up ? 1 : 0) + touchStick.current.y;
      const rawInputLength = Math.hypot(inputX, inputY);
      const inputLength = rawInputLength || 1;
      const inputStrength = Math.min(1, rawInputLength);
      const moving = inputStrength > 0.01;
      const wantsBurst = (held.current.has("shift") || held.current.has(" ")) && moving && g.player.stamina > 1;
      const loadRatio = g.bagUsed / getBagCapacity(g.save);
      const loadPenalty = 1 - Math.max(0, loadRatio - 0.6) * 0.18;
      const fish = FISH_TYPES[g.save.fishType];
      const talentSpeed = (hasTalent(g.save.unlockedTalents, "current-rider") ? 1.08 : 1) * getSchoolSpeedMultiplier(g.save);
      const burstBonus = wantsBurst ? getBurstSpeedMultiplier(g.save) : 1;
      const accel = (wantsBurst ? 530 : 262) * loadPenalty * fish.speed * talentSpeed * burstBonus;
      const maxSpeed = (wantsBurst ? 300 : 150) * loadPenalty * fish.speed * talentSpeed * burstBonus;
      if (moving) {
        g.player.vx += (inputX / inputLength) * accel * inputStrength * dt;
        g.player.vy += (inputY / inputLength) * accel * inputStrength * dt;
        if (Math.abs(inputX) > 0.05) g.player.facing = inputX > 0 ? 1 : -1;
        g.player.hidden = false;
        g.player.coverId = null;
        if (Math.abs(g.player.x - 225) > 70) g.tutorialFlags.moved = true;
      }
      const drag = moving ? 0.972 : 0.94;
      g.player.vx *= Math.pow(drag, dt * 60);
      g.player.vy *= Math.pow(drag, dt * 60);
      const speed = Math.hypot(g.player.vx, g.player.vy);
      if (speed > maxSpeed) {
        g.player.vx = (g.player.vx / speed) * maxSpeed;
        g.player.vy = (g.player.vy / speed) * maxSpeed;
      }
      if (wantsBurst) {
        g.player.stamina = Math.max(0, g.player.stamina - 34 * dt * (1 + loadRatio * 0.16) * fish.burstCost * getBurstDrainMultiplier(g.save));
        g.player.staminaDelay = 0.9;
        g.tutorialFlags.burst = true;
        if (Math.random() < dt * 22) g.particles.push({ x: g.player.x - g.player.facing * 22, y: g.player.y + (Math.random() - 0.5) * 18, vx: -g.player.facing * (45 + Math.random() * 30), vy: -14 - Math.random() * 18, life: 0.8, size: 2 + Math.random() * 4, kind: "bubble" });
      } else {
        g.player.staminaDelay -= dt;
        if (g.player.staminaDelay <= 0) g.player.stamina = Math.min(getMaxStamina(g.save), g.player.stamina + 22 * fish.staminaRegen * getStaminaRegenMultiplier(g.save) * dt);
      }

      const playerChunk = g.chunks.chunks.get(Math.floor(g.player.x / WORLD.chunkWidth));
      const currentResist = (hasTalent(g.save.unlockedTalents, "tide-dancer") ? 0.55 : 1) * getCurrentResistMultiplier(g.save);
      if (playerChunk) g.player.vx += playerChunk.current * dt * (wantsBurst ? 0.35 : 1) * currentResist;
      g.player.x = Math.max(105, g.player.x + g.player.vx * dt);
      g.player.y = clamp(g.player.y + g.player.vy * dt, WORLD.surfaceY + 35, WORLD.floorY - 25);
      g.run.distance = Math.max(g.run.distance, Math.max(0, g.player.x - 225));
      if (!g.recordAnnounced && g.save.stats.maxDistance > 0 && g.run.distance > g.save.stats.maxDistance) {
        g.recordAnnounced = true;
        g.floaters.push({ x: g.player.x, y: g.player.y - 42, text: "NEW DISTANCE RECORD!", color: "#ffe27a", life: 2.2 });
        showNotice(g, "NEW DISTANCE RECORD!", 2.4);
        audioCue("bank", g.save.settings.sound);
      }
      const earnedNow = newlyEarnedAchievements(g.save.achievements, { maxDistance: Math.max(g.save.stats.maxDistance, g.run.distance) });
      if (earnedNow.length > 0) {
        // Achievements land the moment the threshold is crossed and survive defeat.
        g.save = { ...g.save, achievements: [...g.save.achievements, ...earnedNow.map((def) => def.id)] };
        persistSave(g.save);
        g.floaters.push({ x: g.player.x, y: g.player.y - 58, text: `★ ${earnedNow[0].name.toUpperCase()}`, color: "#8dffe6", life: 2.4 });
        showNotice(g, `ACHIEVEMENT — ${earnedNow[0].name}!`, 3);
        audioCue("bank", g.save.settings.sound);
      }
      const lookAhead = clamp(g.player.vx * 0.42, -65, 145);
      const desiredCamera = Math.max(0, g.player.x - width * 0.35 + lookAhead);
      g.cameraX += (desiredCamera - g.cameraX) * Math.min(1, dt * 3.2);
      g.chunks.update(g.cameraX, width);

      for (const particle of g.particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.life -= dt;
      }
      g.particles = g.particles.filter((particle) => particle.life > 0).slice(-140);

      for (const chunk of g.chunks.active()) {
        for (const hazard of chunk.hazards) {
          if (hazard.kind === "net") {
            const caught = Math.abs(g.player.x - hazard.x) < hazard.width / 2 + 14
              && g.player.y > hazard.y - 14
              && g.player.y < hazard.y + hazard.height + 14;
            if (caught) {
              const netTrained = hasTalent(g.save.unlockedTalents, "slipstream");
              const resistance = wantsBurst ? (netTrained ? 0.96 : 0.9) : (netTrained ? 0.88 : 0.76);
              g.player.vx *= resistance;
              g.player.vy *= resistance;
              g.player.stamina = Math.max(0, g.player.stamina - dt * (wantsBurst ? 15 : 7) * (netTrained ? 0.55 : 1));
              if (g.player.hazardCooldown <= 0) {
                g.player.hazardCooldown = 2.2;
                showNotice(g, wantsBurst ? "You force through the net, but it costs stamina." : "ENTANGLED — reverse course or burst through the loose mesh.", 2.1);
              }
            }
          } else if (hazard.kind === "vent") {
            const active = Math.sin(g.elapsed * 2.3 + hazard.phase) > 0.25;
            const inColumn = Math.abs(g.player.x - hazard.x) < hazard.radius && g.player.y > hazard.y - hazard.radius * 2.3;
            if (active && inColumn) {
              const lift = 235 * (1 - Math.abs(g.player.x - hazard.x) / hazard.radius);
              g.player.vy -= lift * dt;
              g.player.stamina = Math.max(0, g.player.stamina - 5 * dt);
              if (g.player.hazardCooldown <= 0) {
                g.player.hazardCooldown = 2.4;
                showNotice(g, "VENT SURGE — ride the lift or swim around its pulse.", 2);
              }
            }
          } else {
            const stung = distance(g.player.x, g.player.y, hazard.x, hazard.y) < hazard.radius + 20;
            if (stung && g.player.hazardCooldown <= 0 && g.player.invulnerable <= 0) {
              const pushX = g.player.x >= hazard.x ? 1 : -1;
              g.player.hazardCooldown = 2;
              g.player.invulnerable = 1.4;
              g.player.health -= 1;
              g.player.vx = pushX * 175;
              g.player.vy = -95;
              g.shake = g.save.settings.reducedMotion ? 1 : 5;
              showNotice(g, "JELLYFISH STING — it guards space but will not chase.", 2.2);
              audioCue("hurt", g.save.settings.sound);
              if (g.player.health <= 0) {
                g.phase = "defeat";
                g.paused = false;
                g.inventory = false;
                protectOneFoodOnDefeat(g);
                g.save = applyRunOutcome(g.save, g.run, false).save;
                persistSave(g.save);
                syncUi(g);
                return;
              }
            }
          }
        }

        for (const pickup of chunk.pickups) {
          if (pickup.collected || distance(g.player.x, g.player.y, pickup.x, pickup.y) > FISH_TYPES[g.save.fishType].gatherRadius) continue;
          if (pickup.kind === "bubble") {
            pickup.collected = true;
            g.traps += 1;
            g.chargedPop = true;
            g.floaters.push({ x: pickup.x, y: pickup.y - 14, text: "+1 CHARGED DECOY", color: "#e9a8ff", life: 1.3 });
            showNotice(g, "A bubble pearl hums in your fins — the next pop will be mighty.", 2.2);
            for (let i = 0; i < 10; i++) g.particles.push({ x: pickup.x, y: pickup.y, vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.6) * 80, life: 0.5 + Math.random() * 0.4, size: 2 + Math.random() * 3, kind: "bubble" });
            audioCue("pickup", g.save.settings.sound);
            continue;
          }
          if (g.bagUsed + pickup.size > getBagCapacity(g.save)) {
            if (g.notice !== "Bag full — return home or leave something behind.") showNotice(g, "Bag full — return home or leave something behind.", 1.8);
            continue;
          }
          pickup.collected = true;
          g.bagUsed += pickup.size;
          if (pickup.kind === "food") {
            const keenFind = hasTalent(g.save.unlockedTalents, "keen-current") && !pickup.rare && Math.random() < 0.12;
            const gained = pickup.value + (pickup.rare ? getRareFoodBonus(g.save) : 0) + (keenFind ? 2 : 0);
            g.run.food += gained;
            g.floaters.push({ x: pickup.x, y: pickup.y - 14, text: `+${gained} FOOD`, color: pickup.rare ? "#8dffe6" : "#ffd75f", life: 1.1 });
            if (keenFind) {
              g.run.rareDiscoveries += 1;
              showNotice(g, "Keen Current found a richer food cluster.", 1.6);
            }
          }
          else {
            g.run.salvage += pickup.value;
            g.tutorialFlags.junk = true;
            g.floaters.push({ x: pickup.x, y: pickup.y - 14, text: `+${pickup.value} SALVAGE`, color: "#73d9e3", life: 1.1 });
          }
          if (pickup.rare) g.run.rareDiscoveries += 1;
          for (let i = 0; i < (pickup.rare ? 13 : 7); i++) g.particles.push({ x: pickup.x, y: pickup.y, vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.5) * 80, life: 0.5 + Math.random() * 0.4, size: 2 + Math.random() * 3, kind: "spark" });
          audioCue("pickup", g.save.settings.sound);
        }

        for (const shark of chunk.sharks) {
          const enemy = ENEMY_ARCHETYPES[shark.kind];
          shark.stateTime += dt;
          shark.attackCooldown = Math.max(0, shark.attackCooldown - dt);
          shark.stunned = Math.max(0, shark.stunned - dt);
          shark.sleeping = Math.max(0, shark.sleeping - dt);
          shark.feared = Math.max(0, shark.feared - dt);
          if (g.decoy?.popped && shark.tier !== "boss" && shark.sleeping <= 0
            && hasTalent(g.save.unlockedTalents, "dream-bubble") && !g.decoy.slept.includes(shark.id)
            && shark.decoySavvy < decoySavvyLimit(shark.tier)
            && distance(shark.x, shark.y, g.decoy.x, g.decoy.y) < 135 * getBubbleRadiusMultiplier(g.save) * (g.decoy.charged ? 1.5 : 1)) {
            shark.sleeping = (shark.tier === "minion" ? 3.2 : 1.4) * getBubbleDurationMultiplier(g.save) * decoySavvyDecay(shark.decoySavvy) * (g.decoy.charged ? 1.5 : 1);
            g.decoy.slept.push(shark.id);
          }
          if (shark.feared > 0) {
            // The phantom guardian sends minions fleeing; they forget the player entirely.
            const fleeFrom = g.decoy ? g.decoy.x : g.player.x;
            shark.facing = shark.x >= fleeFrom ? 1 : -1;
            shark.vx += (shark.facing * enemy.chaseSpeed * 0.9 - shark.vx) * Math.min(1, dt * 2.4);
            shark.alert = 0;
            shark.x += shark.vx * dt;
            shark.y = clamp(shark.y, WORLD.surfaceY + 55, WORLD.floorY - 55);
            continue;
          }
          if (shark.stunned > 0 || shark.sleeping > 0) {
            shark.vx *= Math.pow(0.8, dt * 60);
            shark.alert = Math.max(0, shark.alert - dt * 0.6);
            shark.x += shark.vx * dt;
            shark.y = clamp(shark.y, WORLD.surfaceY + 55, WORLD.floorY - 55);
            continue;
          }
          const dx = g.player.x - shark.x;
          const dy = g.player.y - shark.y;
          const dist = Math.hypot(dx, dy);
          const playerSpeed = Math.hypot(g.player.vx, g.player.vy);
          const inFront = dx * shark.facing > -40;
          const hearingRadius = enemy.hearingRadius * (hasTalent(g.save.unlockedTalents, "quiet-wake") ? 0.72 : 1) * getPredatorHearingMultiplier(g.save);
          const burstNoise = wantsBurst && dist < hearingRadius * getBurstNoiseMultiplier(g.save);
          const sonarNoise = g.scannerPulse > 0.7 && dist < enemy.sonarRadius;
          const currentVision = enemy.visionRadius * (playerSpeed > 180 ? 1.28 : 1) * (hasTalent(g.save.unlockedTalents, "shadow-skin") ? 0.82 : 1) * getPredatorVisionMultiplier(g.save);
          const sees = !g.player.hidden && dist < currentVision && (inFront || dist < enemy.visionRadius * 0.38);
          const inSchoolSafety = g.player.x < 500 || AWAY_SCHOOLS.some((id) => Math.abs(g.player.x - SCHOOLS[id].position.x) < 240);
          const detects = !inSchoolSafety && (sees || burstNoise || sonarNoise);
          if (enemy.tier === "boss" && dist < 1000 && !shark.warned) {
            shark.warned = true;
            showNotice(g, "COLOSSAL SHADOW — its awareness reaches far. Sonar reveals the radii.", 4.2);
            g.shake = g.save.settings.reducedMotion ? 2 : 7;
          }
          // Popped decoys hold attention by tier: minions the full bubble, smarter
          // lieutenants only briefly, bosses never.
          const decoyHoldsAttention = g.decoy?.popped && shark.tier !== "boss"
            && (shark.tier === "minion" ? g.decoy.life > 0 : g.decoy.life > 2.75);
          if (g.decoy && decoyHoldsAttention && distance(shark.x, shark.y, g.decoy.x, g.decoy.y) < 460 && shark.state !== "CHASE") {
            shark.lastKnownX = g.decoy.x;
            shark.lastKnownY = g.decoy.y;
            shark.state = "INVESTIGATE";
            shark.stateTime = 0;
          }
          if (detects) {
            shark.lastKnownX = g.player.x;
            shark.lastKnownY = g.player.y;
            shark.alert = Math.min(1, shark.alert + dt * (burstNoise ? enemy.alertGain * 1.85 : enemy.alertGain));
          } else shark.alert = Math.max(0, shark.alert - dt * 0.35);

          const steer = (tx: number, ty: number, speedValue: number) => {
            const sx = tx - shark.x;
            const sy = ty - shark.y;
            const length = Math.hypot(sx, sy) || 1;
            shark.vx += ((sx / length) * speedValue - shark.vx) * Math.min(1, dt * 2.4);
            shark.y += (sy / length) * speedValue * dt;
            if (Math.abs(sx) > 8) shark.facing = sx > 0 ? 1 : -1;
          };

          if (shark.state === "PATROL") {
            shark.vx = shark.facing * enemy.patrolSpeed;
            if (Math.abs(shark.x - shark.homeX) > enemy.patrolRadius) shark.facing = shark.x > shark.homeX ? -1 : 1;
            if (shark.alert > 0.32) {
              shark.state = "SUSPICIOUS";
              shark.stateTime = 0;
              audioCue("danger", g.save.settings.sound);
            }
          } else if (shark.state === "SUSPICIOUS") {
            shark.vx *= 0.9;
            if (shark.alert > 0.82) {
              shark.state = "CHASE";
              shark.stateTime = 0;
              g.tutorialFlags.chased = true;
              gameAudio.setMusic(enemy.tier === "boss" ? "boss" : "danger", g.save.settings.music);
            } else if (shark.stateTime > 1.0) {
              shark.state = "INVESTIGATE";
              shark.stateTime = 0;
            }
          } else if (shark.state === "INVESTIGATE") {
            steer(shark.lastKnownX, shark.lastKnownY, enemy.investigateSpeed);
            if (detects && shark.alert > 0.74) {
              shark.state = "CHASE";
              shark.stateTime = 0;
              g.tutorialFlags.chased = true;
              gameAudio.setMusic(enemy.tier === "boss" ? "boss" : "danger", g.save.settings.music);
            } else if (distance(shark.x, shark.y, shark.lastKnownX, shark.lastKnownY) < 35 || shark.stateTime > 4) {
              shark.state = "SEARCH";
              shark.stateTime = 0;
            }
          } else if (shark.state === "SEARCH") {
            const searchX = shark.lastKnownX + Math.sin(shark.stateTime * 1.7) * 110;
            const searchY = shark.lastKnownY + Math.cos(shark.stateTime * 1.2) * 70;
            steer(searchX, searchY, enemy.investigateSpeed * 0.82);
            if (detects && shark.alert > 0.66) {
              shark.state = "CHASE";
              shark.stateTime = 0;
              g.tutorialFlags.chased = true;
              gameAudio.setMusic(enemy.tier === "boss" ? "boss" : "danger", g.save.settings.music);
            } else if (shark.stateTime > 5) {
              shark.state = "LOST TARGET";
              shark.stateTime = 0;
              if (g.tutorialFlags.chased && !g.tutorialFlags.escaped) {
                g.tutorialFlags.escaped = true;
                g.run.predatorsEscaped += 1;
              }
            }
          } else if (shark.state === "CHASE") {
            steer(g.player.x, g.player.y, enemy.chaseSpeed);
            if (g.player.hidden || dist > enemy.disengageRadius || g.player.whaleShield > 0) {
              if (shark.stateTime > 0.45) {
                shark.state = "SEARCH";
                shark.lastKnownX = g.player.x;
                shark.lastKnownY = g.player.y;
                shark.stateTime = 0;
                if (!g.tutorialFlags.escaped) {
                  g.tutorialFlags.escaped = true;
                  g.run.predatorsEscaped += 1;
                }
              }
            }
            if (dist < enemy.attackRadius && shark.attackCooldown <= 0 && g.player.invulnerable <= 0 && g.player.whaleShield <= 0) {
              shark.attackCooldown = enemy.tier === "boss" ? 2.2 : enemy.tier === "minion" ? 1.8 : 1.5;
              g.player.invulnerable = 1.6;
              g.player.health -= enemy.damage;
              g.player.vx = dx > 0 ? 190 : -190;
              g.player.vy = dy > 0 ? 100 : -100;
              g.shake = g.save.settings.reducedMotion ? 2 : 10;
              const foodLost = Math.min(g.run.food, enemy.damage);
              if (foodLost > 0) {
                g.run.food -= foodLost;
                g.bagUsed = Math.max(0, g.bagUsed - foodLost);
                g.floaters.push({ x: g.player.x, y: g.player.y - 30, text: `-${foodLost} FOOD`, color: "#ff8092", life: 1.2 });
              }
              showNotice(g, "Struck! Some food scattered into the current.", 2.4);
              audioCue("hurt", g.save.settings.sound);
              if (g.player.health <= 0) {
                g.phase = "defeat";
                g.paused = false;
                g.inventory = false;
                protectOneFoodOnDefeat(g);
                g.save = applyRunOutcome(g.save, g.run, false).save;
                persistSave(g.save);
                syncUi(g);
                return;
              }
            }
          } else if (shark.state === "LOST TARGET") {
            shark.vx *= 0.94;
            if (shark.stateTime > 1.1) {
              shark.state = "RETURN";
              shark.stateTime = 0;
              gameAudio.setMusic("explore", g.save.settings.music);
            }
          } else if (shark.state === "RETURN") {
            steer(shark.homeX, 280 + Math.sin(shark.homeX) * 80, enemy.patrolSpeed * 1.2);
            if (Math.abs(shark.x - shark.homeX) < 30) {
              shark.state = "PATROL";
              shark.stateTime = 0;
              shark.alert = 0;
            }
          }
          shark.x += shark.vx * dt;
          shark.y = clamp(shark.y, WORLD.surfaceY + 55, WORLD.floorY - 55);
        }
      }
      updateTutorial();
    };

    const render = (width: number, height: number, dpr: number) => {
      const dayProgress = (g.elapsed % WORLD.dayLength) / WORLD.dayLength;
      const daylight = 0.52 + 0.48 * Math.cos((dayProgress - 0.2) * Math.PI * 2);
      const virtualHeight = 720;
      const sy = height / virtualHeight;
      const shakeX = g.shake > 0 ? (Math.random() - 0.5) * g.shake : 0;
      const shakeY = g.shake > 0 ? (Math.random() - 0.5) * g.shake : 0;
      g.shake *= 0.86;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, daylight > 0.55 ? "#36c9dc" : "#173a6b");
      bg.addColorStop(0.48, daylight > 0.55 ? "#147da1" : "#102d59");
      bg.addColorStop(1, "#06243f");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.scale(1, sy);
      ctx.translate(shakeX, shakeY);

      // Distant reef silhouettes and caustic rays form the low-cost parallax layers.
      ctx.globalAlpha = 0.11 + daylight * 0.12;
      ctx.fillStyle = "#c7fff0";
      for (let i = -1; i < width / 180 + 2; i++) {
        const x = i * 180 - ((g.cameraX * 0.08) % 180);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 90, 0);
        ctx.lineTo(x + 205, 600);
        ctx.lineTo(x + 135, 600);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = "#0b5671";
      ctx.beginPath();
      ctx.moveTo(0, 575);
      for (let x = 0; x <= width + 120; x += 80) {
        const worldX = x + g.cameraX * 0.22;
        ctx.lineTo(x, 510 + Math.sin(worldX * 0.004) * 38 + Math.sin(worldX * 0.009) * 24);
      }
      ctx.lineTo(width, 720);
      ctx.lineTo(0, 720);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.fillStyle = "#082e47";
      ctx.fillRect(0, WORLD.floorY, width, 60);
      ctx.fillStyle = "rgba(54,178,153,.11)";
      for (let i = 0; i < 18; i++) {
        const px = ((i * 137 - g.cameraX * 0.32) % (width + 100)) - 50;
        const py = 110 + ((i * 83 + g.elapsed * 12) % 500);
        ctx.beginPath();
        ctx.arc(px, py, 1.5 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }

      if (g.phase !== "title") {
        // Home reef remains a readable landmark at world zero.
        const hx = 55 - g.cameraX;
        ctx.fillStyle = "rgba(8,25,53,.45)";
        ctx.beginPath();
        ctx.ellipse(hx + 105, 560, 155, 130, -0.25, 0, Math.PI * 2);
        ctx.fill();
        const reefColors = findTheme(g.save.activeTheme).corals;
        for (let i = 0; i < 11 + g.save.reefLevel * 3; i++) {
          const rx = hx + 25 + (i * 37) % 235;
          const rh = 44 + (i * 23) % 78;
          ctx.strokeStyle = reefColors[i % reefColors.length];
          ctx.lineWidth = 8;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(rx, WORLD.floorY);
          ctx.quadraticCurveTo(rx - 12, WORLD.floorY - rh * 0.55, rx + Math.sin(i) * 18, WORLD.floorY - rh);
          ctx.stroke();
        }
        ctx.fillStyle = findTheme(g.save.activeTheme).label;
        ctx.font = "800 12px var(--font-mono), monospace";
        ctx.textAlign = "center";
        ctx.fillText("HOME REEF", hx + 120, 455);
        for (let i = 0; i < Math.min(21, 5 + g.save.reefLevel * 2); i++) {
          drawFish(ctx, hx + 75 + (i % 4) * 38, 500 + Math.floor(i / 4) * 40 + Math.sin(g.elapsed + i) * 7, i % 2 ? -1 : 1, 0, false, false);
        }
        if (g.run.food > 0 && g.player.x < 560) {
          ctx.strokeStyle = `rgba(255,214,110,${0.3 + Math.sin(g.elapsed * 3) * 0.18})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(hx + 120, 540, 175 + Math.sin(g.elapsed * 3) * 8, 0, Math.PI * 2);
          ctx.stroke();
        }

        for (const awayId of AWAY_SCHOOLS) {
          const def = SCHOOLS[awayId];
          const schoolX = def.position.x - g.cameraX;
          if (schoolX < -240 || schoolX > width + 240) continue;
          const school = g.save.schools[awayId];
          ctx.save();
          ctx.fillStyle = "rgba(14,54,92,.7)";
          ctx.beginPath(); ctx.ellipse(schoolX, def.position.y + 80, 170, 100, 0, 0, Math.PI * 2); ctx.fill();
          if (g.run.food > 0 && Math.abs(g.player.x - def.position.x) < 320) {
            ctx.strokeStyle = `rgba(120,215,202,${0.35 + Math.sin(g.elapsed * 3) * 0.2})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(schoolX, def.position.y, 150 + Math.sin(g.elapsed * 3) * 8, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = def.color;
          ctx.font = "700 12px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`${def.name.toUpperCase()} · LV ${school.level}`, schoolX, def.position.y - 105);
          for (let i = 0; i < Math.min(26, 4 + school.population); i++) {
            const orbit = g.elapsed * 0.8 + i * 0.7;
            drawFish(ctx, schoolX + Math.cos(orbit) * (62 + (i % 3) * 14), def.position.y + Math.sin(orbit * 1.4) * (38 + (i % 2) * 13), i % 2 ? -1 : 1, 0, false, false);
          }
          ctx.restore();
        }

        for (const chunk of g.chunks.active()) {
          for (const rock of chunk.rocks) {
            const x = rock.x - g.cameraX;
            if (x < -100 || x > width + 100) continue;
            ctx.fillStyle = rock.variant === 0 ? "#17455b" : rock.variant === 1 ? "#1b5061" : "#153b51";
            ctx.beginPath();
            ctx.ellipse(x, rock.y, rock.r * 1.3, rock.r, 0, Math.PI, Math.PI * 2);
            ctx.fill();
          }
          for (const group of chunk.ambient) {
            if (group.x - g.cameraX < -160 || group.x - g.cameraX > width + 160) continue;
            for (let i = 0; i < group.count; i++) {
              const wobble = g.elapsed * 1.4 + group.phase + i * 1.9;
              let fx = group.x + Math.sin(wobble) * 36 + i * 10 - group.count * 5;
              let fy = group.y + Math.sin(wobble * 1.7 + i) * 18;
              // Little fish flee predators (and part around the player) — a living warning system.
              let panic = 0;
              for (const shark of chunk.sharks) {
                const threat = distance(fx, fy, shark.x, shark.y);
                if (threat < 240) {
                  const push = (240 - threat) / 240;
                  fx += ((fx - shark.x) / (threat || 1)) * push * 95;
                  fy += ((fy - shark.y) / (threat || 1)) * push * 55;
                  panic = Math.max(panic, push);
                }
              }
              const playerGap = distance(fx, fy, g.player.x, g.player.y);
              if (playerGap < 70) {
                fx += ((fx - g.player.x) / (playerGap || 1)) * (70 - playerGap) * 0.8;
                fy += ((fy - g.player.y) / (playerGap || 1)) * (70 - playerGap) * 0.5;
              }
              const sx = fx - g.cameraX;
              const facing = Math.cos(wobble) >= 0 ? 1 : -1;
              ctx.save();
              ctx.translate(sx, clamp(fy, WORLD.surfaceY + 40, WORLD.floorY - 20));
              ctx.scale(facing, 1);
              ctx.fillStyle = panic > 0.25 ? "rgba(222,240,255,.9)" : "rgba(168,214,226,.72)";
              ctx.beginPath();
              ctx.ellipse(0, 0, 6, 2.6, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.beginPath();
              ctx.moveTo(-5, 0);
              ctx.lineTo(-9, -3);
              ctx.lineTo(-9, 3);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            }
          }
          for (const cover of chunk.covers) {
            const x = cover.x - g.cameraX;
            if (x < -120 || x > width + 120) continue;
            drawSeaweed(ctx, x, cover.y, cover.width, cover.height, g.elapsed, g.player.coverId === cover.id);
          }
          for (const hazard of chunk.hazards) {
            const x = hazard.x - g.cameraX;
            if (x < -160 || x > width + 160) continue;
            if (hazard.kind === "jellyfish") drawJellyfish(ctx, x, hazard.y, hazard.radius, g.elapsed, hazard.phase);
            else if (hazard.kind === "net") drawNet(ctx, x, hazard.y, hazard.width, hazard.height, g.elapsed);
            else drawVent(ctx, x, hazard.y, hazard.radius, g.elapsed, hazard.phase);
          }
          for (const pickup of chunk.pickups) {
            if (pickup.collected) continue;
            const x = pickup.x - g.cameraX;
            if (x < -40 || x > width + 40) continue;
            drawPickup(ctx, x, pickup.y, pickup.kind, pickup.subtype, Boolean(pickup.rare), g.elapsed);
            if (g.scannerPulse > 0) {
              ctx.strokeStyle = pickup.kind === "food" ? `rgba(255,231,122,${g.scannerPulse})` : pickup.kind === "bubble" ? `rgba(233,168,255,${g.scannerPulse})` : `rgba(132,241,255,${g.scannerPulse})`;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(x, pickup.y, 14 + (1 - g.scannerPulse) * 18, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
          for (const shark of chunk.sharks) {
            const x = shark.x - g.cameraX;
            if (x < -100 || x > width + 100) {
              // Keen Eyes surfaces hunters beyond the screen edge as chevrons.
              if (hasTalent(g.save.unlockedTalents, "keen-eyes") && Math.abs(shark.x - g.player.x) < 850) {
                const edgeX = x < 0 ? 26 : width - 26;
                const point = x < 0 ? -9 : 9;
                ctx.fillStyle = TIER_COLORS[shark.tier];
                ctx.beginPath();
                ctx.moveTo(edgeX + point, shark.y);
                ctx.lineTo(edgeX - point, shark.y - 8);
                ctx.lineTo(edgeX - point, shark.y + 8);
                ctx.closePath();
                ctx.fill();
              }
              continue;
            }
            const enemy = ENEMY_ARCHETYPES[shark.kind];
            if (shark.alert > 0.18 && shark.state !== "CHASE") {
              ctx.font = "900 15px var(--font-mono), monospace";
              ctx.textAlign = "center";
              ctx.fillStyle = shark.alert > 0.6 ? "#ff8092" : "#f8d45b";
              ctx.fillText("!", x, shark.y - 46 - enemy.scale * 15);
            }
            if (g.scannerPulse > 0) {
              const alpha = g.scannerPulse * 0.46;
              const shownVision = enemy.visionRadius * (hasTalent(g.save.unlockedTalents, "shadow-skin") ? 0.82 : 1);
              const shownHearing = enemy.hearingRadius * (hasTalent(g.save.unlockedTalents, "quiet-wake") ? 0.72 : 1);
              ctx.save();
              ctx.strokeStyle = `${TIER_COLORS[enemy.tier]}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
              ctx.lineWidth = enemy.tier === "boss" ? 3 : 1.5;
              ctx.beginPath();
              ctx.arc(x, shark.y, shownVision, 0, Math.PI * 2);
              ctx.stroke();
              ctx.setLineDash([8, 10]);
              ctx.globalAlpha = 0.72;
              ctx.beginPath();
              ctx.arc(x, shark.y, shownHearing, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
            drawPredator(ctx, x, shark.y, shark.facing, shark.state, shark.alert, shark.kind);
            if (shark.sleeping > 0) {
              ctx.font = "800 13px var(--font-mono), monospace";
              ctx.textAlign = "center";
              ctx.fillStyle = "rgba(190,229,255,.92)";
              ctx.fillText("z", x + 14 + Math.sin(g.elapsed * 3) * 2, shark.y - 34 - enemy.scale * 12);
              ctx.font = "800 17px var(--font-mono), monospace";
              ctx.fillText("Z", x + 26 + Math.sin(g.elapsed * 3 + 1) * 3, shark.y - 46 - enemy.scale * 12);
            } else if (shark.stunned > 0) {
              ctx.font = "900 15px var(--font-mono), monospace";
              ctx.textAlign = "center";
              ctx.fillStyle = "#ffe27a";
              for (let star = 0; star < 3; star++) {
                const angle = g.elapsed * 5 + star * (Math.PI * 2 / 3);
                ctx.fillText("✦", x + Math.cos(angle) * 22, shark.y - 34 - enemy.scale * 12 + Math.sin(angle) * 7);
              }
            }
          }
        }

        const whaleX = g.whale.x - g.cameraX;
        if (whaleX > -180 && whaleX < width + 180) drawWhale(ctx, whaleX, g.whale.y, g.whale.helped, g.elapsed);
        if (g.decoy) {
          const dx = g.decoy.x - g.cameraX;
          ctx.strokeStyle = "rgba(131,241,255,.85)";
          ctx.lineWidth = 3;
          if (!g.decoy.popped) {
            ctx.fillStyle = "rgba(160,245,255,.9)";
            ctx.beginPath();
            ctx.arc(dx, g.decoy.y, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(dx, g.decoy.y, 11 + Math.sin(g.elapsed * 14) * 2, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(dx, g.decoy.y, 18 + Math.sin(g.elapsed * 8) * 5, 0, Math.PI * 2);
            ctx.stroke();
            for (let i = 0; i < 6; i++) {
              ctx.beginPath();
              ctx.arc(dx + Math.sin(i) * 10, g.decoy.y - ((g.elapsed * 30 + i * 10) % 45), 3, 0, Math.PI * 2);
              ctx.stroke();
            }
            if (hasTalent(g.save.unlockedTalents, "guardian-bubble") && g.decoy.life > 2) {
              // The Guardian Illusion: a looming phantom fish shimmers out of the pop.
              ctx.save();
              ctx.globalAlpha = 0.3 + Math.sin(g.elapsed * 6) * 0.08;
              ctx.translate(dx, g.decoy.y);
              const loom = 3 + Math.sin(g.elapsed * 2.4) * 0.25;
              ctx.scale(loom, loom);
              drawFish(ctx, 0, 0, g.decoy.vx >= 0 ? 1 : -1, 0, false, false);
              ctx.restore();
            }
          }
        }
        if (g.scannerPulse > 0) {
          ctx.strokeStyle = `rgba(119,239,255,${g.scannerPulse * 0.65})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(g.player.x - g.cameraX, g.player.y, (1 - g.scannerPulse) * 560, 0, Math.PI * 2);
          ctx.stroke();
        }
        for (const particle of g.particles) {
          ctx.fillStyle = particle.kind === "bubble" ? `rgba(202,247,255,${particle.life})` : `rgba(255,226,119,${particle.life})`;
          ctx.beginPath();
          ctx.arc(particle.x - g.cameraX, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.font = "800 13px var(--font-mono), monospace";
        ctx.textAlign = "center";
        for (const floater of g.floaters) {
          ctx.globalAlpha = clamp(floater.life, 0, 1);
          ctx.fillStyle = floater.color;
          ctx.fillText(floater.text, floater.x - g.cameraX, floater.y);
        }
        ctx.globalAlpha = 1;
        if ((held.current.has("shift") || held.current.has(" ")) && g.player.stamina > 0 && !g.save.settings.reducedMotion) {
          ctx.strokeStyle = "rgba(208,250,255,.35)";
          ctx.lineWidth = 2;
          for (let i = 0; i < 8; i++) {
            const ly = g.player.y - 45 + i * 13;
            const lx = g.player.x - g.cameraX - g.player.facing * (30 + (i % 3) * 18);
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx - g.player.facing * (45 + i * 3), ly);
            ctx.stroke();
          }
        }
        drawFish(ctx, g.player.x - g.cameraX, g.player.y, g.player.facing, clamp(g.player.vy / 450, -0.28, 0.28), g.player.hidden, g.player.whaleShield > 0, g.save.fishType, findSkin(g.save.activeSkin).colors);
      }

      // Night grading keeps silhouettes readable while changing the mood.
      if (daylight < 0.58) {
        ctx.fillStyle = `rgba(5,14,54,${(0.58 - daylight) * 0.68})`;
        ctx.fillRect(-20, 0, width + 40, virtualHeight);
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = `rgba(49,131,182,${(0.58 - daylight) * 0.25})`;
        ctx.beginPath();
        ctx.arc(width * 0.8, 60, 400, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.restore();
    };

    const loop = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(500, Math.floor(rect.height));
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
      const dt = Math.min(0.034, (now - previous) / 1000);
      previous = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      update(dt, width);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(width, height, dpr);
      g.uiClock += dt;
      if (g.uiClock > 0.11) {
        g.uiClock = 0;
        syncUi(g);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [bankRun, syncUi]);

  const enterFromTitle = () => {
    const g = runtimeRef.current;
    if (!g) return;
    setResetArmed(false);
    audioCue("pickup", g.save.settings.sound);
    g.phase = "home";
    gameAudio.setMusic("home", g.save.settings.music);
    syncUi(g);
  };

  const resetProgress = () => {
    const g = runtimeRef.current;
    if (!g) return;
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    clearSave();
    g.save = structuredClone(STARTER_SAVE);
    setResetArmed(false);
    syncUi(g);
  };

  const resume = () => {
    const g = runtimeRef.current;
    if (!g) return;
    g.paused = false;
    g.inventory = false;
    syncUi(g);
  };

  const pressControl = (key: string, down: boolean) => {
    if (!down) {
      held.current.delete(key);
      return;
    }

    held.current.add(key);
    const g = runtimeRef.current;
    if (!g || g.phase !== "playing" || g.paused || g.inventory) return;

    // A real touch can be shorter than one animation frame. Give every tap a
    // small impulse so quick mobile input still feels deliberate and responsive.
    const impulse = 20;
    if (key === "d") { g.player.vx += impulse; g.player.facing = 1; }
    if (key === "a") { g.player.vx -= impulse; g.player.facing = -1; }
    if (key === "w") g.player.vy -= impulse;
    if (key === "s") g.player.vy += impulse;
    if (key === "shift") {
      g.player.stamina = Math.max(0, g.player.stamina - 4);
      g.player.staminaDelay = 0.9;
      g.tutorialFlags.burst = true;
    }
  };

  const updateTouchStick = (element: HTMLDivElement, clientX: number, clientY: number) => {
    const bounds = element.getBoundingClientRect();
    const dx = clientX - (bounds.left + bounds.width / 2);
    const dy = clientY - (bounds.top + bounds.height / 2);
    const distanceFromCenter = Math.hypot(dx, dy);
    const maxTravel = Math.max(1, Math.min(bounds.width, bounds.height) * 0.29);
    const visualScale = distanceFromCenter > maxTravel ? maxTravel / distanceFromCenter : 1;
    const visualX = dx * visualScale;
    const visualY = dy * visualScale;
    const deadZone = maxTravel * 0.1;

    if (distanceFromCenter <= deadZone) {
      touchStick.current = { x: 0, y: 0 };
    } else {
      const strength = Math.min(1, (distanceFromCenter - deadZone) / (maxTravel - deadZone));
      touchStick.current = {
        x: (dx / distanceFromCenter) * strength,
        y: (dy / distanceFromCenter) * strength,
      };
    }

    setStickVisual({ x: visualX, y: visualY });
  };

  const beginTouchStick = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    touchStickPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateTouchStick(event.currentTarget, event.clientX, event.clientY);
  };

  const moveTouchStick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (touchStickPointer.current !== event.pointerId) return;
    event.preventDefault();
    updateTouchStick(event.currentTarget, event.clientX, event.clientY);
  };

  const endTouchStick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (touchStickPointer.current !== event.pointerId) return;
    touchStickPointer.current = null;
    touchStick.current = { x: 0, y: 0 };
    setStickVisual({ x: 0, y: 0 });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const bagCost = 4 + ui.save.bagLevel * 5;
  const dayProgress = (ui.run.duration % WORLD.dayLength) / WORLD.dayLength;
  const period = dayProgress < 0.43 ? "DAY" : dayProgress < 0.57 ? "SUNSET" : dayProgress < 0.93 ? "NIGHT" : "DAWN";
  const xpTarget = xpForLevel(ui.save.level);
  const availableTalentPoints = Math.max(0, talentPointsForLevel(ui.save.level) - ui.save.unlockedTalents.length);

  return (
    <main
      className={`game-shell ${ui.save.settings.highContrast ? "high-contrast" : ""}`}
      style={{ "--text-scale": ui.save.settings.textScale } as React.CSSProperties}
    >
      <canvas ref={canvasRef} className="ocean-canvas" aria-label="Food Run underwater expedition game" role="application" tabIndex={0} />
      <div className="grain" />

      {ui.phase === "playing" && (
        <>
          <header className="hud top-hud" aria-label="Expedition status">
            <section className="hud-cluster condition-cluster">
              <div className="eyebrow">CONDITION</div>
              <div className="hearts" aria-label={`${ui.health} health remaining`}>
                {Array.from({ length: ui.maxHealth }, (_, heart) => <span key={heart} className={heart < ui.health ? "full" : "empty"}>◆</span>)}
              </div>
              <div className="meter compact"><i style={{ width: `${(ui.stamina / ui.maxStamina) * 100}%` }} /></div>
              <div className="meter-label"><span>STAMINA</span><b>{Math.round(ui.stamina)}</b></div>
            </section>
            <section className="hud-cluster center-cluster">
              <div className={`stealth-chip ${ui.stealth.toLowerCase()}`}><span className="status-dot" />{ui.stealth}</div>
              <div className="distance-readout">↔ {Math.round(ui.run.distance / 10)}m from reef</div>
              <div className="threat-readout">{ui.threat}</div>
            </section>
            <section className="hud-cluster cargo-cluster">
              <div className="cargo-row"><span>FOOD</span><b className="food-color">● {ui.run.food}</b></div>
              <div className="cargo-row"><span>SALVAGE</span><b className="junk-color">◆ {ui.run.salvage}</b></div>
              <div className="bag-meter"><i style={{ width: `${Math.min(100, (ui.bagUsed / ui.bagCapacity) * 100)}%` }} /></div>
              <div className="meter-label"><span>BAG</span><b>{ui.bagUsed}/{ui.bagCapacity}</b></div>
            </section>
          </header>

          <aside className="mission-card">
            <div className="eyebrow">{ui.save.tutorialComplete ? "EXPEDITION" : `TRAINING ${Math.min(ui.tutorialStep + 1, TUTORIAL_STEPS.length)}/${TUTORIAL_STEPS.length}`}</div>
            <strong>{ui.save.tutorialComplete ? (ui.run.food > 0 ? "Deliver your haul at any shoal — home lies west, wilder schools east" : "Gather food — richer water lies east") : TUTORIAL_STEPS[Math.min(ui.tutorialStep, TUTORIAL_STEPS.length - 1)]}</strong>
            {!ui.save.tutorialComplete && <div className="step-track"><i style={{ width: `${((ui.tutorialStep + 1) / TUTORIAL_STEPS.length) * 100}%` }} /></div>}
          </aside>

          <div className="run-meta"><span>{ui.zoneName.toUpperCase()}</span><span>{period}</span><span>LV {ui.save.level}</span><span>SONAR {ui.scannerCooldown > 0 ? `${Math.ceil(ui.scannerCooldown)}s` : "READY"}</span></div>

          {(ui.nearSchool || ui.nearCover || ui.nearWhale) && !ui.paused && !ui.inventory && (
            <div className="action-prompt"><kbd>E</kbd><span>{ui.nearSchool ? `FEED ${SCHOOLS[ui.nearSchool].name.toUpperCase()}` : ui.nearWhale ? "ANSWER WHALE SONG" : ui.hidden ? "LEAVE COVER" : "HIDE IN SEAWEED"}</span></div>
          )}
          {ui.notice && <div className="notice">{ui.notice}</div>}

          <footer className="controls-strip">
            <span><kbd>WASD</kbd> SWIM</span><span><kbd>SHIFT</kbd> BURST</span><span><kbd>E</kbd> INTERACT</span><span><kbd>F</kbd> SONAR</span><span><kbd>Q</kbd> DECOY ×{ui.traps}</span><span><kbd>TAB</kbd> BAG</span><span><kbd>ESC</kbd> PAUSE</span>
          </footer>

          <div className="mobile-controls" aria-label="Touch swim controls">
            <div
              className="touch-stick"
              role="group"
              aria-label="Movement thumbstick. Drag to swim in any direction."
              onPointerDown={beginTouchStick}
              onPointerMove={moveTouchStick}
              onPointerUp={endTouchStick}
              onPointerCancel={endTouchStick}
              onLostPointerCapture={endTouchStick}
            >
              <span className="touch-stick-guide" aria-hidden="true" />
              <span
                className="touch-stick-knob"
                aria-hidden="true"
                style={{ left: `calc(50% + ${stickVisual.x}px)`, top: `calc(50% + ${stickVisual.y}px)` }}
              />
            </div>
            <div className="touch-cluster">
              <button className="touch-small" onClick={() => actionQueue.current.push("f")}>SONAR</button>
              <button className="touch-small" onClick={() => actionQueue.current.push("q")}>DECOY {ui.traps}</button>
              <button className="touch-burst" onPointerDown={() => pressControl("shift", true)} onPointerUp={() => pressControl("shift", false)} onPointerLeave={() => pressControl("shift", false)}>BURST</button>
              <button className="touch-action" onClick={() => actionQueue.current.push("e")}>E</button>
            </div>
          </div>
        </>
      )}

      {ui.phase === "title" && (
        <section className="title-screen screen-overlay">
          <div className="title-kicker">A SMALL FISH. A VAST CURRENT.</div>
          <h1><span>FOOD RUN</span><em>Beneath the Current</em></h1>
          <p>Venture beyond the reef. Read the water. Feed your school.</p>
          <button className="primary-button large" onClick={enterFromTitle}>ENTER THE CURRENT <span>→</span></button>
          <div className="title-foot"><span>STEALTH</span><i /> <span>GATHERING</span><i /> <span>EXTRACTION</span></div>
          <button className={`text-button reset-progress ${resetArmed ? "armed" : ""}`} onClick={resetProgress}>
            {resetArmed ? "CLICK AGAIN TO ERASE ALL PROGRESS" : "RESET PROGRESS"}
          </button>
        </section>
      )}

      {ui.phase === "home" && (
        <section className="home-screen screen-overlay wide-overlay">
          <div className="home-heading">
            <div><div className="eyebrow">SAFE WATER · HOME REEF</div><h2>The school is waiting.</h2><p>Choose your gear, then bring everyone a little more hope.</p></div>
            <div className="level-medallion"><span>LEVEL</span><b>{ui.save.level}</b><small>{ui.save.xp}/{xpTarget} XP</small></div>
          </div>
          <div className="school-choice-grid" aria-label="School progress">
            {(Object.keys(SCHOOLS) as SchoolId[]).map((schoolId) => {
              const school = ui.save.schools[schoolId];
              const goal = schoolFoodGoal(schoolId, school.level);
              return <div key={schoolId} className="school-choice static">
                <span className="eyebrow">{SCHOOLS[schoolId].location} · {SCHOOLS[schoolId].specialty}</span><b>{SCHOOLS[schoolId].name}</b><small>LV {school.level} · {school.population} fish · {school.food}/{goal} food to next level · +{school.level} 🪸/hr</small><i style={{ width: `${Math.min(100, school.food / goal * 100)}%` }} />
                <span className="school-perks">
                  {SCHOOL_PERKS[schoolId].map((perk) => (
                    <span key={perk.name} className={school.level >= perk.level ? "on" : ""}>
                      {school.level >= perk.level ? "✓" : `LV${perk.level}`} {perk.name} — {perk.description}
                    </span>
                  ))}
                </span>
              </div>;
            })}
          </div>
          <div className="fish-choice-row" aria-label="Choose fish type">
            {(Object.keys(FISH_TYPES) as SaveData["fishType"][]).map((fishType) => <button key={fishType} className={`fish-choice ${ui.save.fishType === fishType ? "selected" : ""}`} onClick={() => chooseFish(fishType)}><b>{FISH_TYPES[fishType].name}</b><small>{FISH_TYPES[fishType].description}</small></button>)}
          </div>
          <div className="home-grid">
            <article className="reef-card inventory-card">
              <div className="card-icon food-icon">●</div><div><span className="eyebrow">REEF STORES</span><strong>{ui.save.bankedFood} food</strong><small>{ui.save.successfulRuns} safe returns</small></div>
            </article>
            <article className="reef-card inventory-card">
              <div className="card-icon junk-icon">◆</div><div><span className="eyebrow">CLEAN SALVAGE</span><strong>{ui.save.salvage} pieces</strong><small>Recovered from the ocean</small></div>
            </article>
            <article className="reef-card upgrade-card">
              <div className="upgrade-top"><div><span className="eyebrow">CRAFTING STATION</span><strong>Woven Carry Bag · Mk {ui.save.bagLevel + 1}</strong></div><span className="capacity-badge">{ui.bagCapacity} SLOTS</span></div>
              <p>Flexible kelp weave reduces drag and adds four carrying spaces.</p>
              <button className="secondary-button" onClick={craftBag} disabled={ui.save.salvage < bagCost}>CRAFT UPGRADE <span>◆ {bagCost}</span></button>
              {ui.save.salvage < bagCost && <small className="locked-note">Recover {bagCost - ui.save.salvage} more salvage to craft.</small>}
            </article>
            <article className="reef-card talent-card">
              <div className="talent-heading"><span className="eyebrow">TALENT CURRENTS</span><strong>{availableTalentPoints} POINT{availableTalentPoints === 1 ? "" : "S"}</strong></div>
              <p className="talent-intro">Earn one point at levels 3, 5, 7, and every second level after. Choose survival strategies, never firepower. Bubble crafts are a school of thought — your bubbles can only ever learn one.</p>
              <div className="talent-grid">
                {TALENTS.map((talent) => {
                  const unlocked = hasTalent(ui.save.unlockedTalents, talent.id);
                  const prerequisiteMet = !talent.prerequisite || hasTalent(ui.save.unlockedTalents, talent.prerequisite);
                  const groupTaken = !unlocked && exclusiveGroupTaken(ui.save.unlockedTalents, talent);
                  const available = !unlocked && !groupTaken && availableTalentPoints > 0 && ui.save.level >= talent.level && prerequisiteMet;
                  return (
                    <button
                      key={talent.id}
                      className={`talent-choice ${talent.branch} ${unlocked ? "unlocked" : ""}`}
                      onClick={() => unlockTalent(talent.id)}
                      disabled={!available}
                      aria-label={`${talent.name}: ${unlocked ? "unlocked" : groupTaken ? "another bubble craft was chosen" : available ? "unlock" : `locked until level ${talent.level}`}`}
                    >
                      <span className="talent-symbol">{talent.branch === "stealth" ? "◌" : talent.branch === "voyage" ? "≈" : talent.branch === "bubble" ? "○" : "◇"}</span>
                      <span><b>{talent.name}</b><small>{talent.description} · LV {talent.level}</small></span>
                      <em>{unlocked ? "✓" : groupTaken ? "1 ONLY" : available ? "+" : prerequisiteMet ? `LV${talent.level}` : "CHAIN"}</em>
                    </button>
                  );
                })}
              </div>
            </article>
          </div>
          <div className="meta-grid">
            <article className="reef-card token-card">
              <div className="eyebrow">REEF TOKENS</div>
              <strong>🪸 {ui.save.reefTokens}</strong>
              <small>Your schools generate {tokenRatePerHour(ui.save)} tokens/hr — even while you are away. Level schools to grow the reef faster.</small>
              <div className="stat-rows">
                <span>Best distance <b>{Math.round(ui.save.stats.maxDistance / 10)}m</b></span>
                <span>Longest safe return <b>{Math.round(ui.save.stats.longestExtraction / 10)}m</b></span>
                <span>Lifetime swum <b>{Math.round(ui.save.stats.totalDistance / 10)}m</b></span>
                <span>Runs <b>{ui.save.successfulRuns} safe · {ui.save.stats.failedRuns} lost</b></span>
              </div>
            </article>
            <article className="reef-card achievements-card">
              <div className="eyebrow">DISTANCE ACHIEVEMENTS</div>
              <div className="achievement-rows">
                {ACHIEVEMENTS.map((def) => {
                  const done = ui.save.achievements.includes(def.id);
                  return <span key={def.id} className={done ? "on" : ""}>{done ? "★" : "☆"} {def.name} — {def.description}</span>;
                })}
              </div>
            </article>
            <article className="reef-card store-card">
              <div className="eyebrow">REEF STORE · FISH SKINS</div>
              <div className="store-grid">
                {SKINS.map((skin) => {
                  const owned = ui.save.ownedSkins.includes(skin.id);
                  const active = ui.save.activeSkin === skin.id;
                  return (
                    <button key={skin.id} className={`store-item rarity-${skin.rarity} ${active ? "active" : ""}`} onClick={() => buyCosmetic("skin", skin.id)} disabled={active}>
                      <b>{skin.name}</b>
                      <small>{skin.rarity.toUpperCase()}</small>
                      <em>{active ? "EQUIPPED" : owned ? "EQUIP" : `🪸 ${skin.cost}`}</em>
                    </button>
                  );
                })}
              </div>
            </article>
            <article className="reef-card store-card">
              <div className="eyebrow">REEF STORE · SCHOOL THEMES</div>
              <div className="store-grid">
                {THEMES.map((theme) => {
                  const owned = ui.save.ownedThemes.includes(theme.id);
                  const active = ui.save.activeTheme === theme.id;
                  return (
                    <button key={theme.id} className={`store-item rarity-${theme.rarity} ${active ? "active" : ""}`} onClick={() => buyCosmetic("theme", theme.id)} disabled={active}>
                      <b>{theme.name}</b>
                      <small>{theme.rarity.toUpperCase()}</small>
                      <em>{active ? "EQUIPPED" : owned ? "EQUIP" : `🪸 ${theme.cost}`}</em>
                    </button>
                  );
                })}
              </div>
            </article>
          </div>
          {ui.notice && <div className="home-notice">{ui.notice}</div>}
          <div className="home-actions">
            <button className="primary-button large" onClick={beginExpedition}>{ui.save.successfulRuns ? "BEGIN EXPEDITION" : "BEGIN TRAINING DIVE"}<span>→</span></button>
            <button className="text-button" onClick={() => updateSetting("music", !ui.save.settings.music)}>MUSIC {ui.save.settings.music ? "ON" : "OFF"}</button>
            <button className="text-button" onClick={() => updateSetting("sound", !ui.save.settings.sound)}>SOUND {ui.save.settings.sound ? "ON" : "OFF"}</button>
          </div>
        </section>
      )}

      {(ui.paused || ui.inventory) && (
        <section className="modal-backdrop">
          <div className="modal-card">
            {ui.inventory ? (
              <>
                <div className="eyebrow">EXPEDITION BAG</div><h2>What you carry matters.</h2>
                <div className="bag-visual">{Array.from({ length: ui.bagCapacity }).map((_, i) => <span key={i} className={i < ui.bagUsed ? "filled" : ""}>{i < ui.bagUsed ? "◆" : ""}</span>)}</div>
                <div className="manifest"><span>Food value <b>{ui.run.food}</b></span><span>Salvage <b>{ui.run.salvage}</b></span><span>Protected <b>0</b></span></div>
                <p className="modal-copy">Nothing is banked until you return to the home reef.</p>
              </>
            ) : (
              <>
                <div className="eyebrow">CURRENT PAUSED</div><h2>Take a breath.</h2>
                <div className="settings-list">
                  <button onClick={() => updateSetting("reducedMotion", !ui.save.settings.reducedMotion)}><span>Reduced motion</span><b>{ui.save.settings.reducedMotion ? "ON" : "OFF"}</b></button>
                  <button onClick={() => updateSetting("highContrast", !ui.save.settings.highContrast)}><span>High-contrast cues</span><b>{ui.save.settings.highContrast ? "ON" : "OFF"}</b></button>
                  <button onClick={() => updateSetting("textScale", ui.save.settings.textScale >= 1.15 ? 1 : 1.15)}><span>Larger text</span><b>{ui.save.settings.textScale > 1 ? "ON" : "OFF"}</b></button>
                  <button onClick={() => updateSetting("sound", !ui.save.settings.sound)}><span>Sound effects</span><b>{ui.save.settings.sound ? "ON" : "OFF"}</b></button>
                  <button onClick={() => updateSetting("music", !ui.save.settings.music)}><span>Music</span><b>{ui.save.settings.music ? "ON" : "OFF"}</b></button>
                </div>
              </>
            )}
            <button className="primary-button" onClick={resume}>RETURN TO WATER</button>
          </div>
        </section>
      )}

      {ui.phase === "results" && (
        <section className="screen-overlay result-screen">
          <div className="result-mark">✓</div><div className="eyebrow">SAFE RETURN</div>
          <h2>{ui.lastDelivery ? `${SCHOOLS[ui.lastDelivery.schoolId].name} eats tonight.` : "The reef eats tonight."}</h2>
          <p>{ui.lastDelivery ? `${ui.lastDelivery.population} fish now swim at LV ${ui.lastDelivery.schoolLevel}. Every trip makes the school stronger.` : "Every trip clears the water and makes the school stronger."}</p>
          <div className="result-grid">
            <div><span>FOOD DELIVERED</span><b>{ui.lastDelivery ? ui.lastDelivery.foodDelivered : ui.run.food}</b></div><div><span>SALVAGE</span><b>{ui.run.salvage}</b></div><div><span>FARTHEST DISTANCE</span><b>{Math.round(ui.run.distance / 10)}m{ui.lastDelivery?.newRecord ? " ★" : ""}</b></div><div><span>XP EARNED</span><b>+{ui.resultXp}</b></div>
          </div>
          {ui.lastDelivery?.newRecord && <div className="level-up">NEW DISTANCE RECORD · {Math.round(ui.save.stats.maxDistance / 10)}m</div>}
          {(ui.lastDelivery?.achievements ?? []).map((name) => <div key={name} className="level-up">ACHIEVEMENT · {name.toUpperCase()}</div>)}
          <div className="token-line">🪸 {ui.save.reefTokens} Reef Tokens · your schools generate {tokenRatePerHour(ui.save)}/hr</div>
          {ui.lastDelivery?.schoolLevelGained && (
            <div className="school-levelup" role="status">
              <span className="school-levelup-bubbles" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</span>
              <strong>SCHOOL LEVEL UP!</strong>
              <span className="school-levelup-sub">{SCHOOLS[ui.lastDelivery.schoolId].name} grew to LV {ui.lastDelivery.schoolLevel} — new fish arrive</span>
            </div>
          )}
          {ui.levelGained && <div className="level-up">LEVEL UP · NEW CURRENTS AWAIT</div>}
          {!ui.save.tutorialComplete && <div className="level-up">TRAINING COMPLETE · CRAFT YOUR FIRST BAG UPGRADE</div>}
          <div className="result-actions">
            <button className="primary-button large" onClick={beginExpedition}>DIVE AGAIN <span>→</span></button>
            <button className="secondary-button" onClick={goHome}>RETURN TO REEF</button>
          </div>
        </section>
      )}

      {ui.phase === "defeat" && (
        <section className="screen-overlay result-screen defeat-screen">
          <div className="result-mark">≈</div><div className="eyebrow">SWEPT BACK BY THE CURRENT</div><h2>The haul was lost. You were not.</h2>
          <p>The school found you near the reef. Unbanked food and salvage are gone, but permanent progress is safe.</p>
          <div className="result-grid"><div><span>FOOD LOST</span><b>{ui.run.food}</b></div><div><span>SALVAGE LOST</span><b>{ui.run.salvage}</b></div><div><span>DISTANCE</span><b>{Math.round(ui.run.distance / 10)}m</b></div><div><span>LESSON</span><b>HIDE EARLY</b></div></div>
          <div className="token-line">Kept safe: records · achievements · Reef Tokens · schools · cosmetics</div>
          <button className="primary-button large" onClick={goHome}>RECOVER AT HOME <span>→</span></button>
        </section>
      )}
    </main>
  );
}
