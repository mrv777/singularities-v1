import { create } from "zustand";
import type { ScanTarget, PlayerLoadout, PlayerModule } from "@singularities/shared";

interface GameState {
  // Scanner
  scannedTargets: ScanTarget[];
  scanExpiresAt: string | null;
  selectedTargetIndex: number | null;
  hackResult: unknown | null;
  isScanning: boolean;
  isHacking: boolean;

  // Loadout
  loadout: PlayerLoadout[];

  // Modules
  ownedModules: PlayerModule[];

  // Actions
  setScannedTargets: (targets: ScanTarget[], expiresAt: string) => void;
  clearScan: () => void;
  selectTarget: (index: number | null) => void;
  setHackResult: (result: unknown) => void;
  clearHackResult: () => void;
  setIsScanning: (v: boolean) => void;
  setIsHacking: (v: boolean) => void;
  setLoadout: (loadout: PlayerLoadout[]) => void;
  setOwnedModules: (modules: PlayerModule[]) => void;
}

export const useGameStore = create<GameState>((set) => ({
  scannedTargets: [],
  scanExpiresAt: null,
  selectedTargetIndex: null,
  hackResult: null,
  isScanning: false,
  isHacking: false,
  loadout: [],
  ownedModules: [],

  setScannedTargets: (targets, expiresAt) =>
    set({ scannedTargets: targets, scanExpiresAt: expiresAt, selectedTargetIndex: null, hackResult: null }),
  clearScan: () =>
    set({ scannedTargets: [], scanExpiresAt: null, selectedTargetIndex: null, hackResult: null }),
  selectTarget: (index) => set({ selectedTargetIndex: index, hackResult: null }),
  setHackResult: (result) => set({ hackResult: result }),
  clearHackResult: () => set({ hackResult: null }),
  setIsScanning: (v) => set({ isScanning: v }),
  setIsHacking: (v) => set({ isHacking: v }),
  setLoadout: (loadout) => set({ loadout }),
  setOwnedModules: (modules) => set({ ownedModules: modules }),
}));
