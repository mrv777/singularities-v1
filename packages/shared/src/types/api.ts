import type { Player, PlayerSystem, PlayerModule, PlayerLoadout, PlayerScript, PlayerTrait, LoadoutType } from "./player.js";
import type { CombatLog } from "./combat.js";
import type { WeeklyTopology, WorldEvent, PendingDecision, SeasonLeaderboardEntry, NetworkStats, MutationResult, Season } from "./world.js";
import type { ScanTarget, ModuleDefinition, ModifierDefinition, GeneticTrait, BinaryDecision } from "../constants/index.js";

// Auth
export interface AuthChallengeRequest {
  walletAddress: string;
}

export interface AuthChallengeResponse {
  nonce: string;
  message: string;
}

export interface AuthVerifyRequest {
  walletAddress: string;
  signature: string;
  nonce: string;
}

export interface AuthVerifyResponse {
  token: string;
  player: Player;
}

// Player
export interface PlayerResponse {
  player: Player;
  systems: PlayerSystem[];
  modules: PlayerModule[];
  loadouts: PlayerLoadout[];
  traits: PlayerTrait[];
  unlockedSystems: string[];
  passiveIncome: { credits: number; data: number } | null;
  activeModifier: ModifierDefinition | null;
}

// Registration
export interface RegisterRequest {
  aiName: string;
}

export interface RegisterResponse {
  player: Player;
}

// Scanner
export interface ScanRequest {}

export interface ScanResponse {
  targets: ScanTarget[];
  expiresAt: string;
}

export interface HackRequest {
  targetIndex: number;
}

export interface HackResult {
  success: boolean;
  detected: boolean;
  narrative: string;
  rewards?: {
    credits: number;
    data: number;
    reputation: number;
    xp: number;
    processingPower?: number;
  };
  damage?: {
    systems: Array<{ systemType: string; damage: number }>;
  };
  levelUp?: boolean;
  newLevel?: number;
  player: Player;
  chainVerified?: boolean;
  txSignature?: string | null;
}

// Modules
export interface ModulesResponse {
  definitions: ModuleDefinition[];
  owned: PlayerModule[];
}

export interface ModulePurchaseRequest {
  moduleId: string;
}

export interface ModulePurchaseResponse {
  player: Player;
  module: PlayerModule;
  levelUp?: boolean;
  newLevel?: number;
}

// Loadouts
export interface LoadoutResponse {
  loadout: PlayerLoadout[];
}

export interface LoadoutUpdateRequest {
  type?: LoadoutType;
  slots: [string | null, string | null, string | null];
}

export interface LoadoutUpdateResponse {
  loadout: PlayerLoadout[];
}

export interface LoadoutAllResponse {
  loadouts: PlayerLoadout[];
}

// Health
export interface HealthResponse {
  status: "ok";
  timestamp: string;
}

// Sandbox Exit
export interface ExitSandboxResponse {
  player: Player;
}

// Maintenance
export interface RepairRequest {
  systemType: string;
}

export interface RepairResponse {
  system: PlayerSystem;
  player: Player;
}

export interface FullScanResponse {
  systems: PlayerSystem[];
}

// Modifiers
export interface ModifierResponse {
  modifier: ModifierDefinition | null;
  date: string;
}

// Scripts
export interface ScriptCreateRequest {
  triggerCondition: string;
  action: string;
}

export interface ScriptListResponse {
  scripts: PlayerScript[];
}

// Arena (PvP)
export interface ArenaOpponent {
  id: string;
  aiName: string;
  level: number;
  reputation: number;
  playstyle: string;
  alignment: number;
}

export interface ArenaAvailableResponse {
  opponents: ArenaOpponent[];
  isInArena: boolean;
  isPvpHours: boolean;
}

export interface ArenaEnterResponse {
  success: boolean;
  player: Player;
}

export interface ArenaAttackRequest {
  targetId: string;
}

export interface ArenaAttackResponse {
  result: "attacker_win" | "defender_win";
  narrative: string[];
  rewards?: {
    credits: number;
    reputation: number;
    xp: number;
    processingPower?: number;
  };
  damage?: {
    systems: Array<{ systemType: string; damage: number }>;
  };
  player: Player;
  combatLog: CombatLog;
}

export interface ArenaCombatLogsResponse {
  logs: CombatLog[];
}

// Security Center
export interface SecurityOverviewResponse {
  defenseLoadout: PlayerLoadout[];
  recentAttacks: CombatLog[];
  heatLevel: number;
  systemHealthSummary: Array<{ systemType: string; health: number; status: string }>;
}

// Death & Rebirth
export interface DeathResponse {
  guaranteedModule: string | null;
  recoveredModules: string[];
  deathCount: number;
}

export interface RebirthResponse {
  player: Player;
  traits: PlayerTrait[];
  recoveredModules: string[];
}

// Traits
export interface PlayerTraitResponse {
  traits: Array<PlayerTrait & { definition: GeneticTrait }>;
}

// Topology
export interface TopologyResponse {
  topology: WeeklyTopology | null;
}

// World Events
export interface WorldEventsResponse {
  events: WorldEvent[];
}

// Network Stats
export interface NetworkStatsResponse {
  stats: NetworkStats;
}

// Decisions
export interface PendingDecisionResponse {
  decision: (PendingDecision & { definition: BinaryDecision }) | null;
}

export interface DecisionChooseRequest {
  decisionId: string;
  choice: "yes" | "no";
}

export interface DecisionChooseResponse {
  effects: Array<{ description: string }>;
  alignmentShift: number;
  player: Player;
}

export interface DecisionHistoryResponse {
  decisions: Array<{
    decisionId: string;
    choice: "yes" | "no";
    effects: Record<string, unknown> | null;
    createdAt: string;
  }>;
}

// Mutations
export interface MutateModuleRequest {
  moduleId: string;
}

export interface MutateModuleResponse {
  result: MutationResult;
  player: Player;
  module: PlayerModule;
}

// Seasons
export interface CurrentSeasonResponse {
  season: Season | null;
  daysRemaining: number;
}

export interface SeasonLeaderboardResponse {
  leaderboard: SeasonLeaderboardEntry[];
  playerRank: number | null;
}

// Generic error
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
