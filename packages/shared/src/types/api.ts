import type { Player, PlayerSystem, PlayerModule } from "./player.js";

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
