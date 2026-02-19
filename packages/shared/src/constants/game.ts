import { PROGRESSION_BALANCE, REPAIR_BALANCE } from "./balance.js";

// XP thresholds per level (index = level, value = cumulative XP needed).
// Curve is tuned for faster early onboarding and steadier midgame progression.
export const XP_THRESHOLDS = [
  0,     // Level 1 (starting)
  198,   // Level 2
  528,   // Level 3
  1040,  // Level 4
  1850,  // Level 5
  2850,  // Level 6
  4100,  // Level 7
  5700,  // Level 8
  7700,  // Level 9
  10300, // Level 10
  13500, // Level 11
  17300, // Level 12
  22000, // Level 13
  27600, // Level 14
  34100, // Level 15
  41600, // Level 16
  50100, // Level 17
  59700, // Level 18
  70400, // Level 19
  82300, // Level 20
  95500, // Level 21
  110000, // Level 22
  126000, // Level 23
  143500, // Level 24
  162500, // Level 25
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
  scan: 12,        // keep in sync with SCAN_ENERGY_COST for scripts
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
