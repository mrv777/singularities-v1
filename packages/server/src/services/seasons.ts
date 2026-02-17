import { query, withTransaction } from "../db/pool.js";
import { redis } from "../db/redis.js";
import {
  CATCH_UP_BASE,
  SEASON_STIPEND,
} from "@singularities/shared";
import type { Season, SeasonLeaderboardEntry } from "@singularities/shared";

const REDIS_SEASON_KEY = "current_season";

export async function getCurrentSeason(): Promise<Season | null> {
  // Check cache
  const cached = await redis.get(REDIS_SEASON_KEY);
  if (cached) {
    const parsed = JSON.parse(cached) as Season;
    // Check still valid (hasn't ended)
    if (new Date(parsed.endsAt) > new Date()) return parsed;
  }

  const res = await query(
    "SELECT * FROM seasons WHERE is_active = true ORDER BY started_at DESC LIMIT 1"
  );
  if (res.rows.length === 0) return null;

  const season = mapSeasonRow(res.rows[0]);
  await redis.set(REDIS_SEASON_KEY, JSON.stringify(season), "EX", 3600);
  return season;
}

export async function getSeasonLeaderboard(limit = 20): Promise<SeasonLeaderboardEntry[]> {
  const season = await getCurrentSeason();
  if (!season) return [];

  const res = await query(
    `SELECT id, ai_name, level, reputation
     FROM players
     WHERE season_id = $1 AND is_alive = true
     ORDER BY reputation DESC
     LIMIT $2`,
    [season.id, limit]
  );

  return res.rows.map((r, i) => ({
    rank: i + 1,
    playerId: r.id as string,
    aiName: r.ai_name as string,
    level: r.level as number,
    reputation: r.reputation as number,
  }));
}

export async function getPlayerRank(playerId: string): Promise<number | null> {
  const season = await getCurrentSeason();
  if (!season) return null;

  const res = await query(
    `SELECT COUNT(*) + 1 as rank FROM players
     WHERE season_id = $1 AND is_alive = true AND reputation > (
       SELECT reputation FROM players WHERE id = $2
     )`,
    [season.id, playerId]
  );

  return parseInt(res.rows[0]?.rank as string, 10) || null;
}

export async function endSeason(): Promise<void> {
  const season = await getCurrentSeason();
  if (!season) return;

  await withTransaction(async (client) => {
    // Get top player
    const topRes = await client.query(
      `SELECT id, reputation FROM players
       WHERE season_id = $1 AND is_alive = true
       ORDER BY reputation DESC LIMIT 1`,
      [season.id]
    );

    if (topRes.rows.length > 0) {
      await client.query(
        `INSERT INTO season_winners (season_id, player_id, reputation, trophy_metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          season.id,
          topRes.rows[0].id,
          topRes.rows[0].reputation,
          JSON.stringify({ seasonName: season.name }),
        ]
      );
    }

    // Deactivate season
    await client.query(
      "UPDATE seasons SET is_active = false WHERE id = $1",
      [season.id]
    );

    // Award stipend to all season players
    await client.query(
      `UPDATE players SET credits = credits + $2 WHERE season_id = $1`,
      [season.id, SEASON_STIPEND.credits]
    );
  });

  // Invalidate cache
  await redis.del(REDIS_SEASON_KEY);
}

export async function getSeasonCatchUpMultiplier(playerId: string): Promise<number> {
  const season = await getCurrentSeason();
  if (!season) return 1;

  // Get median level for active season players
  const medianRes = await query(
    `SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY level) as median_level
     FROM players WHERE season_id = $1 AND is_alive = true`,
    [season.id]
  );
  const medianLevel = parseFloat(medianRes.rows[0]?.median_level as string) || 5;

  // Get player level and join date
  const playerRes = await query(
    "SELECT level, created_at FROM players WHERE id = $1",
    [playerId]
  );
  if (playerRes.rows.length === 0) return 1;

  const playerLevel = playerRes.rows[0].level as number;
  const createdAt = new Date(playerRes.rows[0].created_at as string);

  // Level-based catch-up
  const levelsBehind = Math.max(0, medianLevel - playerLevel);
  const levelBoost = Math.min(
    levelsBehind * CATCH_UP_BASE.xpMultiplierPerLevelBehind,
    CATCH_UP_BASE.maxXpMultiplier
  );

  // Join-date boost (for new players)
  const daysSinceJoin = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const joinBoost = daysSinceJoin <= CATCH_UP_BASE.joinBoostDays
    ? CATCH_UP_BASE.joinBoostMultiplier
    : 0;

  return 1 + levelBoost + joinBoost;
}

export function applySeasonXPBoost(baseXP: number, multiplier: number): number {
  return Math.floor(baseXP * multiplier);
}

function mapSeasonRow(row: Record<string, unknown>): Season {
  return {
    id: row.id as number,
    name: row.name as string,
    startedAt: (row.started_at as Date).toISOString(),
    endsAt: (row.ends_at as Date).toISOString(),
    isActive: row.is_active as boolean,
    metaModules: row.meta_modules as Record<string, unknown> | null,
    catchUpConfig: row.catch_up_config as Record<string, unknown> | null,
  };
}
