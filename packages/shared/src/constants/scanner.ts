import { SCANNER_BALANCE } from "./balance.js";

export const TARGET_TYPES = [
  "database",
  "government",
  "financial",
  "military",
  "corporate",
  "research",
  "infrastructure",
] as const;

export type TargetType = (typeof TARGET_TYPES)[number];

export const TARGET_TYPE_LABELS: Record<TargetType, string> = {
  database: "Database Server",
  government: "Government Network",
  financial: "Financial System",
  military: "Military Grid",
  corporate: "Corporate Mainframe",
  research: "Research Lab",
  infrastructure: "Infrastructure Node",
};

export const RISK_RATINGS = ["low", "medium", "high", "critical"] as const;
export type RiskRating = (typeof RISK_RATINGS)[number];

export function getRiskRating(securityLevel: number): RiskRating {
  if (securityLevel < 30) return "low";
  if (securityLevel < 55) return "medium";
  if (securityLevel < 75) return "high";
  return "critical";
}

export const RISK_COLORS: Record<RiskRating, string> = {
  low: "#00ff88",
  medium: "#ffaa00",
  high: "#ff6633",
  critical: "#ff3333",
};

export const SCAN_ENERGY_COST = 3;
export const SCAN_TARGET_COUNT = 5;
export const SCAN_TTL_SECONDS = 600; // 10 minutes

export function getHackEnergyCost(securityLevel: number): number {
  return SCANNER_BALANCE.hackCost.base + Math.floor(securityLevel / SCANNER_BALANCE.hackCost.securityDivisor);
}

export function getBaseReward(securityLevel: number) {
  return {
    credits: Math.floor(
      SCANNER_BALANCE.rewards.creditsBase
      + securityLevel * SCANNER_BALANCE.rewards.creditsPerSecurity
    ),
    data: Math.floor(
      SCANNER_BALANCE.rewards.dataBase
      + securityLevel * SCANNER_BALANCE.rewards.dataPerSecurity
    ),
    reputation: Math.floor(
      SCANNER_BALANCE.rewards.reputationBase
      + securityLevel * SCANNER_BALANCE.rewards.reputationPerSecurity
    ),
    xp: Math.floor(
      SCANNER_BALANCE.rewards.xpBase
      + securityLevel * SCANNER_BALANCE.rewards.xpPerSecurity
    ),
  };
}

export interface ScanTarget {
  index: number;
  name: string;
  type: TargetType;
  securityLevel: number;
  riskRating: RiskRating;
  detectionChance: number;
  rewards: {
    credits: number;
    data: number;
    reputation: number;
    xp: number;
  };
}
