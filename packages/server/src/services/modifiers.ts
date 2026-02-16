import { query } from "../db/pool.js";
import { redis } from "../db/redis.js";
import {
  MODIFIER_MAP,
  MINOR_MODIFIERS,
  MAJOR_MODIFIERS,
  type ModifierDefinition,
  type ModifierEffect,
} from "@singularities/shared";

const REDIS_MODIFIER_KEY = "daily_modifier";
const REDIS_EFFECTS_KEY = "daily_modifier_effects";

function pickTodayModifier(): ModifierDefinition {
  // 5/7 chance minor, 2/7 chance major
  const roll = Math.random();
  const pool = roll < 5 / 7 ? MINOR_MODIFIERS : MAJOR_MODIFIERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getTodayModifier(): Promise<ModifierDefinition | null> {
  const today = todayDateString();

  // Check Redis cache first
  const cached = await redis.get(REDIS_MODIFIER_KEY);
  if (cached) {
    const parsed = JSON.parse(cached) as { date: string; modifierId: string };
    if (parsed.date === today) {
      return MODIFIER_MAP[parsed.modifierId] ?? null;
    }
  }

  // Check DB
  const result = await query(
    "SELECT * FROM daily_modifiers WHERE date = $1",
    [today]
  );

  let modifierId: string;

  if (result.rows.length > 0) {
    modifierId = result.rows[0].modifier_id as string;
  } else {
    // Lazy-create today's modifier
    const chosen = pickTodayModifier();
    modifierId = chosen.id;
    await query(
      `INSERT INTO daily_modifiers (date, modifier_id, modifier_data)
       VALUES ($1, $2, $3)
       ON CONFLICT (date) DO NOTHING`,
      [today, modifierId, JSON.stringify(chosen.effects)]
    );

    // Re-read in case of race condition
    const recheck = await query(
      "SELECT * FROM daily_modifiers WHERE date = $1",
      [today]
    );
    if (recheck.rows.length > 0) {
      modifierId = recheck.rows[0].modifier_id as string;
    }
  }

  // Cache in Redis for 1 hour
  await redis.set(
    REDIS_MODIFIER_KEY,
    JSON.stringify({ date: today, modifierId }),
    "EX",
    3600
  );

  return MODIFIER_MAP[modifierId] ?? null;
}

const DEFAULT_EFFECTS: ModifierEffect = {
  energyCostMultiplier: 1,
  hackRewardMultiplier: 1,
  degradationRateMultiplier: 1,
  repairCostMultiplier: 1,
  passiveIncomeMultiplier: 1,
  detectionChanceMultiplier: 1,
  xpGainMultiplier: 1,
  heatDecayMultiplier: 1,
};

export async function getActiveModifierEffects(): Promise<ModifierEffect> {
  // Check Redis cache
  const cached = await redis.get(REDIS_EFFECTS_KEY);
  if (cached) {
    const parsed = JSON.parse(cached) as { date: string; effects: ModifierEffect };
    if (parsed.date === todayDateString()) {
      return parsed.effects;
    }
  }

  const modifier = await getTodayModifier();
  if (!modifier) return { ...DEFAULT_EFFECTS };

  const effects: ModifierEffect = { ...DEFAULT_EFFECTS, ...modifier.effects };

  // Cache for 1 hour
  await redis.set(
    REDIS_EFFECTS_KEY,
    JSON.stringify({ date: todayDateString(), effects }),
    "EX",
    3600
  );

  return effects;
}
