// Base passive income rates (before modifiers)
export const PASSIVE_CREDITS_PER_HOUR = 6;
export const PASSIVE_DATA_PER_HOUR = 3;

// Maximum hours of passive income that can accumulate (24h cap)
export const PASSIVE_MAX_HOURS = 24;

// Multiplier for days the player was not active (encourages daily login)
export const PASSIVE_SKIP_DAY_MULTIPLIER = 0.5; // 50% rate after 24h away

// Login streak rewards — 7-day cycle, then repeats
export interface StreakReward {
  credits: number;
  data: number;
  processingPower: number;
}

export const LOGIN_STREAK_REWARDS: StreakReward[] = [
  { credits: 50,  data: 0,  processingPower: 0 }, // Day 1
  { credits: 0,   data: 20, processingPower: 0 }, // Day 2
  { credits: 100, data: 0,  processingPower: 0 }, // Day 3
  { credits: 0,   data: 0,  processingPower: 1 }, // Day 4
  { credits: 150, data: 0,  processingPower: 0 }, // Day 5
  { credits: 0,   data: 30, processingPower: 0 }, // Day 6
  { credits: 500, data: 0,  processingPower: 2 }, // Day 7
];
