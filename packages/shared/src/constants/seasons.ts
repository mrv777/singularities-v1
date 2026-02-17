export const SEASON_DURATION_DAYS = 90;

export const SEASON_STIPEND = {
  credits: 500,
  processingPower: 25,
} as const;

export const LEGACY_MODULE_PENALTY = 0.10;

export const CATCH_UP_BASE = {
  xpMultiplierPerLevelBehind: 0.25,
  maxXpMultiplier: 2.2,
  lateJoinMaxXpBoost: 1.8,
  resourceBoostFactor: 0.75,
} as const;
