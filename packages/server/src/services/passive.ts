import { query } from "../db/pool.js";
import { computeEnergy, mapPlayerRow } from "./player.js";
import { getActiveModifierEffects } from "./modifiers.js";
import { getSeasonCatchUpBonuses } from "./seasons.js";
import {
  PASSIVE_CREDITS_PER_HOUR,
  PASSIVE_DATA_PER_HOUR,
  PASSIVE_MAX_HOURS,
  PASSIVE_SKIP_DAY_MULTIPLIER,
  LOGIN_STREAK_REWARDS,
  type StreakReward,
  type ModifierEffect,
} from "@singularities/shared";

export interface PassiveIncome {
  credits: number;
  data: number;
  streakReward: StreakReward | null;
  loginStreak: number;
}

/**
 * Compute passive income for a player based on elapsed time since last_active_at.
 * Does NOT modify the DB — pure calculation.
 */
export function computePassiveIncome(
  playerRow: Record<string, unknown>,
  effects: ModifierEffect,
  resourceMultiplier = 1
): PassiveIncome {
  const lastActiveAt = new Date(playerRow.last_active_at as string).getTime();
  const now = Date.now();
  const hoursElapsed = Math.max(0, (now - lastActiveAt) / (1000 * 3600));

  // Cap at PASSIVE_MAX_HOURS
  const cappedHours = Math.min(hoursElapsed, PASSIVE_MAX_HOURS);

  if (cappedHours < 0.0833) {
    // Less than 5 minutes — no passive income
    return { credits: 0, data: 0, streakReward: null, loginStreak: 0 };
  }

  // Apply skip-day multiplier for time beyond 24 hours
  const multiplier = hoursElapsed > 24 ? PASSIVE_SKIP_DAY_MULTIPLIER : 1;
  const incomeMultiplier = (effects.passiveIncomeMultiplier ?? 1) * multiplier * resourceMultiplier;

  const credits = Math.floor(cappedHours * PASSIVE_CREDITS_PER_HOUR * incomeMultiplier);
  const data = Math.floor(cappedHours * PASSIVE_DATA_PER_HOUR * incomeMultiplier);

  return { credits, data, streakReward: null, loginStreak: 0 };
}

/**
 * Materialize passive income: compute + award + reset last_active_at.
 * Returns the income awarded, or null if less than 5 min since last active.
 */
export async function materializePassiveIncome(
  playerId: string
): Promise<PassiveIncome | null> {
  const effects = await getActiveModifierEffects();
  let resourceMultiplier = 1;
  try {
    const bonuses = await getSeasonCatchUpBonuses(playerId);
    resourceMultiplier = bonuses.resourceMultiplier;
  } catch {
    // Non-critical: fallback to base multiplier.
  }

  const result = await query(
    "SELECT * FROM players WHERE id = $1",
    [playerId]
  );
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const originalLastActive = row.last_active_at as string;
  const income = computePassiveIncome(row, effects, resourceMultiplier);

  if (income.credits === 0 && income.data === 0) {
    return null;
  }

  // --- Login streak logic ---
  const todayUTC = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const lastStreakDate = row.last_streak_date ? new Date(row.last_streak_date).toISOString().slice(0, 10) : null;
  let newStreak = (row.login_streak as number) ?? 0;
  let streakReward: StreakReward | null = null;

  if (lastStreakDate !== todayUTC) {
    // Check if yesterday
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (lastStreakDate === yesterdayStr) {
      // Consecutive day — increment streak
      newStreak = newStreak + 1;
    } else {
      // Streak broken (or first time) — reset to 1
      newStreak = 1;
    }

    // Get reward for this day in the 7-day cycle (0-indexed)
    const rewardIndex = (newStreak - 1) % LOGIN_STREAK_REWARDS.length;
    streakReward = LOGIN_STREAK_REWARDS[rewardIndex];
  }

  // Total credits/data including streak bonus
  const totalCredits = income.credits + (streakReward?.credits ?? 0);
  const totalData = income.data + (streakReward?.data ?? 0);
  const totalPP = streakReward?.processingPower ?? 0;

  // Conditional UPDATE: only applies if last_active_at hasn't changed since we read it.
  // Prevents double-award from concurrent /me requests.
  const updateResult = await query(
    `UPDATE players
     SET credits = credits + $2,
         data = data + $3,
         processing_power = processing_power + $4,
         last_active_at = NOW(),
         login_streak = $5,
         last_streak_date = $6::date
     WHERE id = $1 AND last_active_at = $7`,
    [playerId, totalCredits, totalData, totalPP, newStreak, streakReward ? todayUTC : (lastStreakDate ?? null), originalLastActive]
  );

  // If 0 rows updated, another request already materialized the income
  if (updateResult.rowCount === 0) {
    return null;
  }

  income.streakReward = streakReward;
  income.loginStreak = newStreak;

  return income;
}
