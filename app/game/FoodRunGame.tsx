"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  bankRunProgress,
  getBagCapacity,
  Phase,
  RunStats,
  SaveData,
  STARTER_SAVE,
  TUTORIAL_STEPS,
  WORLD,
  xpForLevel,
} from "./model";
import { loadSave, persistSave } from "./save";
import { ChunkManager } from "./world";
import { gameAudio } from "./audio";
import { ENEMY_ARCHETYPES, EnemyKind, TIER_COLORS } from "./enemies";

type Particle = { x: number; y: number; vx: number; vy: number; life: number; size: number; kind: "bubble" | "spark" };

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
  scannerCooldown: number;
  scannerPulse: number;
  traps: number;
  decoy: { x: number; y: number; life: number } | null;
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
  stamina: number;
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
  nearHome: boolean;
  nearCover: boolean;
  nearWhale: boolean;
  resultXp: number;
  levelGained: boolean;
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
      health: 3,
      stamina: 100,
      staminaDelay: 0,
      hidden: false,
      coverId: null,
      invulnerable: 0,
      whaleShield: 0,
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
    scannerCooldown: 0,
    scannerPulse: 0,
    traps: 2,
    decoy: null,
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

function drawFish(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, tilt: number, hidden: boolean, shield: boolean) {
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
  const body = ctx.createLinearGradient(-22, -15, 20, 18);
  body.addColorStop(0, "#ffbf4d");
  body.addColorStop(0.58, "#ff756b");
  body.addColorStop(1, "#ec3f73");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f05d72";
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
  if (kind === "food") {
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

export default function FoodRunGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const held = useRef(new Set<string>());
  const runtimeRef = useRef<Runtime | null>(null);
  const actionQueue = useRef<string[]>([]);
  const [ui, setUi] = useState<UiSnapshot>(() => {
    const save = STARTER_SAVE;
    return {
      phase: "title", paused: false, inventory: false, health: 3, stamina: 100, hidden: false,
      stealth: "CLEAR", threat: "NO CONTACT", bagUsed: 0, bagCapacity: getBagCapacity(save), run: emptyRun(), save,
      tutorialStep: 0, scannerCooldown: 0, traps: 2, notice: "", nearHome: true,
      nearCover: false, nearWhale: false, resultXp: 0, levelGained: false,
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
      stamina: g.player.stamina,
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
      nearHome: g.player.x < 315,
      nearCover,
      nearWhale: !g.whale.helped && distance(g.player.x, g.player.y, g.whale.x, g.whale.y) < 150,
      resultXp: g.resultXp,
      levelGained: g.levelGained,
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
    g.player = { x: 225, y: 360, vx: 0, vy: 0, facing: 1, health: 3, stamina: 100, staminaDelay: 0, hidden: false, coverId: null, invulnerable: 0, whaleShield: 0 };
    g.cameraX = 0;
    g.elapsed = 0;
    g.run = emptyRun();
    g.bagUsed = 0;
    g.scannerCooldown = 0;
    g.scannerPulse = 0;
    g.traps = 2;
    g.decoy = null;
    g.whale = { x: g.save.tutorialComplete ? 1750 : 1180, y: 260, helped: false };
    g.tutorialStep = g.save.tutorialComplete ? TUTORIAL_STEPS.length : 0;
    g.tutorialFlags = { moved: false, burst: false, hid: false, chased: false, escaped: false, whale: false, junk: false };
    showNotice(g, g.save.tutorialComplete ? "The current is open. Gather what you can—and come home." : "Lesson 1: feel the current, then swim east.", 3.5);
    gameAudio.setMusic("explore", g.save.settings.music);
    syncUi(g);
  }, [syncUi]);

  const goHome = useCallback(() => {
    const g = runtimeRef.current;
    if (!g) return;
    g.phase = "home";
    g.paused = false;
    g.inventory = false;
    g.player.x = 210;
    g.player.y = 360;
    g.cameraX = 0;
    gameAudio.setMusic("home", g.save.settings.music);
    syncUi(g);
  }, [syncUi]);

  const bankRun = useCallback((g: Runtime) => {
    const banked = bankRunProgress(g.save, g.run);
    const next = banked.save;
    g.levelGained = banked.levelGained;
    if (!next.tutorialComplete && g.tutorialStep >= TUTORIAL_STEPS.length - 1) next.tutorialComplete = true;
    g.save = next;
    g.resultXp = banked.earnedXp;
    g.phase = "results";
    g.paused = false;
    g.inventory = false;
    persistSave(next);
    audioCue("bank", next.settings.sound);
    gameAudio.setMusic("home", next.settings.music);
    gameAudio.playCreature("dolphin", next.settings.sound);
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

  useEffect(() => {
    const g = freshRuntime(loadSave());
    runtimeRef.current = g;
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
      if (g.player.x < 315) {
        if (g.run.food + g.run.salvage <= 0) showNotice(g, "Your bag is empty. The school needs food.");
        else if (!g.save.tutorialComplete && (g.tutorialStep < TUTORIAL_STEPS.length - 1 || g.run.food <= 0)) {
          showNotice(g, "Finish the training route before extracting your haul.", 2.2);
        }
        else {
          if (!g.save.tutorialComplete) g.tutorialStep = TUTORIAL_STEPS.length;
          bankRun(g);
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
      g.scannerCooldown = Math.max(0, g.scannerCooldown - dt);
      g.scannerPulse = Math.max(0, g.scannerPulse - dt * 0.65);
      g.noticeTime = Math.max(0, g.noticeTime - dt);
      if (g.noticeTime === 0) g.notice = "";
      if (g.decoy) {
        g.decoy.life -= dt;
        if (g.decoy.life <= 0) g.decoy = null;
      }

      while (actionQueue.current.length) {
        const action = actionQueue.current.shift();
        if (action === "e") interact();
        if (action === "f") {
          if (g.scannerCooldown > 0) showNotice(g, `Scanner recharging: ${Math.ceil(g.scannerCooldown)}s`, 1.1);
          else {
            g.scannerCooldown = 8;
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
          else {
            g.traps -= 1;
            g.decoy = { x: g.player.x - g.player.facing * 70, y: g.player.y, life: 5 };
            showNotice(g, "Bubble decoy deployed.", 1.4);
          }
        }
      }

      const left = held.current.has("a") || held.current.has("arrowleft");
      const right = held.current.has("d") || held.current.has("arrowright");
      const up = held.current.has("w") || held.current.has("arrowup");
      const down = held.current.has("s") || held.current.has("arrowdown");
      const inputX = (right ? 1 : 0) - (left ? 1 : 0);
      const inputY = (down ? 1 : 0) - (up ? 1 : 0);
      const inputLength = Math.hypot(inputX, inputY) || 1;
      const moving = inputX !== 0 || inputY !== 0;
      const wantsBurst = (held.current.has("shift") || held.current.has(" ")) && moving && g.player.stamina > 1;
      const loadRatio = g.bagUsed / getBagCapacity(g.save);
      const loadPenalty = 1 - Math.max(0, loadRatio - 0.6) * 0.18;
      const accel = (wantsBurst ? 520 : 245) * loadPenalty;
      const maxSpeed = (wantsBurst ? 295 : 142) * loadPenalty;
      if (moving) {
        g.player.vx += (inputX / inputLength) * accel * dt;
        g.player.vy += (inputY / inputLength) * accel * dt;
        if (inputX) g.player.facing = inputX > 0 ? 1 : -1;
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
        g.player.stamina = Math.max(0, g.player.stamina - 34 * dt * (1 + loadRatio * 0.16));
        g.player.staminaDelay = 0.9;
        g.tutorialFlags.burst = true;
        if (Math.random() < dt * 22) g.particles.push({ x: g.player.x - g.player.facing * 22, y: g.player.y + (Math.random() - 0.5) * 18, vx: -g.player.facing * (45 + Math.random() * 30), vy: -14 - Math.random() * 18, life: 0.8, size: 2 + Math.random() * 4, kind: "bubble" });
      } else {
        g.player.staminaDelay -= dt;
        if (g.player.staminaDelay <= 0) g.player.stamina = Math.min(100, g.player.stamina + 22 * dt);
      }

      const playerChunk = g.chunks.chunks.get(Math.floor(g.player.x / WORLD.chunkWidth));
      if (playerChunk) g.player.vx += playerChunk.current * dt * (wantsBurst ? 0.35 : 1);
      g.player.x = Math.max(105, g.player.x + g.player.vx * dt);
      g.player.y = clamp(g.player.y + g.player.vy * dt, WORLD.surfaceY + 35, WORLD.floorY - 25);
      g.run.distance = Math.max(g.run.distance, Math.max(0, g.player.x - 225));
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
        for (const pickup of chunk.pickups) {
          if (pickup.collected || distance(g.player.x, g.player.y, pickup.x, pickup.y) > 30) continue;
          if (g.bagUsed + pickup.size > getBagCapacity(g.save)) {
            if (g.notice !== "Bag full — return home or leave something behind.") showNotice(g, "Bag full — return home or leave something behind.", 1.8);
            continue;
          }
          pickup.collected = true;
          g.bagUsed += pickup.size;
          if (pickup.kind === "food") g.run.food += pickup.value;
          else {
            g.run.salvage += pickup.value;
            g.tutorialFlags.junk = true;
          }
          if (pickup.rare) g.run.rareDiscoveries += 1;
          for (let i = 0; i < 7; i++) g.particles.push({ x: pickup.x, y: pickup.y, vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.5) * 80, life: 0.5 + Math.random() * 0.4, size: 2 + Math.random() * 3, kind: "spark" });
          audioCue("pickup", g.save.settings.sound);
        }

        for (const shark of chunk.sharks) {
          const enemy = ENEMY_ARCHETYPES[shark.kind];
          shark.stateTime += dt;
          shark.attackCooldown = Math.max(0, shark.attackCooldown - dt);
          const dx = g.player.x - shark.x;
          const dy = g.player.y - shark.y;
          const dist = Math.hypot(dx, dy);
          const playerSpeed = Math.hypot(g.player.vx, g.player.vy);
          const inFront = dx * shark.facing > -40;
          const burstNoise = wantsBurst && dist < enemy.hearingRadius;
          const sonarNoise = g.scannerPulse > 0.7 && dist < enemy.sonarRadius;
          const currentVision = enemy.visionRadius * (playerSpeed > 180 ? 1.28 : 1);
          const sees = !g.player.hidden && dist < currentVision && (inFront || dist < enemy.visionRadius * 0.38);
          const safeAtReef = g.player.x < 500;
          const detects = !safeAtReef && (sees || burstNoise || sonarNoise);
          if (enemy.tier === "boss" && dist < 1000 && !shark.warned) {
            shark.warned = true;
            showNotice(g, "COLOSSAL SHADOW — its awareness reaches far. Sonar reveals the radii.", 4.2);
            g.shake = g.save.settings.reducedMotion ? 2 : 7;
            gameAudio.setMusic("danger", g.save.settings.music);
          }
          if (g.decoy && distance(shark.x, shark.y, g.decoy.x, g.decoy.y) < 460 && shark.state !== "CHASE") {
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
              gameAudio.setMusic("danger", g.save.settings.music);
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
              gameAudio.setMusic("danger", g.save.settings.music);
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
              gameAudio.setMusic("danger", g.save.settings.music);
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
              if (g.run.food > 0) {
                g.run.food -= 1;
                g.bagUsed = Math.max(0, g.bagUsed - 1);
              }
              showNotice(g, "Struck! Some food scattered into the current.", 2.4);
              audioCue("hurt", g.save.settings.sound);
              if (g.player.health <= 0) {
                g.phase = "defeat";
                g.paused = false;
                g.inventory = false;
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
        const reefColors = ["#ff7f78", "#ffbf57", "#ba6fe0", "#37c29c"];
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
        ctx.fillStyle = "rgba(255,247,193,.9)";
        ctx.font = "800 12px var(--font-mono), monospace";
        ctx.textAlign = "center";
        ctx.fillText("HOME REEF", hx + 120, 455);
        for (let i = 0; i < 5 + g.save.reefLevel * 2; i++) {
          drawFish(ctx, hx + 75 + (i % 4) * 38, 500 + Math.floor(i / 4) * 40 + Math.sin(g.elapsed + i) * 7, i % 2 ? -1 : 1, 0, false, false);
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
          for (const cover of chunk.covers) {
            const x = cover.x - g.cameraX;
            if (x < -120 || x > width + 120) continue;
            drawSeaweed(ctx, x, cover.y, cover.width, cover.height, g.elapsed, g.player.coverId === cover.id);
          }
          for (const pickup of chunk.pickups) {
            if (pickup.collected) continue;
            const x = pickup.x - g.cameraX;
            if (x < -40 || x > width + 40) continue;
            drawPickup(ctx, x, pickup.y, pickup.kind, pickup.subtype, Boolean(pickup.rare), g.elapsed);
            if (g.scannerPulse > 0) {
              ctx.strokeStyle = pickup.kind === "food" ? `rgba(255,231,122,${g.scannerPulse})` : `rgba(132,241,255,${g.scannerPulse})`;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(x, pickup.y, 14 + (1 - g.scannerPulse) * 18, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
          for (const shark of chunk.sharks) {
            const x = shark.x - g.cameraX;
            if (x < -100 || x > width + 100) continue;
            const enemy = ENEMY_ARCHETYPES[shark.kind];
            if (g.scannerPulse > 0) {
              const alpha = g.scannerPulse * 0.46;
              ctx.save();
              ctx.strokeStyle = `${TIER_COLORS[enemy.tier]}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
              ctx.lineWidth = enemy.tier === "boss" ? 3 : 1.5;
              ctx.beginPath();
              ctx.arc(x, shark.y, enemy.visionRadius, 0, Math.PI * 2);
              ctx.stroke();
              ctx.setLineDash([8, 10]);
              ctx.globalAlpha = 0.72;
              ctx.beginPath();
              ctx.arc(x, shark.y, enemy.hearingRadius, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
            drawPredator(ctx, x, shark.y, shark.facing, shark.state, shark.alert, shark.kind);
          }
        }

        const whaleX = g.whale.x - g.cameraX;
        if (whaleX > -180 && whaleX < width + 180) drawWhale(ctx, whaleX, g.whale.y, g.whale.helped, g.elapsed);
        if (g.decoy) {
          const dx = g.decoy.x - g.cameraX;
          ctx.strokeStyle = "rgba(131,241,255,.85)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(dx, g.decoy.y, 18 + Math.sin(g.elapsed * 8) * 5, 0, Math.PI * 2);
          ctx.stroke();
          for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.arc(dx + Math.sin(i) * 10, g.decoy.y - ((g.elapsed * 30 + i * 10) % 45), 3, 0, Math.PI * 2);
            ctx.stroke();
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
        drawFish(ctx, g.player.x - g.cameraX, g.player.y, g.player.facing, clamp(g.player.vy / 450, -0.28, 0.28), g.player.hidden, g.player.whaleShield > 0);
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
    audioCue("pickup", g.save.settings.sound);
    g.phase = "home";
    gameAudio.setMusic("home", g.save.settings.music);
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
    if (down) held.current.add(key);
    else held.current.delete(key);
  };

  const bagCost = 4 + ui.save.bagLevel * 5;
  const dayProgress = (ui.run.duration % WORLD.dayLength) / WORLD.dayLength;
  const period = dayProgress < 0.43 ? "DAY" : dayProgress < 0.57 ? "SUNSET" : dayProgress < 0.93 ? "NIGHT" : "DAWN";
  const xpTarget = xpForLevel(ui.save.level);

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
                {[0, 1, 2].map((heart) => <span key={heart} className={heart < ui.health ? "full" : "empty"}>◆</span>)}
              </div>
              <div className="meter compact"><i style={{ width: `${ui.stamina}%` }} /></div>
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
            <strong>{ui.save.tutorialComplete ? (ui.run.food >= 5 ? "A good haul. Return when ready." : "Gather at least 5 food") : TUTORIAL_STEPS[Math.min(ui.tutorialStep, TUTORIAL_STEPS.length - 1)]}</strong>
            {!ui.save.tutorialComplete && <div className="step-track"><i style={{ width: `${((ui.tutorialStep + 1) / TUTORIAL_STEPS.length) * 100}%` }} /></div>}
          </aside>

          <div className="run-meta"><span>{period}</span><span>LV {ui.save.level}</span><span>SONAR {ui.scannerCooldown > 0 ? `${Math.ceil(ui.scannerCooldown)}s` : "READY"}</span></div>

          {(ui.nearHome || ui.nearCover || ui.nearWhale) && !ui.paused && !ui.inventory && (
            <div className="action-prompt"><kbd>E</kbd><span>{ui.nearHome ? "ENTER REEF & BANK HAUL" : ui.nearWhale ? "ANSWER WHALE SONG" : ui.hidden ? "LEAVE COVER" : "HIDE IN SEAWEED"}</span></div>
          )}
          {ui.notice && <div className="notice">{ui.notice}</div>}

          <footer className="controls-strip">
            <span><kbd>WASD</kbd> SWIM</span><span><kbd>SHIFT</kbd> BURST</span><span><kbd>E</kbd> INTERACT</span><span><kbd>F</kbd> SONAR</span><span><kbd>Q</kbd> DECOY ×{ui.traps}</span><span><kbd>TAB</kbd> BAG</span><span><kbd>ESC</kbd> PAUSE</span>
          </footer>

          <div className="mobile-controls" aria-label="Touch swim controls">
            <div className="touch-pad">
              <button onPointerDown={() => pressControl("w", true)} onPointerUp={() => pressControl("w", false)} onPointerLeave={() => pressControl("w", false)}>▲</button>
              <button onPointerDown={() => pressControl("a", true)} onPointerUp={() => pressControl("a", false)} onPointerLeave={() => pressControl("a", false)}>◀</button>
              <button onPointerDown={() => pressControl("s", true)} onPointerUp={() => pressControl("s", false)} onPointerLeave={() => pressControl("s", false)}>▼</button>
              <button onPointerDown={() => pressControl("d", true)} onPointerUp={() => pressControl("d", false)} onPointerLeave={() => pressControl("d", false)}>▶</button>
            </div>
            <button className="touch-burst" onPointerDown={() => pressControl("shift", true)} onPointerUp={() => pressControl("shift", false)} onPointerLeave={() => pressControl("shift", false)}>BURST</button>
            <button className="touch-action" onClick={() => actionQueue.current.push("e")}>E</button>
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
        </section>
      )}

      {ui.phase === "home" && (
        <section className="home-screen screen-overlay wide-overlay">
          <div className="home-heading">
            <div><div className="eyebrow">SAFE WATER · HOME REEF</div><h2>The school is waiting.</h2><p>Choose your gear, then bring everyone a little more hope.</p></div>
            <div className="level-medallion"><span>LEVEL</span><b>{ui.save.level}</b><small>{ui.save.xp}/{xpTarget} XP</small></div>
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
              <span className="eyebrow">TALENT PATHS · PREVIEW</span>
              <div className="talent-row"><span className="talent-dot stealth-tree">◌</span><div><b>Ghost Current</b><small>Quieter bursts · Level 3</small></div></div>
              <div className="talent-row"><span className="talent-dot collect-tree">◇</span><div><b>Keen Forager</b><small>Rare food sense · Level 4</small></div></div>
              <div className="talent-row"><span className="talent-dot defense-tree">△</span><div><b>Reefguard</b><small>Improved decoys · Level 5</small></div></div>
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
          <div className="result-mark">✓</div><div className="eyebrow">SAFE RETURN</div><h2>The reef eats tonight.</h2>
          <p>Every trip clears the water and makes the school stronger.</p>
          <div className="result-grid">
            <div><span>FOOD BANKED</span><b>{ui.run.food}</b></div><div><span>SALVAGE</span><b>{ui.run.salvage}</b></div><div><span>FARTHEST DISTANCE</span><b>{Math.round(ui.run.distance / 10)}m</b></div><div><span>XP EARNED</span><b>+{ui.resultXp}</b></div>
          </div>
          {ui.levelGained && <div className="level-up">LEVEL UP · NEW CURRENTS AWAIT</div>}
          {!ui.save.tutorialComplete && <div className="level-up">TRAINING COMPLETE · CRAFT YOUR FIRST BAG UPGRADE</div>}
          <button className="primary-button large" onClick={goHome}>RETURN TO REEF <span>→</span></button>
        </section>
      )}

      {ui.phase === "defeat" && (
        <section className="screen-overlay result-screen defeat-screen">
          <div className="result-mark">≈</div><div className="eyebrow">SWEPT BACK BY THE CURRENT</div><h2>The haul was lost. You were not.</h2>
          <p>The school found you near the reef. Unbanked food and salvage are gone, but permanent progress is safe.</p>
          <div className="result-grid"><div><span>FOOD LOST</span><b>{ui.run.food}</b></div><div><span>SALVAGE LOST</span><b>{ui.run.salvage}</b></div><div><span>DISTANCE</span><b>{Math.round(ui.run.distance / 10)}m</b></div><div><span>LESSON</span><b>HIDE EARLY</b></div></div>
          <button className="primary-button large" onClick={goHome}>RECOVER AT HOME <span>→</span></button>
        </section>
      )}
    </main>
  );
}
