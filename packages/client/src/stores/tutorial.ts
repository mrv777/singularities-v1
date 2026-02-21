import { create } from "zustand";
import { api } from "@/lib/api";
import {
  TUTORIAL_STEPS,
  type TutorialStep,
} from "@singularities/shared";

const LS_KEY = "singularities_tutorial_step";
const LS_CELEBRATED = "singularities_celebrated_unlocks";

interface TutorialState {
  step: TutorialStep;
  bootPhase: number;
  celebratedUnlocks: Set<string>;

  /** Initialize from server player data */
  initFromPlayer: (tutorialStep: string) => void;
  setStep: (step: TutorialStep) => void;
  advanceStep: () => void;
  skipTutorial: () => void;
  setBootPhase: (phase: number) => void;
  addCelebratedUnlock: (systemId: string) => void;
}

function loadCelebratedUnlocks(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_CELEBRATED);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function persistCelebratedUnlocks(set: Set<string>) {
  localStorage.setItem(LS_CELEBRATED, JSON.stringify([...set]));
}

function persistStep(step: TutorialStep) {
  localStorage.setItem(LS_KEY, step);
  // Fire-and-forget server sync
  api.updateTutorialStep(step).catch(() => {});
}

export const useTutorialStore = create<TutorialState>((set, get) => ({
  step: (localStorage.getItem(LS_KEY) as TutorialStep) || "done",
  bootPhase: 0,
  celebratedUnlocks: loadCelebratedUnlocks(),

  initFromPlayer: (tutorialStep: string) => {
    const valid = TUTORIAL_STEPS.includes(tutorialStep as TutorialStep);
    const serverStep = valid ? (tutorialStep as TutorialStep) : "done";
    const currentStep = get().step;
    // Use whichever is further ahead (client may have advanced before server round-trip)
    const serverIdx = TUTORIAL_STEPS.indexOf(serverStep);
    const currentIdx = TUTORIAL_STEPS.indexOf(currentStep);
    const step = serverIdx >= currentIdx ? serverStep : currentStep;
    localStorage.setItem(LS_KEY, step);
    set({ step });
  },

  setStep: (step: TutorialStep) => {
    persistStep(step);
    set({ step });
  },

  advanceStep: () => {
    const { step } = get();
    const idx = TUTORIAL_STEPS.indexOf(step);
    if (idx === -1 || idx >= TUTORIAL_STEPS.length - 1) return;
    const next = TUTORIAL_STEPS[idx + 1];
    persistStep(next);
    set({ step: next });
  },

  skipTutorial: () => {
    persistStep("done");
    set({ step: "done" });
  },

  setBootPhase: (phase: number) => set({ bootPhase: phase }),

  addCelebratedUnlock: (systemId: string) => {
    const updated = new Set(get().celebratedUnlocks);
    updated.add(systemId);
    persistCelebratedUnlocks(updated);
    set({ celebratedUnlocks: updated });
  },
}));
