export type CombatResult = "attacker_win" | "defender_win";

export interface CombatLogEntry {
  round: number;
  attackerAction: string;
  defenderAction: string;
  damage: number;
  targetSystem: string;
  description: string;
}

export interface CombatLog {
  id: string;
  attackerId: string;
  defenderId: string;
  attackerLoadout: Record<string, unknown>;
  defenderLoadout: Record<string, unknown>;
  result: CombatResult;
  damageDealt: Record<string, number> | null;
  creditsTransferred: number;
  reputationChange: number;
  combatLog: CombatLogEntry[];
  createdAt: string;
}

export interface InfiltrationLog {
  id: string;
  playerId: string;
  targetType: string;
  securityLevel: number;
  success: boolean;
  detected: boolean;
  creditsEarned: number;
  reputationEarned: number;
  damageTaken: Record<string, number> | null;
  createdAt: string;
}
