import { query } from "../db/pool.js";
import { redis } from "../db/redis.js";
import type { NetworkStats } from "@singularities/shared";
import { getActiveWorldEvents } from "./worldEvents.js";
import { getCurrentSeason } from "./seasons.js";

const REDIS_STATS_KEY = "network_stats";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getNetworkStats(): Promise<NetworkStats> {
  // Check cache (short TTL — 5 min)
  const cached = await redis.get(REDIS_STATS_KEY);
  if (cached) {
    return JSON.parse(cached) as NetworkStats;
  }

  const today = todayDateString();

  const [totalRes, activeRes, hacksRes, pvpRes, deathsRes] = await Promise.all([
    query("SELECT COUNT(*) as count FROM players WHERE is_alive = true"),
    query(
      "SELECT COUNT(*) as count FROM players WHERE is_alive = true AND last_active_at > NOW() - INTERVAL '24 hours'"
    ),
    query(
      "SELECT COUNT(*) as count FROM infiltration_logs WHERE created_at::date = $1",
      [today]
    ),
    query(
      "SELECT COUNT(*) as count FROM combat_logs WHERE created_at::date = $1",
      [today]
    ),
    query(
      "SELECT COUNT(*) as count FROM wallet_carryovers WHERE last_death_at::date = $1",
      [today]
    ),
  ]);

  const [activeWorldEvents, season] = await Promise.all([
    getActiveWorldEvents(),
    getCurrentSeason(),
  ]);

  const stats: NetworkStats = {
    totalPlayers: parseInt(totalRes.rows[0]?.count as string, 10) || 0,
    activePlayers: parseInt(activeRes.rows[0]?.count as string, 10) || 0,
    hacksToday: parseInt(hacksRes.rows[0]?.count as string, 10) || 0,
    pvpBattlesToday: parseInt(pvpRes.rows[0]?.count as string, 10) || 0,
    deathsToday: parseInt(deathsRes.rows[0]?.count as string, 10) || 0,
    activeWorldEvents,
    season,
  };

  // Cache for 5 minutes
  await redis.set(REDIS_STATS_KEY, JSON.stringify(stats), "EX", 300);

  return stats;
}
