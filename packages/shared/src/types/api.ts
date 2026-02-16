import type { Player, PlayerSystem, PlayerModule, PlayerLoadout, PlayerScript } from "./player.js";
import type { ScanTarget, ModuleDefinition, ModifierDefinition } from "../constants/index.js";

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
  };
  damage?: {
    systems: Array<{ systemType: string; damage: number }>;
  };
  levelUp?: boolean;
  newLevel?: number;
  player: Player;
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
  slots: [string | null, string | null, string | null];
}

export interface LoadoutUpdateResponse {
  loadout: PlayerLoadout[];
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

// Generic error
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
