import { query, withTransaction } from "../db/pool.js";
import { redis } from "../db/redis.js";
import {
  CATCH_UP_BASE,
  SEASON_DURATION_DAYS,
  SEASON_STIPEND,
} from "@singularities/shared";
import type { Season, SeasonLeaderboardEntry } from "@singularities/shared";

const REDIS_SEASON_KEY = "current_season";

export interface SeasonCatchUpBonuses {
  xpMultiplier: number;
  resourceMultiplier: number;
}

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

export async function endSeason(adminEnded = false): Promise<void> {
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
      "UPDATE seasons SET is_active = false, admin_ended = $2 WHERE id = $1",
      [season.id, adminEnded]
    );

    // Apply season reset + stipend to all season players.
    await client.query(
      `UPDATE players
       SET credits = $2,
           reputation = 0,
           processing_power = processing_power + $3,
           in_pvp_arena = false,
           season_id = NULL
       WHERE season_id = $1`,
      [season.id, SEASON_STIPEND.credits, SEASON_STIPEND.processingPower]
    );
  });

  // Invalidate cache
  await redis.del(REDIS_SEASON_KEY);
}

export async function createSeason(name?: string): Promise<Season> {
  // Determine name from count of existing seasons
  if (!name) {
    const countRes = await query("SELECT COUNT(*) as cnt FROM seasons");
    const count = parseInt(countRes.rows[0].cnt as string, 10) || 0;
    name = `Season ${count + 1}`;
  }

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000);

  const season = await withTransaction(async (client) => {
    const res = await client.query(
      `INSERT INTO seasons (name, started_at, ends_at, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING *`,
      [name, startedAt, endsAt]
    );

    const s = mapSeasonRow(res.rows[0]);

    // Assign all alive players with no season to this new season
    await client.query(
      `UPDATE players SET season_id = $1, reputation = 0
       WHERE season_id IS NULL AND is_alive = true`,
      [s.id]
    );

    return s;
  });

  // Cache the new season
  await redis.set(REDIS_SEASON_KEY, JSON.stringify(season), "EX", 3600);

  return season;
}

export async function getLastEndedSeason(): Promise<{ adminEnded: boolean } | null> {
  const res = await query(
    `SELECT admin_ended FROM seasons
     WHERE is_active = false
     ORDER BY ends_at DESC LIMIT 1`
  );
  if (res.rows.length === 0) return null;
  return { adminEnded: res.rows[0].admin_ended as boolean };
}

export async function getSeasonCatchUpMultiplier(playerId: string): Promise<number> {
  const bonuses = await getSeasonCatchUpBonuses(playerId);
  return bonuses.xpMultiplier;
}

export async function getSeasonCatchUpBonuses(playerId: string): Promise<SeasonCatchUpBonuses> {
  const season = await getCurrentSeason();
  if (!season) {
    return { xpMultiplier: 1, resourceMultiplier: 1 };
  }

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
  if (playerRes.rows.length === 0) {
    return { xpMultiplier: 1, resourceMultiplier: 1 };
  }

  const playerLevel = playerRes.rows[0].level as number;
  const createdAt = new Date(playerRes.rows[0].created_at as string);

  // Level-based catch-up
  const levelsBehind = Math.max(0, medianLevel - playerLevel);
  const levelBoost = Math.min(
    levelsBehind * CATCH_UP_BASE.xpMultiplierPerLevelBehind,
    CATCH_UP_BASE.maxXpMultiplier
  );

  // Late-join boost scales with season progress (day 45 ~= 1.5x, day 75 ~= 2x).
  const seasonStart = new Date(season.startedAt).getTime();
  const seasonEnd = new Date(season.endsAt).getTime();
  const now = Date.now();
  const seasonDuration = Math.max(1, seasonEnd - seasonStart);
  const seasonProgress = Math.max(0, Math.min(1, (now - seasonStart) / seasonDuration));
  const joinedThisSeasonLate = createdAt.getTime() >= seasonStart;
  const joinBoost = joinedThisSeasonLate
    ? seasonProgress * CATCH_UP_BASE.lateJoinMaxXpBoost
    : 0;

  const xpMultiplier = 1 + levelBoost + joinBoost;
  const resourceMultiplier = 1 + (levelBoost + joinBoost) * CATCH_UP_BASE.resourceBoostFactor;

  return {
    xpMultiplier,
    resourceMultiplier,
  };
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
