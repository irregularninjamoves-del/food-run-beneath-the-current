export type MusicMode = "home" | "explore" | "danger";

const MUSIC: Record<MusicMode, string> = {
  home: "/audio/home-reef.mp3",
  explore: "/audio/open-water.mp3",
  danger: "/audio/danger.mp3",
};

const SFX = {
  whale: "/audio/whale-call.mp3",
  dolphinA: "/audio/dolphins-a.mp3",
  dolphinB: "/audio/dolphins-b.mp3",
} as const;

class GameAudioManager {
  private tracks = new Map<MusicMode, HTMLAudioElement>();
  private current: MusicMode | null = null;
  private dolphinFlip = false;

  private getTrack(mode: MusicMode) {
    let track = this.tracks.get(mode);
    if (!track) {
      track = new Audio(MUSIC[mode]);
      track.loop = true;
      track.preload = "auto";
      track.volume = mode === "danger" ? 0.22 : 0.18;
      this.tracks.set(mode, track);
    }
    return track;
  }

  setMusic(mode: MusicMode, enabled: boolean) {
    if (!enabled) {
      this.stopMusic();
      return;
    }
    if (this.current === mode && !this.getTrack(mode).paused) return;
    for (const [name, track] of this.tracks) if (name !== mode) track.pause();
    this.current = mode;
    void this.getTrack(mode).play().catch(() => undefined);
  }

  stopMusic() {
    for (const track of this.tracks.values()) track.pause();
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
}

export const gameAudio = new GameAudioManager();
