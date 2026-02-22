import { query, withTransaction, type TxClient } from "../db/pool.js";
import { getCurrentSeason } from "./seasons.js";
import { computeSystemHealth, getPlayerModifierEffects } from "./maintenance.js";
import { computeEnergy } from "./player.js";
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

// ---------------------------------------------------------------------------
// Player Lookup
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listRecentPlayers() {
  const res = await query(
    `SELECT id, wallet_address, ai_name, level, is_alive, is_in_sandbox, last_active_at
     FROM players
     ORDER BY last_active_at DESC
     LIMIT 20`
  );
  return { players: res.rows.map(mapPlayerSearchRow) };
}

export async function searchPlayers(queryStr: string) {
  const q = queryStr.trim();
  if (!q) return { players: [] };

  if (UUID_RE.test(q)) {
    const res = await query(
      `SELECT id, wallet_address, ai_name, level, is_alive, is_in_sandbox, last_active_at
       FROM players WHERE id = $1 LIMIT 1`,
      [q]
    );
    return {
      players: res.rows.map(mapPlayerSearchRow),
    };
  }

  const pattern = `%${q}%`;
  const res = await query(
    `SELECT id, wallet_address, ai_name, level, is_alive, is_in_sandbox, last_active_at
     FROM players
     WHERE wallet_address ILIKE $1 OR ai_name ILIKE $1
     ORDER BY last_active_at DESC
     LIMIT 20`,
    [pattern]
  );
  return { players: res.rows.map(mapPlayerSearchRow) };
}

function mapPlayerSearchRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    walletAddress: row.wallet_address as string,
    aiName: row.ai_name as string,
    level: row.level as number,
    isAlive: row.is_alive as boolean,
    isInSandbox: row.is_in_sandbox as boolean,
    lastActiveAt: (row.last_active_at as Date).toISOString(),
  };
}

