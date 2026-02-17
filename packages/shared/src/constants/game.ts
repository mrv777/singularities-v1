import { PROGRESSION_BALANCE, REPAIR_BALANCE } from "./balance.js";

// XP thresholds per level (index = level, value = cumulative XP needed).
// Curve is tuned for faster early onboarding and steadier midgame progression.
export const XP_THRESHOLDS = [
  0,     // Level 1 (starting)
  80,    // Level 2
  190,   // Level 3
  360,   // Level 4
  580,   // Level 5
  860,   // Level 6
  1210,  // Level 7
  1630,  // Level 8
  2120,  // Level 9
  2680,  // Level 10
  3880,  // Level 11
  5080,  // Level 12
  6280,  // Level 13
  7480,  // Level 14
  8680,  // Level 15
  9880,  // Level 16
  11080, // Level 17
  12280, // Level 18
  13480, // Level 19
  14680, // Level 20
  15880, // Level 21
  17080, // Level 22
  18280, // Level 23
  19480, // Level 24
  20680, // Level 25
];

export const MAX_LEVEL = XP_THRESHOLDS.length;

export function getLevelForXP(xp: number): number {
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getXPForNextLevel(currentLevel: number): number | null {
  if (currentLevel >= MAX_LEVEL) return null;
  return XP_THRESHOLDS[currentLevel]; // currentLevel is 1-indexed, threshold index is 0-indexed
}

// Energy costs for actions
export const ENERGY_COSTS = {
  scan: 3,
  hackBase: 10,
  moduleUpgrade: 5,
  repair: 15,
} as const;

// Repair costs in credits
export const REPAIR_CREDIT_COST = REPAIR_BALANCE.creditsBase;
// Health restored per repair
export const REPAIR_HEALTH_AMOUNT = 30;
// Repair cooldown in seconds
export const REPAIR_COOLDOWN_SECONDS = 300; // 5 minutes

// Starting resources for new players
export const STARTING_RESOURCES = {
  credits: 100,
  data: 50,
  processingPower: 0,
} as const;

// Energy regen per level bonus
export const ENERGY_MAX_PER_LEVEL = 5; // +5 max energy per level

// Module purchase XP reward
export const MODULE_PURCHASE_XP = PROGRESSION_BALANCE.modulePurchaseXp;

// Heat escalation damage tables
export const HEAT_DAMAGE = [
  { minDamage: 5, maxDamage: 10, systemsAffected: 1, cooldownMinutes: 0 },    // heat 0
  { minDamage: 10, maxDamage: 20, systemsAffected: 2, cooldownMinutes: 0 },   // heat 1
  { minDamage: 20, maxDamage: 40, systemsAffected: 3, cooldownMinutes: 30 },  // heat 2+
] as const;

export function getHeatDamageConfig(heatLevel: number) {
  const idx = Math.min(heatLevel, HEAT_DAMAGE.length - 1);
  return HEAT_DAMAGE[idx];
}
