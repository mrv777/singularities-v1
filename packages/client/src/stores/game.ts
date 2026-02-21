import { create } from "zustand";
import type {
  ScanTarget,
  PlayerLoadout,
  PlayerModule,
  CombatLog,
  WeeklyTopology,
  WorldEvent,
  PendingDecisionResponse,
  SystemHealthSummaryResponse,
  MinigameType,
  GameConfig,
  GameMoveResult,
  GameResolveResponse,
} from "@singularities/shared";
import type { ArenaOpponent, ArenaAttackResponse, DecisionChooseResponse } from "@singularities/shared";

export type ScannerPhase = "idle" | "targets" | "playing" | "result";

interface GameState {
  // Scanner
  scannedTargets: ScanTarget[];
  scanExpiresAt: string | null;
  selectedTargetIndex: number | null;
  hackResult: unknown | null;
  isScanning: boolean;
  isHacking: boolean;

  // Mini-game
  scannerPhase: ScannerPhase;
  activeGameType: MinigameType | null;
  activeGameConfig: GameConfig | null;
  activeGameExpiresAt: string | null;
  gameStartedAt: number | null;
  gameMoveHistory: GameMoveResult[];
  gameResult: GameResolveResponse | null;
  isSubmittingMove: boolean;
  isStartingGame: boolean;
  isResolvingGame: boolean;

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
  isLeavingArena: boolean;

  // Phase 4: World systems
  pendingDecision: PendingDecisionResponse["decision"] | null;
  decisionResult: DecisionChooseResponse | null;
  topology: WeeklyTopology | null;
  worldEvents: WorldEvent[];

  // System health summary for AI Core coloring
  systemHealthSummary: SystemHealthSummaryResponse | null;

  // Actions
  setScannedTargets: (targets: ScanTarget[], expiresAt: string) => void;
  clearScan: () => void;
  selectTarget: (index: number | null) => void;
  setHackResult: (result: unknown) => void;
  clearHackResult: () => void;
  setIsScanning: (v: boolean) => void;
  setIsHacking: (v: boolean) => void;

  // Mini-game actions
  setScannerPhase: (phase: ScannerPhase) => void;
  setActiveGame: (
    gameType: MinigameType,
    config: GameConfig,
    expiresAt: string,
    opts?: { moveHistory?: GameMoveResult[]; startedAt?: string }
  ) => void;
  clearActiveGame: () => void;
  addMoveResult: (result: GameMoveResult) => void;
  setGameResult: (result: GameResolveResponse | null) => void;
  setIsSubmittingMove: (v: boolean) => void;
  setIsStartingGame: (v: boolean) => void;
  setIsResolvingGame: (v: boolean) => void;

  setLoadout: (loadout: PlayerLoadout[]) => void;
  setOwnedModules: (modules: PlayerModule[]) => void;
  setArenaOpponents: (opponents: ArenaOpponent[]) => void;
  setCombatResult: (result: ArenaAttackResponse | null) => void;
  setCombatLogs: (logs: CombatLog[]) => void;
  setIsAttacking: (v: boolean) => void;
  setIsEnteringArena: (v: boolean) => void;
  setIsLeavingArena: (v: boolean) => void;
  setPendingDecision: (d: PendingDecisionResponse["decision"] | null) => void;
  setDecisionResult: (r: DecisionChooseResponse | null) => void;
  setTopology: (t: WeeklyTopology | null) => void;
  setWorldEvents: (e: WorldEvent[]) => void;
  setSystemHealthSummary: (s: SystemHealthSummaryResponse | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  scannedTargets: [],
  scanExpiresAt: null,
  selectedTargetIndex: null,
  hackResult: null,
  isScanning: false,
  isHacking: false,

  // Mini-game
  scannerPhase: "idle",
  activeGameType: null,
  activeGameConfig: null,
  activeGameExpiresAt: null,
  gameStartedAt: null,
  gameMoveHistory: [],
  gameResult: null,
  isSubmittingMove: false,
  isStartingGame: false,
  isResolvingGame: false,

  loadout: [],
  ownedModules: [],
  arenaOpponents: [],
  combatResult: null,
  combatLogs: [],
  isAttacking: false,
  isEnteringArena: false,
  isLeavingArena: false,
  pendingDecision: null,
  decisionResult: null,
  topology: null,
  worldEvents: [],
  systemHealthSummary: null,

  setScannedTargets: (targets, expiresAt) =>
    set({
      scannedTargets: targets,
      scanExpiresAt: expiresAt,
      selectedTargetIndex: null,
      hackResult: null,
      scannerPhase: targets.length > 0 ? "targets" : "idle",
    }),
  clearScan: () =>
    set({
      scannedTargets: [],
      scanExpiresAt: null,
      selectedTargetIndex: null,
      hackResult: null,
      scannerPhase: "idle",
    }),
  selectTarget: (index) => set({ selectedTargetIndex: index, hackResult: null }),
  setHackResult: (result) => set({ hackResult: result }),
  clearHackResult: () => set({ hackResult: null }),
  setIsScanning: (v) => set({ isScanning: v }),
  setIsHacking: (v) => set({ isHacking: v }),

  // Mini-game actions
  setScannerPhase: (phase) => set({ scannerPhase: phase }),
  setActiveGame: (gameType, config, expiresAt, opts) =>
    set({
      activeGameType: gameType,
      activeGameConfig: config,
      activeGameExpiresAt: expiresAt,
      gameStartedAt: opts?.startedAt ? new Date(opts.startedAt).getTime() : Date.now(),
      gameMoveHistory: opts?.moveHistory ?? [],
      gameResult: null,
      scannerPhase: "playing",
    }),
  clearActiveGame: () =>
    set({
      activeGameType: null,
      activeGameConfig: null,
      activeGameExpiresAt: null,
      gameStartedAt: null,
      gameMoveHistory: [],
      scannerPhase: "idle",
      scannedTargets: [],
      scanExpiresAt: null,
      selectedTargetIndex: null,
    }),
  addMoveResult: (result) =>
    set((s) => ({ gameMoveHistory: [...s.gameMoveHistory, result] })),
  setGameResult: (result) =>
    set({ gameResult: result, scannerPhase: result ? "result" : "idle" }),
  setIsSubmittingMove: (v) => set({ isSubmittingMove: v }),
  setIsStartingGame: (v) => set({ isStartingGame: v }),
  setIsResolvingGame: (v) => set({ isResolvingGame: v }),

  setLoadout: (loadout) => set({ loadout }),
  setOwnedModules: (modules) => set({ ownedModules: modules }),
  setArenaOpponents: (opponents) => set({ arenaOpponents: opponents }),
  setCombatResult: (result) => set({ combatResult: result }),
  setCombatLogs: (logs) => set({ combatLogs: logs }),
  setIsAttacking: (v) => set({ isAttacking: v }),
  setIsEnteringArena: (v) => set({ isEnteringArena: v }),
  setIsLeavingArena: (v) => set({ isLeavingArena: v }),
  setPendingDecision: (d) => set({ pendingDecision: d }),
  setDecisionResult: (r) => set({ decisionResult: r }),
  setTopology: (t) => set({ topology: t }),
  setWorldEvents: (e) => set({ worldEvents: e }),
  setSystemHealthSummary: (s) => set({ systemHealthSummary: s }),
}));
