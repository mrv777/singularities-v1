import { query, type TxClient } from "../db/pool.js";
import { getCurrentSeason } from "./seasons.js";
import {
  BOT_MAX_ATTACKS_PER_DAY,
  BOT_MAX_BACKFILL_PER_REQUEST,
  BOT_MAX_PLAYER_LEVEL,
  BOT_TARGET_OPPONENT_FLOOR,
  buildBotPool,
} from "./arenaBots.js";

const ARENA_BOTS_ENABLED_KEY = "arena_bots_enabled";
const SETTINGS_CACHE_TTL_MS = 15_000;
let arenaBotsEnabledCache: { value: boolean; expiresAt: number } | null = null;

export interface AdminRequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function makeDateSeries(days: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export async function getArenaBotsEnabled(forceRefresh = false): Promise<boolean> {
  if (!forceRefresh && arenaBotsEnabledCache && arenaBotsEnabledCache.expiresAt > Date.now()) {
    return arenaBotsEnabledCache.value;
  }

  let enabled = true;
  try {
    const res = await query(
      "SELECT value_json FROM admin_settings WHERE key = $1 LIMIT 1",
      [ARENA_BOTS_ENABLED_KEY]
    );
    if (res.rows.length > 0) {
      enabled = coerceBoolean(res.rows[0].value_json, true);
    }
  } catch {
    enabled = true;
  }

  arenaBotsEnabledCache = {
    value: enabled,
    expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS,
  };
  return enabled;
}

export async function recordAdminAction(
  adminPlayerId: string,
  action: string,
  details: Record<string, unknown> | null,
  meta: AdminRequestMeta,
  client?: TxClient
): Promise<void> {
  const sql = `INSERT INTO admin_audit_logs (admin_player_id, action, details, ip_address, user_agent)
               VALUES ($1, $2, $3, $4, $5)`;
  const params = [adminPlayerId, action, details ? JSON.stringify(details) : null, meta.ipAddress, meta.userAgent];

  if (client) {
    await client.query(sql, params);
    return;
  }
  await query(sql, params);
}

export async function setArenaBotsEnabled(
  enabled: boolean,
  adminPlayerId: string,
  note: string | null,
  meta: AdminRequestMeta
): Promise<void> {
  await query(
    `INSERT INTO admin_settings (key, value_json, updated_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value_json = EXCLUDED.value_json, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [ARENA_BOTS_ENABLED_KEY, JSON.stringify(enabled), adminPlayerId]
  );

  arenaBotsEnabledCache = null;
  await recordAdminAction(
    adminPlayerId,
    "arena_bots_enabled_updated",
    { enabled, note },
    meta
  );
}

export async function getAdminOverview() {
  const today = todayDateString();
  const sevenDayDates = makeDateSeries(7);
  const sevenDayStart = sevenDayDates[0];

  const [
    totalRes,
    activeRes,
    inArenaRes,
    hacksRes,
    pvpHumanRes,
    pvpBotRes,
    deathsRes,
    seriesRes,
    actionsRes,
    season,
    arenaBotsEnabled,
  ] = await Promise.all([
    query("SELECT COUNT(*) as count FROM players WHERE is_alive = true"),
    query(
      "SELECT COUNT(*) as count FROM players WHERE is_alive = true AND last_active_at > NOW() - INTERVAL '24 hours'"
    ),
    query("SELECT COUNT(*) as count FROM players WHERE in_pvp_arena = true AND is_alive = true"),
    query("SELECT COUNT(*) as count FROM infiltration_logs WHERE created_at::date = $1", [today]),
    query(
      "SELECT COUNT(*) as count FROM combat_logs WHERE created_at::date = $1 AND COALESCE(is_bot_match, false) = false",
      [today]
    ),
    query(
      "SELECT COUNT(*) as count FROM combat_logs WHERE created_at::date = $1 AND COALESCE(is_bot_match, false) = true",
      [today]
    ),
    query("SELECT COUNT(*) as count FROM wallet_carryovers WHERE last_death_at::date = $1", [today]),
    query(
      `SELECT created_at::date::text as date,
              COUNT(*) FILTER (WHERE COALESCE(is_bot_match, false) = false) as human_matches,
              COUNT(*) FILTER (WHERE COALESCE(is_bot_match, false) = true) as bot_matches
       FROM combat_logs
       WHERE created_at::date >= $1::date
       GROUP BY created_at::date
       ORDER BY created_at::date ASC`,
      [sevenDayStart]
    ),
    query(
      `SELECT id, admin_player_id, action, details, ip_address, user_agent, created_at
       FROM admin_audit_logs
       ORDER BY created_at DESC
       LIMIT 30`
    ),
    getCurrentSeason(),
    getArenaBotsEnabled(),
  ]);

  const pvpHumanToday = parseInt(pvpHumanRes.rows[0]?.count as string, 10) || 0;
  const pvpBotToday = parseInt(pvpBotRes.rows[0]?.count as string, 10) || 0;
  const pvpTotalToday = pvpHumanToday + pvpBotToday;
  const botMatchShareToday = pvpTotalToday > 0 ? pvpBotToday / pvpTotalToday : 0;

  const byDate = new Map(
    seriesRes.rows.map((row) => [
      row.date as string,
      {
        humanMatches: parseInt(row.human_matches as string, 10) || 0,
        botMatches: parseInt(row.bot_matches as string, 10) || 0,
      },
    ])
  );
  const pvpDailySeries = sevenDayDates.map((date) => {
    const item = byDate.get(date);
    return {
      date,
      humanMatches: item?.humanMatches ?? 0,
      botMatches: item?.botMatches ?? 0,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    season: season
      ? {
          id: season.id,
          name: season.name,
          endsAt: season.endsAt,
          daysRemaining: Math.max(
            0,
            Math.ceil((new Date(season.endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          ),
        }
      : null,
    metrics: {
      alivePlayers: parseInt(totalRes.rows[0]?.count as string, 10) || 0,
      activePlayers24h: parseInt(activeRes.rows[0]?.count as string, 10) || 0,
      inArenaNow: parseInt(inArenaRes.rows[0]?.count as string, 10) || 0,
      hacksToday: parseInt(hacksRes.rows[0]?.count as string, 10) || 0,
      pvpHumanToday,
      pvpBotToday,
      deathsToday: parseInt(deathsRes.rows[0]?.count as string, 10) || 0,
      botMatchShareToday,
    },
    pvpDailySeries,
    arenaBots: {
      enabled: arenaBotsEnabled,
      targetOpponentFloor: BOT_TARGET_OPPONENT_FLOOR,
      maxBackfillPerRequest: BOT_MAX_BACKFILL_PER_REQUEST,
      maxAttacksPerDay: BOT_MAX_ATTACKS_PER_DAY,
      maxPlayerLevel: BOT_MAX_PLAYER_LEVEL,
    },
    recentAdminActions: actionsRes.rows.map((row) => ({
      id: row.id as string,
      adminPlayerId: row.admin_player_id as string,
      action: row.action as string,
      details: (row.details as Record<string, unknown>) ?? null,
      ipAddress: (row.ip_address as string) ?? null,
      userAgent: (row.user_agent as string) ?? null,
      createdAt: (row.created_at as Date).toISOString(),
    })),
  };
}

export function getArenaBotPreview(requestedLevel: number, actorPlayerId: string) {
  const level = Math.max(1, Math.min(100, Math.floor(requestedLevel)));
  const dateKey = todayDateString();
  const bots = buildBotPool(actorPlayerId, level, dateKey, 8).map((bot) => ({
    id: bot.id,
    aiName: bot.aiName,
    level: bot.level,
    reputation: bot.reputation,
    playstyle: bot.playstyle,
    alignment: bot.alignment,
    isBot: true as const,
    botTier: bot.tier,
    disclosureLabel: "SIMULATED OPPONENT",
  }));

  return { requestedLevel: level, bots };
}
