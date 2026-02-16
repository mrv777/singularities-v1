import { query, withTransaction, type TxClient } from "../db/pool.js";
import { redis } from "../db/redis.js";
import {
  DAY_PHASE_HOURS,
  PVP_ENERGY_COST,
  PVP_LEVEL_RANGE,
  PVP_MAX_ATTACKS_RECEIVED,
  PVP_DAILY_DAMAGE_CAP,
  MODULE_MAP,
} from "@singularities/shared";
import { resolveAttack, applyCombatDamage, type CombatOutcome } from "./combat.js";
import { computeEnergy, mapPlayerRow, mapCombatLogRow } from "./player.js";
import { awardXP } from "./progression.js";
import { checkDeath } from "./death.js";

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Check if current hour is within PvP phase.
 */
export function isPvpHours(): boolean {
  const hour = new Date().getUTCHours();
  return hour >= DAY_PHASE_HOURS.pvp.start && hour < DAY_PHASE_HOURS.pvp.end;
}

/**
 * Get available opponents for a player in the arena.
 */
export async function getAvailableOpponents(playerId: string, playerLevel: number) {
  const minLevel = Math.max(1, playerLevel - PVP_LEVEL_RANGE);
  const maxLevel = playerLevel + PVP_LEVEL_RANGE;
  const dateKey = getTodayKey();

  const res = await query(
    `SELECT id, ai_name, level, reputation FROM players
     WHERE in_pvp_arena = true
       AND is_alive = true
       AND is_in_sandbox = false
       AND id != $1
       AND level BETWEEN $2 AND $3
     ORDER BY level ASC
     LIMIT 20`,
    [playerId, minLevel, maxLevel]
  );

  // Filter out players who hit daily attack cap
  const opponents = [];
  for (const row of res.rows) {
    const opponentId = row.id as string;
    const attacksReceived = await redis.get(`pvp_attacks_received:${opponentId}:${dateKey}`);
    if (attacksReceived && parseInt(attacksReceived, 10) >= PVP_MAX_ATTACKS_RECEIVED) continue;

    // Classify playstyle based on loadout
    const playstyle = await classifyPlaystyle(opponentId);

    opponents.push({
      id: opponentId,
      aiName: row.ai_name as string,
      level: row.level as number,
      reputation: row.reputation as number,
      playstyle,
    });
  }

  return opponents;
}

/**
 * Classify a player's playstyle based on their module distribution.
 */
async function classifyPlaystyle(playerId: string): Promise<string> {
  const res = await query(
    `SELECT pm.module_id FROM player_modules pm WHERE pm.player_id = $1`,
    [playerId]
  );

  const counts: Record<string, number> = { primary: 0, secondary: 0, relay: 0, backup: 0 };
  for (const row of res.rows) {
    const def = MODULE_MAP[row.module_id as string];
    if (def) counts[def.category]++;
  }

  const max = Math.max(counts.primary, counts.secondary, counts.relay, counts.backup);
  if (max === 0) return "Balanced";
  if (counts.primary === max) return "Offense";
  if (counts.backup === max) return "Defense";
  if (counts.relay === max) return "Stealth";
  return "Balanced";
}

/**
 * Enter the PvP arena.
 */
export async function enterArena(playerId: string) {
  if (!isPvpHours()) {
    throw { statusCode: 400, message: "PvP arena is only available during PvP hours (12:00-24:00 UTC)" };
  }

  const res = await query("SELECT * FROM players WHERE id = $1", [playerId]);
  if (res.rows.length === 0) throw { statusCode: 404, message: "Player not found" };

  const player = res.rows[0];
  if (player.is_in_sandbox as boolean) {
    throw { statusCode: 400, message: "Cannot enter arena while in sandbox mode" };
  }
  if (!(player.is_alive as boolean)) {
    throw { statusCode: 400, message: "Cannot enter arena while dead" };
  }

  await query("UPDATE players SET in_pvp_arena = true WHERE id = $1", [playerId]);

  const updated = await query("SELECT * FROM players WHERE id = $1", [playerId]);
  return mapPlayerRow(computeEnergy(updated.rows[0]));
}

/**
 * Execute a PvP attack.
 */
