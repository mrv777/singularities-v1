import { query } from "../db/pool.js";
import { redis } from "../db/redis.js";
import { RIPPLE_THRESHOLDS, RIPPLE_EVENTS, type RippleEvent } from "@singularities/shared";
import type { WorldEvent } from "@singularities/shared";

const REDIS_EVENTS_KEY = "world_events";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayDateString(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function analyzeAndGenerateRipples(): Promise<WorldEvent[]> {
  const today = todayDateString();
  const yesterday = yesterdayDateString();

  // Check if already generated today
  const existingRes = await query(
    "SELECT id FROM world_events WHERE date = $1",
    [today]
  );
  if (existingRes.rows.length > 0) return [];

  // Aggregate yesterday's activity
  const [hacksRes, pvpRes, deathsRes, upgradesRes] = await Promise.all([
    query(
      "SELECT COUNT(*) as count FROM infiltration_logs WHERE created_at::date = $1",
      [yesterday]
    ),
    query(
      "SELECT COUNT(*) as count FROM combat_logs WHERE created_at::date = $1",
      [yesterday]
    ),
    query(
      "SELECT COUNT(*) as count FROM wallet_carryovers WHERE last_death_at::date = $1",
      [yesterday]
    ),
    query(
      "SELECT COUNT(*) as count FROM player_modules WHERE purchased_at::date = $1",
      [yesterday]
    ),
  ]);

  const metrics: Record<string, number> = {
    totalHacks: parseInt(hacksRes.rows[0]?.count as string, 10) || 0,
    stealthUsage: Math.floor((parseInt(hacksRes.rows[0]?.count as string, 10) || 0) * 0.4), // Approximate
    pvpBattles: parseInt(pvpRes.rows[0]?.count as string, 10) || 0,
    deaths: parseInt(deathsRes.rows[0]?.count as string, 10) || 0,
    moduleUpgrades: parseInt(upgradesRes.rows[0]?.count as string, 10) || 0,
  };

  // Check which thresholds are met
  const triggeredEvents: RippleEvent[] = [];
  for (const threshold of RIPPLE_THRESHOLDS) {
    const value = metrics[threshold.metric] ?? 0;
    if (value >= threshold.threshold) {
      const event = RIPPLE_EVENTS.find((e) => e.triggerMetric === threshold.metric);
      if (event) triggeredEvents.push(event);
    }
  }

  // Limit to max 2 events per day
  const selected = triggeredEvents.slice(0, 2);
  const created: WorldEvent[] = [];

  for (const event of selected) {
    const res = await query(
      `INSERT INTO world_events (date, event_type, trigger_data, effect_data, narrative)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [today, event.id, JSON.stringify(metrics), JSON.stringify(event.effects), event.narrative]
    );
    created.push(mapWorldEventRow(res.rows[0]));
  }

  // Invalidate cache
  await redis.del(REDIS_EVENTS_KEY);

  return created;
}

export async function getActiveWorldEvents(): Promise<WorldEvent[]> {
  const today = todayDateString();

  // Check cache
  const cached = await redis.get(REDIS_EVENTS_KEY);
  if (cached) {
    const parsed = JSON.parse(cached) as { date: string; events: WorldEvent[] };
    if (parsed.date === today) return parsed.events;
  }

  const res = await query(
    "SELECT * FROM world_events WHERE date = $1 ORDER BY created_at",
    [today]
  );

  const events = res.rows.map(mapWorldEventRow);

  // Cache for 1 hour
  await redis.set(
    REDIS_EVENTS_KEY,
    JSON.stringify({ date: today, events }),
    "EX",
    3600
  );

  return events;
}

export async function getWorldEventEffects(): Promise<Record<string, number>> {
  const events = await getActiveWorldEvents();
  const combined: Record<string, number> = {};

  for (const event of events) {
    if (event.effectData) {
      for (const [key, value] of Object.entries(event.effectData)) {
        combined[key] = (combined[key] ?? 1) * value;
      }
    }
  }

  return combined;
}

function mapWorldEventRow(row: Record<string, unknown>): WorldEvent {
  return {
    id: row.id as number,
    date: (row.date as string).toString().slice(0, 10),
    eventType: row.event_type as string,
    triggerData: row.trigger_data as Record<string, unknown> | null,
    effectData: row.effect_data as Record<string, number> | null,
    narrative: row.narrative as string | null,
  };
}
