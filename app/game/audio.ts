export type MusicMode = "home" | "explore" | "danger" | "boss";

const MUSIC: Record<MusicMode, string> = {
  home: "/audio/flanged-abyss.mp3",
  explore: "/audio/panoramic-drift.mp3",
  danger: "/audio/subterranean-swell.mp3",
  boss: "/audio/final-ignition.mp3",
};

const AMBIENCE = "/audio/underwater-ambience.mp3";

const SFX = {
  whale: "/audio/whale-call.mp3",
  dolphinA: "/audio/dolphins-a.mp3",
  dolphinB: "/audio/dolphins-b.mp3",
  schoolLevelUp: "/audio/school-level-up.mp3",
} as const;

class GameAudioManager {
  private tracks = new Map<MusicMode, HTMLAudioElement>();
  private ambience: HTMLAudioElement | null = null;
  private current: MusicMode | null = null;
  private dolphinFlip = false;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;

  private targetVolume(mode: MusicMode) {
    return mode === "boss" ? 0.26 : mode === "danger" ? 0.22 : 0.18;
  }

  private getTrack(mode: MusicMode) {
    let track = this.tracks.get(mode);
    if (!track) {
      track = new Audio(MUSIC[mode]);
      track.loop = true;
      track.preload = "auto";
      track.volume = this.targetVolume(mode);
      this.tracks.set(mode, track);
    }
    return track;
  }

  // The aquarium ambience sits under every music mode as a constant bed.
  private startAmbience() {
    if (!this.ambience) {
      this.ambience = new Audio(AMBIENCE);
      this.ambience.loop = true;
      this.ambience.preload = "auto";
      this.ambience.volume = 0.12;
    }
    if (this.ambience.paused) void this.ambience.play().catch(() => undefined);
  }

  setMusic(mode: MusicMode, enabled: boolean) {
    if (!enabled) {
      this.stopMusic();
      return;
    }
    this.startAmbience();
    if (this.current === mode && !this.getTrack(mode).paused) return;
    const from = this.current && this.current !== mode ? this.getTrack(this.current) : null;
    const to = this.getTrack(mode);
    for (const [name, track] of this.tracks) {
      if (name !== mode && track !== from) track.pause();
    }
    this.current = mode;
    // Danger hits fast; calm eases back in. The crossfade length sells the mood swing.
    const fadeMs = mode === "danger" || mode === "boss" ? 450 : 1400;
    const stepMs = 60;
    const target = this.targetVolume(mode);
    const fromStart = from?.volume ?? 0;
    let progress = 0;
    to.volume = 0;
    void to.play().catch(() => undefined);
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    this.fadeTimer = setInterval(() => {
      progress = Math.min(1, progress + stepMs / fadeMs);
      to.volume = target * progress;
      if (from && !from.paused) from.volume = fromStart * (1 - progress);
      if (progress >= 1) {
        if (from) from.pause();
        if (this.fadeTimer) clearInterval(this.fadeTimer);
        this.fadeTimer = null;
      }
    }, stepMs);
  }

  stopMusic() {
    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
    for (const track of this.tracks.values()) track.pause();
    this.ambience?.pause();
    this.current = null;
  }

  playCreature(kind: "whale" | "dolphin", enabled: boolean) {
    if (!enabled) return;
    const source = kind === "whale" ? SFX.whale : this.dolphinFlip ? SFX.dolphinA : SFX.dolphinB;
    this.dolphinFlip = !this.dolphinFlip;
    const sound = new Audio(source);
    sound.volume = kind === "whale" ? 0.46 : 0.34;
    void sound.play().catch(() => undefined);
  }

  playSchoolLevelUp(enabled: boolean) {
    if (!enabled) return;
    const sound = new Audio(SFX.schoolLevelUp);
    sound.volume = 0.5;
    void sound.play().catch(() => undefined);
  }
}

export const gameAudio = new GameAudioManager();
