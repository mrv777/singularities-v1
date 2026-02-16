// XP thresholds per level (index = level, value = cumulative XP needed)
// Levels 1-10: hand-tuned curve. Levels 11-25: 4000 + (level-10) * 1500
export const XP_THRESHOLDS = [
  0,     // Level 1 (starting)
  100,   // Level 2
  250,   // Level 3
  500,   // Level 4
  850,   // Level 5
  1300,  // Level 6
  1850,  // Level 7
  2500,  // Level 8
  3300,  // Level 9
  4200,  // Level 10
  5500,  // Level 11
  7000,  // Level 12
  8500,  // Level 13
  10000, // Level 14
  11500, // Level 15
  13000, // Level 16
  14500, // Level 17
  16000, // Level 18
  17500, // Level 19
  19000, // Level 20
  20500, // Level 21
  22000, // Level 22
  23500, // Level 23
  25000, // Level 24
  26500, // Level 25
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
  scan: 5,
  hackBase: 10,
  moduleUpgrade: 5,
  repair: 15,
} as const;

// Repair costs in credits
export const REPAIR_CREDIT_COST = 25;
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
export const MODULE_PURCHASE_XP = 10;

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