export async function getPlayerDetail(playerId: string) {
  const [playerRes, systemsRes, modulesRes, loadoutsRes, traitsRes, combatRes, infiltRes, iceRes, modifierEffects] =
    await Promise.all([
      query("SELECT * FROM players WHERE id = $1", [playerId]),
      query(
        "SELECT * FROM player_systems WHERE player_id = $1",
        [playerId]
      ),
      query(
        "SELECT module_id, level, mutation FROM player_modules WHERE player_id = $1",
        [playerId]
      ),
      query(
        "SELECT loadout_type, slot, module_id FROM player_loadouts WHERE player_id = $1 ORDER BY loadout_type, slot",
        [playerId]
      ),
      query("SELECT trait_id FROM player_traits WHERE player_id = $1", [playerId]),
      query(
        `SELECT id, attacker_id, defender_id, result, credits_transferred, xp_awarded, is_bot_match, created_at
         FROM combat_logs WHERE attacker_id = $1 OR defender_id = $1
         ORDER BY created_at DESC LIMIT 10`,
        [playerId]
      ),
      query(
        `SELECT id, target_type, security_level, success, credits_earned, game_type, created_at
         FROM infiltration_logs WHERE player_id = $1
         ORDER BY created_at DESC LIMIT 10`,
        [playerId]
      ),
      query(
        `SELECT id, layers_attempted, layers_cleared, extracted, credits_earned, created_at
         FROM ice_breaker_logs WHERE player_id = $1
         ORDER BY created_at DESC LIMIT 10`,
        [playerId]
      ),
      getPlayerModifierEffects(playerId),
    ]);

  if (playerRes.rows.length === 0) return null;
  const p = computeEnergy(playerRes.rows[0]);

  return {
    player: {
      id: p.id as string,
      walletAddress: p.wallet_address as string,
      aiName: p.ai_name as string,
      level: p.level as number,
      xp: p.xp as number,
      credits: p.credits as number,
      energy: p.energy as number,
      energyMax: p.energy_max as number,
      processingPower: p.processing_power as number,
      data: p.data as number,
      reputation: p.reputation as number,
      alignment: p.alignment as number,
      heatLevel: p.heat_level as number,
      isAlive: p.is_alive as boolean,
      isInSandbox: p.is_in_sandbox as boolean,
      inPvpArena: p.in_pvp_arena as boolean,
      lastActiveAt: (p.last_active_at as Date).toISOString(),
      createdAt: (p.created_at as Date).toISOString(),
    },
    systems: systemsRes.rows.map((r) => {
      const computed = computeSystemHealth(r, modifierEffects);
      return {
        systemType: computed.system_type as string,
        health: computed.health as number,
        status: computed.status as string,
      };
    }),
    modules: modulesRes.rows.map((r) => ({
      moduleId: r.module_id as string,
      level: r.level as number,
      mutation: (r.mutation as string) ?? null,
    })),
    loadouts: loadoutsRes.rows.map((r) => ({
      loadoutType: r.loadout_type as string,
      slot: r.slot as number,
      moduleId: (r.module_id as string) ?? null,
    })),
    traits: traitsRes.rows.map((r) => r.trait_id as string),
    recentActivity: {
      combatLogs: combatRes.rows.map((r) => ({
        id: r.id as string,
        role: (r.attacker_id === playerId ? "attacker" : "defender") as "attacker" | "defender",
        opponentId:
          r.attacker_id === playerId
            ? ((r.defender_id as string) ?? null)
            : ((r.attacker_id as string) ?? null),
        result: r.result as string,
        creditsTransferred: r.credits_transferred as number,
        xpAwarded: r.xp_awarded as number,
        isBotMatch: r.is_bot_match as boolean,
        createdAt: (r.created_at as Date).toISOString(),
      })),
      infiltrationLogs: infiltRes.rows.map((r) => ({
        id: r.id as string,
        targetType: r.target_type as string,
        securityLevel: r.security_level as number,
        success: r.success as boolean,
        creditsEarned: r.credits_earned as number,
        gameType: (r.game_type as string) ?? null,
        createdAt: (r.created_at as Date).toISOString(),
      })),
      iceBreakerLogs: iceRes.rows.map((r) => ({
        id: r.id as string,
        layersAttempted: r.layers_attempted as number,
        layersCleared: r.layers_cleared as number,
        extracted: r.extracted as boolean,
        creditsEarned: r.credits_earned as number,
        createdAt: (r.created_at as Date).toISOString(),
      })),
    },
  };
}

