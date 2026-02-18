export type SoundType =
  | "click"
  | "navOpen"
  | "navClose"
  | "scan"
  | "hackSuccess"
  | "hackFail"
  | "detection"
  | "criticalWarning"
  | "cascade"
  | "levelUp"
  | "moduleUnlock"
  | "pvpAttack"
  | "pvpWin"
  | "pvpLoss"
  | "decision"
  | "death"
  | "notification"
  | "gameMove"
  | "gameCorrect"
  | "gameWrong"
  | "gameComplete";

const SOUND_FILES: Record<SoundType, string> = {
  click: "sounds/click.mp3",
  navOpen: "sounds/nav-open.mp3",
  navClose: "sounds/nav-close.mp3",
  scan: "sounds/scan.mp3",
  hackSuccess: "sounds/hack-success.mp3",
  hackFail: "sounds/hack-fail.mp3",
  detection: "sounds/detection.mp3",
  criticalWarning: "sounds/critical-warning.mp3",
  cascade: "sounds/cascade.mp3",
  levelUp: "sounds/level-up.mp3",
  moduleUnlock: "sounds/module-unlock.mp3",
  pvpAttack: "sounds/pvp-attack.mp3",
  pvpWin: "sounds/pvp-win.mp3",
  pvpLoss: "sounds/pvp-loss.mp3",
  decision: "sounds/decision.mp3",
  death: "sounds/death.mp3",
  notification: "sounds/notification.mp3",
  gameMove: "sounds/click.mp3",
  gameCorrect: "sounds/hack-success.mp3",
  gameWrong: "sounds/hack-fail.mp3",
  gameComplete: "sounds/level-up.mp3",
};

const LS_KEY = "singularities_sound_enabled";

interface SynthProfile {
  type: OscillatorType;
  frequency: number;
  duration: number;
  gain: number;
  sweepTo?: number;
}

const SYNTH_PROFILES: Record<SoundType, SynthProfile> = {
  click: { type: "square", frequency: 980, duration: 0.06, gain: 0.03, sweepTo: 760 },
  navOpen: { type: "triangle", frequency: 430, duration: 0.11, gain: 0.05, sweepTo: 680 },
  navClose: { type: "triangle", frequency: 600, duration: 0.1, gain: 0.05, sweepTo: 360 },
  scan: { type: "sawtooth", frequency: 300, duration: 0.2, gain: 0.06, sweepTo: 860 },
  hackSuccess: { type: "square", frequency: 620, duration: 0.2, gain: 0.08, sweepTo: 1080 },
  hackFail: { type: "sawtooth", frequency: 260, duration: 0.2, gain: 0.07, sweepTo: 180 },
  detection: { type: "square", frequency: 1280, duration: 0.14, gain: 0.08, sweepTo: 820 },
  criticalWarning: { type: "square", frequency: 780, duration: 0.24, gain: 0.09, sweepTo: 520 },
  cascade: { type: "triangle", frequency: 560, duration: 0.26, gain: 0.06, sweepTo: 320 },
  levelUp: { type: "triangle", frequency: 700, duration: 0.24, gain: 0.08, sweepTo: 1400 },
  moduleUnlock: { type: "triangle", frequency: 540, duration: 0.18, gain: 0.07, sweepTo: 930 },
  pvpAttack: { type: "sawtooth", frequency: 360, duration: 0.16, gain: 0.08, sweepTo: 520 },
  pvpWin: { type: "triangle", frequency: 560, duration: 0.24, gain: 0.08, sweepTo: 1180 },
  pvpLoss: { type: "sawtooth", frequency: 410, duration: 0.24, gain: 0.08, sweepTo: 220 },
  decision: { type: "triangle", frequency: 460, duration: 0.22, gain: 0.06, sweepTo: 760 },
  death: { type: "sawtooth", frequency: 240, duration: 0.38, gain: 0.1, sweepTo: 90 },
  notification: { type: "triangle", frequency: 880, duration: 0.09, gain: 0.05, sweepTo: 1040 },
  gameMove: { type: "square", frequency: 720, duration: 0.05, gain: 0.03, sweepTo: 580 },
  gameCorrect: { type: "triangle", frequency: 660, duration: 0.12, gain: 0.06, sweepTo: 1100 },
  gameWrong: { type: "sawtooth", frequency: 320, duration: 0.15, gain: 0.06, sweepTo: 180 },
  gameComplete: { type: "triangle", frequency: 550, duration: 0.28, gain: 0.08, sweepTo: 1300 },
};

function resolveSoundPath(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${path}`;
}

class SoundManager {
  private enabled: boolean;
  private cache = new Map<string, HTMLAudioElement>();
  private audioContext: AudioContext | null = null;

  constructor() {
    this.enabled = localStorage.getItem(LS_KEY) !== "false";
  }

  get isEnabled() {
    return this.enabled;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    localStorage.setItem(LS_KEY, String(this.enabled));
    return this.enabled;
  }

  unlock() {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {
        // ignore
      });
    }
  }

  play(sound: SoundType) {
    if (!this.enabled) return;
    this.unlock();
    if (this.playSynth(sound)) return;
    this.playFromFile(sound);
  }

  preload() {
    const critical: SoundType[] = ["click", "scan", "hackSuccess", "hackFail", "notification"];
    for (const key of critical) {
      const src = resolveSoundPath(SOUND_FILES[key]);
      if (src && !this.cache.has(src)) {
        const audio = new Audio();
        audio.preload = "auto";
        audio.src = src;
        this.cache.set(src, audio);
      }
    }
  }

  private getAudioContext(): AudioContext | null {
    if (this.audioContext) return this.audioContext;
    const w = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextCtor = globalThis.AudioContext ?? w.webkitAudioContext;
    if (!AudioContextCtor) return null;
    this.audioContext = new AudioContextCtor();
    return this.audioContext;
  }

  private playSynth(sound: SoundType): boolean {
    const ctx = this.getAudioContext();
    if (!ctx || ctx.state !== "running") return false;

    const profile = SYNTH_PROFILES[sound];
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = profile.type;
    oscillator.frequency.setValueAtTime(profile.frequency, now);
    if (profile.sweepTo) {
      oscillator.frequency.exponentialRampToValueAtTime(profile.sweepTo, now + profile.duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(profile.gain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(now);
    oscillator.stop(now + profile.duration + 0.03);
    return true;
  }

  private playFromFile(sound: SoundType) {
    const src = resolveSoundPath(SOUND_FILES[sound]);
    if (!src) return;

    try {
      const original = this.cache.get(src);
      const audio = original ? (original.cloneNode() as HTMLAudioElement) : new Audio(src);
      if (!original) this.cache.set(src, audio);
      audio.volume = 0.4;
      audio.play().catch(() => {
        // Autoplay blocked or invalid asset.
      });
    } catch {
      // Audio playback unavailable.
    }
  }
}

export const soundManager = new SoundManager();

export function playSound(sound: SoundType) {
  soundManager.play(sound);
}
