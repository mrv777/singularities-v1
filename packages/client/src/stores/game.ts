import { create } from "zustand";
import type { ScanTarget, PlayerLoadout, PlayerModule, CombatLog } from "@singularities/shared";
import type { ArenaOpponent, ArenaAttackResponse } from "@singularities/shared";

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

  // Arena
  arenaOpponents: ArenaOpponent[];
  combatResult: ArenaAttackResponse | null;
  combatLogs: CombatLog[];
  isAttacking: boolean;
  isEnteringArena: boolean;

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
  setArenaOpponents: (opponents: ArenaOpponent[]) => void;
  setCombatResult: (result: ArenaAttackResponse | null) => void;
  setCombatLogs: (logs: CombatLog[]) => void;
  setIsAttacking: (v: boolean) => void;
  setIsEnteringArena: (v: boolean) => void;
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
  arenaOpponents: [],
  combatResult: null,
  combatLogs: [],
  isAttacking: false,
  isEnteringArena: false,

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
  setArenaOpponents: (opponents) => set({ arenaOpponents: opponents }),
  setCombatResult: (result) => set({ combatResult: result }),
  setCombatLogs: (logs) => set({ combatLogs: logs }),
  setIsAttacking: (v) => set({ isAttacking: v }),
  setIsEnteringArena: (v) => set({ isEnteringArena: v }),
}));
