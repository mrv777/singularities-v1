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
  | "notification";

const SOUND_FILES: Record<SoundType, string> = {
  click: "/sounds/click.mp3",
  navOpen: "/sounds/nav-open.mp3",
  navClose: "/sounds/nav-close.mp3",
  scan: "/sounds/scan.mp3",
  hackSuccess: "/sounds/hack-success.mp3",
  hackFail: "/sounds/hack-fail.mp3",
  detection: "/sounds/detection.mp3",
  criticalWarning: "/sounds/critical-warning.mp3",
  cascade: "/sounds/cascade.mp3",
  levelUp: "/sounds/level-up.mp3",
  moduleUnlock: "/sounds/module-unlock.mp3",
  pvpAttack: "/sounds/pvp-attack.mp3",
  pvpWin: "/sounds/pvp-win.mp3",
  pvpLoss: "/sounds/pvp-loss.mp3",
  decision: "/sounds/decision.mp3",
  death: "/sounds/death.mp3",
  notification: "/sounds/notification.mp3",
};

const LS_KEY = "singularities_sound_enabled";

class SoundManager {
  private enabled: boolean;
  private cache = new Map<string, HTMLAudioElement>();

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

  play(sound: SoundType) {
    if (!this.enabled) return;
    const src = SOUND_FILES[sound];
    if (!src) return;

    try {
      const original = this.cache.get(src);
      const audio = original ? (original.cloneNode() as HTMLAudioElement) : new Audio(src);
      if (!original) this.cache.set(src, audio);
      audio.volume = 0.4;
      audio.play().catch(() => {
        // Autoplay blocked — silently ignore
      });
    } catch {
      // Audio not available
    }
  }

  preload() {
    const critical: SoundType[] = ["click", "scan", "hackSuccess", "hackFail", "notification"];
    for (const key of critical) {
      const src = SOUND_FILES[key];
      if (src && !this.cache.has(src)) {
        const audio = new Audio();
        audio.preload = "auto";
        audio.src = src;
        this.cache.set(src, audio);
      }
    }
  }
}

export const soundManager = new SoundManager();

export function playSound(sound: SoundType) {
  soundManager.play(sound);
}
