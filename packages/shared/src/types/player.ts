export interface Player {
  id: string;
  walletAddress: string;
  mintAddress: string | null;
  aiName: string;
  level: number;
  xp: number;
  credits: number;
  energy: number;
  energyMax: number;
  processingPower: number;
  data: number;
  reputation: number;
  alignment: number; // -1.0 (domination) to 1.0 (benevolent)
  heatLevel: number;
  isAlive: boolean;
  isInSandbox: boolean;
  inPvpArena: boolean;
  energyUpdatedAt: string;
  lastActiveAt: string;
  createdAt: string;
  seasonId: number | null;
  adaptationPeriodUntil: string | null;
  pvpShieldUntil: string | null;
  loginStreak: number;
  lastStreakDate: string | null;
  tutorialStep: string;
}

export type SystemType =
  | "neural_core"
  | "memory_banks"
  | "quantum_processor"
  | "security_protocols"
  | "data_pathways"
  | "energy_distribution";

export type SystemStatus = "OPTIMAL" | "DEGRADED" | "CRITICAL" | "CORRUPTED";

export interface PlayerSystem {
  id: string;
  playerId: string;
  systemType: SystemType;
  health: number; // 0-100
  status: SystemStatus;
  updatedAt: string;
}

export interface PlayerModule {
  id: string;
  playerId: string;
  moduleId: string;
  level: number; // 1-5
  mutation: string | null;
  purchasedAt: string;
}

export type LoadoutType = "attack" | "defense" | "infiltration";

export interface PlayerLoadout {
  id: string;
  playerId: string;
  loadoutType: LoadoutType;
  slot: number; // 1, 2, or 3
  moduleId: string | null;
}

export interface PlayerScript {
  id: string;
  playerId: string;
  triggerCondition: string;
  action: string;
  isActive: boolean;
  createdAt: string;
}

export interface PlayerTrait {
  id: string;
  playerId: string;
  traitId: string;
}

export interface PlayerDecision {
  id: string;
  playerId: string;
  decisionId: string;
  choice: "yes" | "no";
  effects: Record<string, unknown> | null;
  createdAt: string;
}
