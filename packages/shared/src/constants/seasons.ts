export const SEASON_DURATION_DAYS = 90;

export const SEASON_STIPEND = {
  credits: 500,
  processingPower: 25,
} as const;

export const LEGACY_MODULE_PENALTY = 0.10;

export const CATCH_UP_BASE = {
  xpMultiplierPerLevelBehind: 0.35,
  maxXpMultiplier: 2.2,
  lateJoinMaxXpBoost: 2.4,
  resourceBoostFactor: 0.75,
} as const;

// Season reward pool distribution
export const SEASON_REWARD_POOL_SHARE = 0.5; // 50% of mint revenue → pool
export const SEASON_PAYOUT_SHARE = 0.8; // 80% of pool → winners
export const SEASON_CARRYOVER_SHARE = 0.2; // 20% of pool → next season
export const SEASON_PRIZE_SPLITS = [0.5625, 0.3125, 0.125] as const; // 1st, 2nd, 3rd