export async function grantResources(
  playerId: string,
  grants: { credits?: number; data?: number; processingPower?: number; xp?: number },
  adminPlayerId: string,
  reason: string,
  meta: AdminRequestMeta
) {
  const credits = grants.credits ?? 0;
  const data = grants.data ?? 0;
  const pp = grants.processingPower ?? 0;
  const xp = grants.xp ?? 0;

  if (credits === 0 && data === 0 && pp === 0 && xp === 0) {
    throw new Error("At least one resource amount must be non-zero");
  }

  return withTransaction(async (client) => {
    const res = await client.query(
      `UPDATE players
       SET credits = credits + $2,
           data = data + $3,
           processing_power = processing_power + $4,
           xp = xp + $5
       WHERE id = $1
       RETURNING credits, data, processing_power, xp`,
      [playerId, credits, data, pp, xp]
    );

    if (res.rows.length === 0) throw new Error("Player not found");

    await recordAdminAction(
      adminPlayerId,
      "grant_resources",
      { playerId, credits, data, processingPower: pp, xp, reason },
      meta,
      client
    );

    const row = res.rows[0];
    return {
      success: true as const,
      newTotals: {
        credits: row.credits as number,
        data: row.data as number,
        processingPower: row.processing_power as number,
        xp: row.xp as number,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Economy Overview
// ---------------------------------------------------------------------------

export async function getEconomyOverview() {
  const today = todayDateString();

  const [
    circulationRes,
    inflowInfilToday,
    inflowPvpToday,
    inflowIceToday,
    inflowInfilWeek,
    inflowPvpWeek,
    inflowIceWeek,
    levelDistRes,
    modulePopRes,
  ] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (WHERE is_alive) as alive_players,
         COALESCE(SUM(credits), 0) as total_credits,
         COALESCE(SUM(data), 0) as total_data,
         COALESCE(SUM(processing_power), 0) as total_pp,
         COALESCE(SUM(reputation), 0) as total_reputation,
         COALESCE(AVG(credits) FILTER (WHERE is_alive), 0) as avg_credits,
         COALESCE(AVG(level) FILTER (WHERE is_alive), 0) as avg_level
       FROM players`
    ),
    query(
      "SELECT COALESCE(SUM(credits_earned), 0) as credits FROM infiltration_logs WHERE created_at::date = $1",
      [today]
    ),
    query(
      "SELECT COALESCE(SUM(credits_transferred), 0) as credits FROM combat_logs WHERE created_at::date = $1",
      [today]
    ),
    query(
      "SELECT COALESCE(SUM(credits_earned), 0) as credits FROM ice_breaker_logs WHERE created_at::date = $1",
      [today]
    ),
    query(
      "SELECT COALESCE(SUM(credits_earned), 0) as credits FROM infiltration_logs WHERE created_at > NOW() - INTERVAL '7 days'"
    ),
    query(
      "SELECT COALESCE(SUM(credits_transferred), 0) as credits FROM combat_logs WHERE created_at > NOW() - INTERVAL '7 days'"
    ),
    query(
      "SELECT COALESCE(SUM(credits_earned), 0) as credits FROM ice_breaker_logs WHERE created_at > NOW() - INTERVAL '7 days'"
    ),
    query(
      `SELECT level, COUNT(*)::int as count
       FROM players WHERE is_alive = true
       GROUP BY level ORDER BY level`
    ),
    query(
      `SELECT module_id,
         COUNT(*)::int as owners,
         AVG(level)::numeric(3,1) as avg_level,
         COUNT(*) FILTER (WHERE mutation IS NOT NULL)::int as mutated_count
       FROM player_modules
       GROUP BY module_id
       ORDER BY owners DESC
       LIMIT 20`
    ),
  ]);

  const c = circulationRes.rows[0];
  const toNum = (v: unknown) => Number(v) || 0;

  const inflowTodayInfil = toNum(inflowInfilToday.rows[0]?.credits);
  const inflowTodayPvp = toNum(inflowPvpToday.rows[0]?.credits);
  const inflowTodayIce = toNum(inflowIceToday.rows[0]?.credits);

  const inflowWeekInfil = toNum(inflowInfilWeek.rows[0]?.credits);
  const inflowWeekPvp = toNum(inflowPvpWeek.rows[0]?.credits);
  const inflowWeekIce = toNum(inflowIceWeek.rows[0]?.credits);

  return {
    generatedAt: new Date().toISOString(),
    circulation: {
      totalCredits: toNum(c.total_credits),
      totalData: toNum(c.total_data),
      totalProcessingPower: toNum(c.total_pp),
      totalReputation: toNum(c.total_reputation),
      avgCreditsPerPlayer: Math.round(toNum(c.avg_credits)),
      avgLevelPerPlayer: Math.round(toNum(c.avg_level) * 10) / 10,
      alivePlayers: toNum(c.alive_players),
    },
    flowToday: {
      creditsFromInfiltration: inflowTodayInfil,
      creditsFromPvp: inflowTodayPvp,
      creditsFromIceBreaker: inflowTodayIce,
      totalCreditsEarned: inflowTodayInfil + inflowTodayPvp + inflowTodayIce,
    },
    flowWeek: {
      creditsFromInfiltration: inflowWeekInfil,
      creditsFromPvp: inflowWeekPvp,
      creditsFromIceBreaker: inflowWeekIce,
      totalCreditsEarned: inflowWeekInfil + inflowWeekPvp + inflowWeekIce,
    },
    levelDistribution: levelDistRes.rows.map((r) => ({
      level: r.level as number,
      count: r.count as number,
    })),
    modulePopularity: modulePopRes.rows.map((r) => ({
      moduleId: r.module_id as string,
      owners: r.owners as number,
      avgLevel: Number(r.avg_level),
      mutatedCount: r.mutated_count as number,
    })),
  };
}
