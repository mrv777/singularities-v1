import type { Player, PlayerSystem, PlayerModule, PlayerLoadout } from "./player.js";
import type { ScanTarget, ModuleDefinition } from "../constants/index.js";

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

// Generic error
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
