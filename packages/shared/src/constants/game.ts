import { PROGRESSION_BALANCE, REPAIR_BALANCE } from "./balance.js";

// XP thresholds per level (index = level, value = cumulative XP needed).
// Curve is tuned for faster early onboarding and steadier midgame progression.
export const XP_THRESHOLDS = [
  0,     // Level 1 (starting)
  198,   // Level 2
  528,   // Level 3
  1023,  // Level 4
  1650,  // Level 5
  2475,  // Level 6
  3465,  // Level 7
  4703,  // Level 8
  6270,  // Level 9
  8250,  // Level 10
  10725, // Level 11
  13530, // Level 12
  16995, // Level 13
  21120, // Level 14
  25905, // Level 15
  31350, // Level 16
  37455, // Level 17
  44220, // Level 18
  51645, // Level 19
  59730, // Level 20
  68475, // Level 21
  77880, // Level 22
  87945, // Level 23
  98670, // Level 24
  110055, // Level 25
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
