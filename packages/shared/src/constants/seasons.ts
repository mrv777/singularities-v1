export const SEASON_DURATION_DAYS = 90;

export const SEASON_STIPEND = {
  credits: 500,
} as const;

export const LEGACY_MODULE_PENALTY = 0.10;

export const CATCH_UP_BASE = {
  xpMultiplierPerLevelBehind: 0.05,
  maxXpMultiplier: 0.50,
  joinBoostDays: 7,
  joinBoostMultiplier: 0.25,
} as const;
