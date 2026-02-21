import type {
  Player,
  PlayerSystem,
  PlayerModule,
  PlayerLoadout,
  PlayerScript,
  PlayerTrait,
  LoadoutType,
  SystemType,
} from "./player.js";
import type { CombatLog } from "./combat.js";
import type { WeeklyTopology, WorldEvent, PendingDecision, SeasonLeaderboardEntry, NetworkStats, MutationResult, Season } from "./world.js";
import type {
  ScanTarget,
  ModuleDefinition,
  ModifierDefinition,
  ModifierEffect,
  GeneticTrait,
  BinaryDecision,
  DataVaultProtocolDefinition,
  DataVaultBuffKey,
  IceLayerType,
  DaemonType,
  DaemonMissionDuration,
  MinigameType,
  SignalCrackDifficulty,
  PortSweepDifficulty,
  NetworkRelinkDifficulty,
} from "../constants/index.js";

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

export type RepairAllSkipReason =
  | "full_health"
  | "cooldown"
  | "insufficient_energy"
  | "insufficient_credits"
  | "budget_exhausted";

export interface RepairAllResponse {
  repaired: Array<{
    system: PlayerSystem;
    energyCost: number;
    creditCost: number;
  }>;
  skipped: Array<{
    systemType: SystemType;
    reason: RepairAllSkipReason;
  }>;
  totals: {
    repairedCount: number;
    skippedCount: number;
    damagedCount: number;
    energySpent: number;
    creditsSpent: number;
  };
  player: Player;
}

// Data Vault
export interface DataVaultActiveProtocol {
  id: string;
  name: string;
  expiresAt: string;
  buffs: Partial<Record<DataVaultBuffKey, number>>;
}

export interface DataVaultStatusResponse {
  protocols: DataVaultProtocolDefinition[];
  activeProtocol: DataVaultActiveProtocol | null;
  cooldownExpiresAt: string | null;
  dailyUses: number;
  dailyUseCap: number;
}

export interface DataVaultActivateRequest {
  protocolId: string;
}

export interface DataVaultActivateResponse {
  player: Player;
  activeProtocol: DataVaultActiveProtocol;
  cooldownExpiresAt: string;
  dailyUses: number;
  dailyUseCap: number;
}