export async function executeAttack(attackerId: string, targetId: string) {
  const dateKey = getTodayKey();

  // Validate PvP hours
  if (!isPvpHours()) {
    throw { statusCode: 400, message: "PvP attacks only during PvP hours (12:00-24:00 UTC)" };
  }

  return withTransaction(async (client) => {
    // Lock both players (consistent ordering to prevent deadlocks)
    const ids = [attackerId, targetId].sort();
    const p1 = await client.query("SELECT * FROM players WHERE id = $1 FOR UPDATE", [ids[0]]);
    const p2 = await client.query("SELECT * FROM players WHERE id = $1 FOR UPDATE", [ids[1]]);

    const attackerRow = (ids[0] === attackerId ? p1 : p2).rows[0];
    const defenderRow = (ids[0] === targetId ? p1 : p2).rows[0];

    if (!attackerRow || !defenderRow) {
      throw { statusCode: 404, message: "Player not found" };
    }

    // Validate attacker
    const attacker = computeEnergy(attackerRow);
    if (!(attacker.is_alive as boolean)) throw { statusCode: 400, message: "You are dead" };
    if (attacker.is_in_sandbox as boolean) throw { statusCode: 400, message: "Cannot attack from sandbox" };
    if (!(attacker.in_pvp_arena as boolean)) throw { statusCode: 400, message: "Must enter arena first" };

    // Validate energy
    const energy = attacker.energy as number;
    if (energy < PVP_ENERGY_COST) {
      throw { statusCode: 400, message: `Not enough energy. Need ${PVP_ENERGY_COST}, have ${energy}` };
    }

    // Validate defender
    if (!(defenderRow.is_alive as boolean)) throw { statusCode: 400, message: "Target is dead" };
    if (defenderRow.is_in_sandbox as boolean) throw { statusCode: 400, message: "Target is in sandbox" };
    if (!(defenderRow.in_pvp_arena as boolean)) throw { statusCode: 400, message: "Target is not in arena" };

    // Enforce level range
    const attackerLevel = attacker.level as number;
    const defenderLevel = defenderRow.level as number;
    if (Math.abs(attackerLevel - defenderLevel) > PVP_LEVEL_RANGE) {
      throw { statusCode: 400, message: "Target is outside your level range" };
    }

    // Check daily attack caps for defender
    const attacksReceived = await redis.get(`pvp_attacks_received:${targetId}:${dateKey}`);
    if (attacksReceived && parseInt(attacksReceived, 10) >= PVP_MAX_ATTACKS_RECEIVED) {
      throw { statusCode: 400, message: "Target has received maximum attacks today" };
    }

    // Deduct energy
    const newEnergy = energy - PVP_ENERGY_COST;
    await client.query(
      "UPDATE players SET energy = $2, energy_updated_at = NOW() WHERE id = $1",
      [attackerId, newEnergy]
    );

    // Resolve combat
    const outcome: CombatOutcome = await resolveAttack(attackerId, targetId, client);

    // Apply outcomes
    if (outcome.result === "attacker_win") {
      const { credits, reputation, xp } = outcome.rewards!;

      // Reward attacker
      await client.query(
        "UPDATE players SET credits = credits + $2, reputation = reputation + $3 WHERE id = $1",
        [attackerId, credits, reputation]
      );
      await awardXP(attackerId, xp, client);

      // Damage defender's systems
      if (outcome.damage) {
        await applyCombatDamage(targetId, outcome.damage.systems, client);
      }
    } else {
      // Attacker loses: attacker takes damage
      if (outcome.damage) {
        await applyCombatDamage(attackerId, outcome.damage.systems, client);
      }
    }

    // Store combat log
    const logRes = await client.query(
      `INSERT INTO combat_logs (attacker_id, defender_id, attacker_loadout, defender_loadout, result, damage_dealt, credits_transferred, reputation_change, combat_log, xp_awarded)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        attackerId,
        targetId,
        JSON.stringify({}),
        JSON.stringify({}),
        outcome.result,
        outcome.damage ? JSON.stringify(outcome.damage.systems.reduce((acc, d) => ({ ...acc, [d.systemType]: d.damage }), {})) : null,
        outcome.rewards?.credits ?? 0,
        outcome.rewards?.reputation ?? 0,
        JSON.stringify(outcome.combatLogEntries),
        outcome.rewards?.xp ?? 0,
      ]
    );

    // Increment daily attack counter for defender
    const redisKey = `pvp_attacks_received:${targetId}:${dateKey}`;
    await redis.incr(redisKey);
    await redis.expire(redisKey, 86400); // 24h TTL

    // Track daily damage for defender
    if (outcome.result === "attacker_win" && outcome.damage) {
      const totalDamage = outcome.damage.systems.reduce((sum, d) => sum + d.damage, 0);
      const damageKey = `pvp_damage_received:${targetId}:${dateKey}`;
      await redis.incrby(damageKey, totalDamage);
      await redis.expire(damageKey, 86400);
    }

    // Check death for the loser
    const loserId = outcome.result === "attacker_win" ? targetId : attackerId;
    await checkDeath(loserId, client);

    // Get final attacker state
    const finalRes = await client.query("SELECT * FROM players WHERE id = $1", [attackerId]);
    const finalPlayer = computeEnergy(finalRes.rows[0]);

    return {
      result: outcome.result,
      narrative: outcome.narrative,
      rewards: outcome.rewards,
      damage: outcome.damage,
      player: mapPlayerRow({ ...finalRes.rows[0], energy: finalPlayer.energy }),
      combatLog: mapCombatLogRow(logRes.rows[0]),
    };
  });
}

/**
 * Get recent combat logs for a player (as attacker or defender).
 */
export async function getRecentCombatLogs(playerId: string, limit = 20) {
  const res = await query(
    `SELECT * FROM combat_logs
     WHERE attacker_id = $1 OR defender_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [playerId, limit]
  );

  return res.rows.map(mapCombatLogRow);
}
