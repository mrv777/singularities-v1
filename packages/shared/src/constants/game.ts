import { PROGRESSION_BALANCE, REPAIR_BALANCE } from "./balance.js";

// XP thresholds per level (index = level, value = cumulative XP needed).
// Curve is tuned for faster early onboarding and steadier midgame progression.
export const XP_THRESHOLDS = [
  0,     // Level 1 (starting)
  120,   // Level 2
  320,   // Level 3
  620,   // Level 4
  1000,  // Level 5
  1500,  // Level 6
  2100,  // Level 7
  2850,  // Level 8
  3800,  // Level 9
  5000,  // Level 10
  6500,  // Level 11
  8200,  // Level 12
  10300, // Level 13
  12800, // Level 14
  15700, // Level 15
  19000, // Level 16
  22700, // Level 17
  26800, // Level 18
  31300, // Level 19
  36200, // Level 20
  41500, // Level 21
  47200, // Level 22
  53300, // Level 23
  59800, // Level 24
  66700, // Level 25
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
  repair: 12,
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
export const ENERGY_MAX_PER_LEVEL = 7; // +7 max energy per level

// Module purchase XP reward
export const MODULE_PURCHASE_XP = PROGRESSION_BALANCE.modulePurchaseXp;

/**
 * On level-up, top energy up to at least a floor percentage of the new max.
 * This preserves conservative pacing while reducing "I just leveled but can't act" frustration.
 */
export function getEnergyAfterLevelUp(currentEnergy: number, newEnergyMax: number): number {
  const floor = Math.round(newEnergyMax * PROGRESSION_BALANCE.levelUpEnergyRefillFloorPct);
  return Math.min(newEnergyMax, Math.max(currentEnergy, floor));
}

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