// Modifiers
export interface ModifierResponse {
  modifier: ModifierDefinition | null;
  date: string;
  combinedEffects: ModifierEffect;
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
  isBot?: boolean;
  botTier?: "novice" | "adaptive" | "elite";
  disclosureLabel?: string;
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

export type ArenaLeaveResponse = ArenaEnterResponse;

export interface ArenaAttackRequest {
  targetId: string;
}

export interface ArenaAttackResponse {
  result: "attacker_win" | "defender_win";
  narrative: string[];
  rewards?: {
    credits: number;
    data?: number;
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

// Admin
export interface AdminStatusResponse {
  adminEnabled: boolean;
  isAdmin: true;
  actor: {
    playerId: string;
    walletAddress: string;
  };
  serverTime: string;
}

export interface AdminOverviewResponse {
  generatedAt: string;
  season: {
    id: number;
    name: string;
    endsAt: string;
    daysRemaining: number;
  } | null;
  metrics: {
    alivePlayers: number;
    activePlayers24h: number;
    inArenaNow: number;
    hacksToday: number;
    pvpHumanToday: number;
    pvpBotToday: number;
    deathsToday: number;
    botMatchShareToday: number;
  };
  pvpDailySeries: Array<{
    date: string;
    humanMatches: number;
    botMatches: number;
  }>;
  arenaBots: {
    enabled: boolean;
    targetOpponentFloor: number;
    maxBackfillPerRequest: number;
    maxAttacksPerDay: number;
    maxPlayerLevel: number;
  };
  recentAdminActions: Array<{
    id: string;
    adminPlayerId: string;
    action: string;
    details: Record<string, unknown> | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
  }>;
}

export interface AdminArenaBotSettingsRequest {
  enabled: boolean;
  note?: string;
}

export interface AdminArenaBotSettingsResponse {
  success: boolean;
  enabled: boolean;
}

export interface AdminArenaBotPreviewResponse {
  requestedLevel: number;
  bots: ArenaOpponent[];
}

export interface AdminSeasonEndRequest {
  confirmation: "END SEASON";
  reason?: string;
}

// System Health Summary (for AI Core coloring)
export interface SystemHealthSummaryResponse {
  worstStatus: string;
  criticalCount: number;
  degradedCount: number;
}

// ICE Breaker
export interface IceBreakerLayer {
  type: IceLayerType;
  threshold: number;
  depth: number;
}

export interface IceBreakerRunState {
  layers: IceBreakerLayer[];
  currentDepth: number;
  accumulatedRewards: { credits: number; data: number; xp: number; processingPower: number };
  completed: boolean;
  failed: boolean;
}

export interface IceBreakerStatusResponse {
  dailyAttemptsRemaining: number;
  cooldownTTL: number;
  activeRun: IceBreakerRunState | null;
  playerStats: { hackPower: number; stealth: number; defense: number; diversityBonus: number };
}

export interface IceBreakerInitiateResponse {
  run: IceBreakerRunState;
  player: Player;
}

export interface IceBreakerResolveResponse {
  passed: boolean;
  layerType: IceLayerType;
  depth: number;
  playerStat: number;
  threshold: number;
  passRate: number; // 0-100 percentage
  rewards?: { credits: number; data: number; xp: number; processingPower: number };
  damage?: { systems: Array<{ systemType: string; damage: number }> };
  run: IceBreakerRunState;
}

export interface IceBreakerExtractResponse {
  rewards: { credits: number; data: number; xp: number; processingPower: number };
  completionBonus?: boolean;
  player: Player;
  levelUp?: boolean;
  newLevel?: number;
}

// Daemon Forge
export interface PlayerDaemon {
  id: string;
  daemonType: DaemonType;
  durabilityRemaining: number;
  missionDuration: number | null;
  deployedAt: string | null;
  completesAt: string | null;
  createdAt: string;
}

export interface DaemonForgeStatusResponse {
  daemons: PlayerDaemon[];
  availableSlots: number;
  maxSlots: number;
}

export interface DaemonForgeCraftResponse {
  daemon: PlayerDaemon;
  player: Player;
}

export interface DaemonForgeDeployResponse {
  daemon: PlayerDaemon;
}

export interface DaemonForgeCollectResponse {
  daemon: PlayerDaemon | null;
  rewards: { credits: number; data: number };
  buffApplied?: { stat: string; amount: number; durationSeconds: number };
  player: Player;
}

// Mini-game types
export type SignalCrackFeedback = "EXACT" | "PRESENT" | "MISS";

export interface StartGameRequest {
  targetIndex: number;
}

export interface StartGameResponse {
  gameId: string;
  gameType: MinigameType;
  config: SignalCrackConfig | PortSweepConfig | NetworkRelinkConfig;
  expiresAt: string;
}

export interface SignalCrackConfig {
  type: "signal_crack";
  codeLength: number;
  digitPool: number;
  maxGuesses: number;
  timeLimitMs: number;
  modifier?: "blackout" | "corrupted";
}

export interface PortSweepConfig {
  type: "port_sweep";
  gridSize: number;
  portCount: number;
  maxProbes: number;
  timeLimitMs: number;
  modifier?: "decoys" | "mines";
}

export interface NetworkRelinkConfig {
  type: "network_relink";
  gridSize: number;
  pairs: number;
  timeLimitMs: number;
  /** Endpoint positions for each pair: [pairIndex] => [[r,c], [r,c]] */
  endpoints: Array<[[number, number], [number, number]]>;
  modifier?: "relay" | "interference";
  /** One relay node per pair (indexed by pairIndex); present when modifier === "relay" */
  relayNodes?: Array<[number, number]>;
  /** Permanently blocked cells; present when modifier === "interference" */
  blockedCells?: Array<[number, number]>;
}

export type GameConfig = SignalCrackConfig | PortSweepConfig | NetworkRelinkConfig;

// Moves
export interface SignalCrackMove {
  type: "signal_crack";
  guess: number[];
}

export interface PortSweepMove {
  type: "port_sweep";
  row: number;
  col: number;
}

export interface NetworkRelinkMove {
  type: "network_relink";
  paths: Array<{ pairIndex: number; cells: [number, number][] }>;
  drawCount: number;
}

export type GameMove = SignalCrackMove | PortSweepMove | NetworkRelinkMove;

export interface GameMoveRequest {
  move: GameMove;
}

// Move feedback
export interface SignalCrackMoveResult {
  type: "signal_crack";
  guess: number[];
  feedback: SignalCrackFeedback[];
  solved: boolean;
  guessesUsed: number;
  guessesRemaining: number;
  possibilitiesRemaining: number | null;
  gameOver: boolean;
}

export interface PortSweepMoveResult {
  type: "port_sweep";
  row: number;
  col: number;
  hit: boolean;
  adjacency: number | null; // null if hit, number of adjacent ports if miss
  portsFound: number;
  probesUsed: number;
  probesRemaining: number;
  allFound: boolean;
  gameOver: boolean;
  /** True when this miss triggered a mine surge costing 2 probes (modifier "mines" only) */
  mineSurge?: boolean;
}

export interface NetworkRelinkMoveResult {
  type: "network_relink";
  connectedPairs: number;
  totalPairs: number;
  filledCells: number;
  totalCells: number;
  score: number;
  gameOver: boolean;
}

export type GameMoveResult = SignalCrackMoveResult | PortSweepMoveResult | NetworkRelinkMoveResult;

export interface GameMoveResponse {
  result: GameMoveResult;
}

// Resolve
export interface GameResolveResponse {
  score: number;
  rewards?: {
    credits: number;
    data: number;
    reputation: number;
    xp: number;
    processingPower?: number;
  };
  detected: boolean;
  damage?: {
    systems: Array<{ systemType: string; damage: number }>;
  };
  narrative: string;
  levelUp?: boolean;
  newLevel?: number;
  player: Player;
  chainVerified?: boolean;
  txSignature?: string | null;
}

// Game status (for resume on reconnect)
export interface GameStatusResponse {
  active: boolean;
  gameId?: string;
  gameType?: MinigameType;
  config?: GameConfig;
  /** Partial state for the client to resume from */
  moveHistory?: GameMoveResult[];
  expiresAt?: string;
  startedAt?: string;
  expired?: boolean;
}

// Generic error
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
