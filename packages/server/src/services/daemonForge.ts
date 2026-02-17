import { redis } from "../db/redis.js";
import { query, withTransaction } from "../db/pool.js";
import { computeEnergy, mapPlayerRow } from "./player.js";
import {
  DAEMON_DEFINITIONS,
  DAEMON_MISSION_DURATIONS,
  DAEMON_TYPES,
  getDaemonSlots,
  SABOTEUR_BUFF,
  PROGRESSION_BALANCE,
  type DaemonType,
  type DaemonMissionDuration,
} from "@singularities/shared";

export class DaemonForgeError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "DaemonForgeError";
  }
}

function mapDaemonRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    daemonType: row.daemon_type as DaemonType,
    durabilityRemaining: row.durability_remaining as number,
    missionDuration: row.mission_duration as number | null,
    deployedAt: row.deployed_at ? (row.deployed_at as Date).toISOString() : null,
    completesAt: row.completes_at ? (row.completes_at as Date).toISOString() : null,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function getDaemonForgeStatus(playerId: string) {
  const playerRes = await query("SELECT level FROM players WHERE id = $1", [playerId]);
  if (playerRes.rows.length === 0) throw new DaemonForgeError("Player not found", 404);
  const level = playerRes.rows[0].level as number;

  if (level < PROGRESSION_BALANCE.unlockLevels.daemon_forge) {
    throw new DaemonForgeError(
      `Daemon Forge unlocks at level ${PROGRESSION_BALANCE.unlockLevels.daemon_forge}`,
      400
    );
  }

  const daemonsRes = await query(
    "SELECT * FROM player_daemons WHERE player_id = $1 ORDER BY created_at",
    [playerId]
  );

  const maxSlots = getDaemonSlots(level);
  return {
    daemons: daemonsRes.rows.map(mapDaemonRow),
    availableSlots: Math.max(0, maxSlots - daemonsRes.rows.length),
    maxSlots,
  };
}

export async function craftDaemon(playerId: string, daemonType: string) {
  if (!DAEMON_TYPES.includes(daemonType as DaemonType)) {
    throw new DaemonForgeError("Invalid daemon type", 400);
  }
  const def = DAEMON_DEFINITIONS[daemonType as DaemonType];

  return withTransaction(async (client) => {
    const pRes = await client.query("SELECT * FROM players WHERE id = $1 FOR UPDATE", [playerId]);
    if (pRes.rows.length === 0) throw new DaemonForgeError("Player not found", 404);
    const playerRow = computeEnergy(pRes.rows[0]);
    const level = playerRow.level as number;

    if (level < PROGRESSION_BALANCE.unlockLevels.daemon_forge) {
      throw new DaemonForgeError(
        `Daemon Forge unlocks at level ${PROGRESSION_BALANCE.unlockLevels.daemon_forge}`,
        400
      );
    }

    // Check slot capacity
    const daemonsRes = await client.query(
      "SELECT COUNT(*) as cnt FROM player_daemons WHERE player_id = $1",
      [playerId]
    );
    const count = parseInt(daemonsRes.rows[0].cnt as string, 10);
    const maxSlots = getDaemonSlots(level);
    if (count >= maxSlots) {
      throw new DaemonForgeError(`All ${maxSlots} daemon slots are full. Scrap a daemon first.`, 400);
    }

    // Check resources
    const credits = playerRow.credits as number;
    const data = playerRow.data as number;
    const pp = playerRow.processing_power as number;
    if (credits < def.craftCost.credits || data < def.craftCost.data || pp < def.craftCost.processingPower) {
      throw new DaemonForgeError("Not enough resources to craft this daemon", 400);
    }

    // Deduct resources
    await client.query(
      `UPDATE players
       SET credits = credits - $2,
           data = data - $3,
           processing_power = processing_power - $4
       WHERE id = $1`,
      [playerId, def.craftCost.credits, def.craftCost.data, def.craftCost.processingPower]
    );

    // Create daemon
    const insertRes = await client.query(
      `INSERT INTO player_daemons (player_id, daemon_type, durability_remaining)
       VALUES ($1, $2, $3) RETURNING *`,
      [playerId, daemonType, def.baseDurability]
    );

    const finalRes = await client.query("SELECT * FROM players WHERE id = $1", [playerId]);
    return {
      daemon: mapDaemonRow(insertRes.rows[0]),
      player: mapPlayerRow(computeEnergy(finalRes.rows[0])),
    };
  });
}

export async function deployDaemon(playerId: string, daemonId: string, duration: number) {
  if (!DAEMON_MISSION_DURATIONS.includes(duration as DaemonMissionDuration)) {
    throw new DaemonForgeError("Invalid mission duration", 400);
  }

  return withTransaction(async (client) => {
    const dRes = await client.query(
      "SELECT * FROM player_daemons WHERE id = $1 AND player_id = $2 FOR UPDATE",
      [daemonId, playerId]
    );
    if (dRes.rows.length === 0) throw new DaemonForgeError("Daemon not found", 404);

    const daemon = dRes.rows[0];
    if (daemon.deployed_at) {
      throw new DaemonForgeError("Daemon is already deployed", 400);
    }
    if ((daemon.durability_remaining as number) <= 0) {
      throw new DaemonForgeError("Daemon has no durability remaining", 400);
    }

    const now = new Date();
    const completesAt = new Date(now.getTime() + duration * 60 * 1000);

    await client.query(
      `UPDATE player_daemons
       SET mission_duration = $2, deployed_at = $3, completes_at = $4, durability_remaining = durability_remaining - 1
       WHERE id = $1`,
      [daemonId, duration, now, completesAt]
    );

    const updatedRes = await client.query("SELECT * FROM player_daemons WHERE id = $1", [daemonId]);
    return { daemon: mapDaemonRow(updatedRes.rows[0]) };
  });
}

export async function collectDaemon(playerId: string, daemonId: string) {
  return withTransaction(async (client) => {
    const dRes = await client.query(
      "SELECT * FROM player_daemons WHERE id = $1 AND player_id = $2 FOR UPDATE",
      [daemonId, playerId]
    );
    if (dRes.rows.length === 0) throw new DaemonForgeError("Daemon not found", 404);

    const daemon = dRes.rows[0];
    if (!daemon.deployed_at || !daemon.completes_at) {
      throw new DaemonForgeError("Daemon is not deployed", 400);
    }

    const completesAt = new Date(daemon.completes_at as string);
    if (completesAt.getTime() > Date.now()) {
      throw new DaemonForgeError("Mission not yet complete", 400);
    }

    const daemonType = daemon.daemon_type as DaemonType;
    const def = DAEMON_DEFINITIONS[daemonType];
    const duration = daemon.mission_duration as number;
    const rewards = def.missionRewards[duration] ?? { credits: 10, data: 5 };

    // Award rewards
    await client.query(
      `UPDATE players
       SET credits = credits + $2,
           data = data + $3
       WHERE id = $1`,
      [playerId, rewards.credits, rewards.data]
    );

    // Apply SABOTEUR buff
    let buffApplied = undefined;
    if (daemonType === "SABOTEUR") {
      const key = `buff:${playerId}:hackPower`;
      await redis.incrby(key, SABOTEUR_BUFF.hackPower);
      await redis.expire(key, SABOTEUR_BUFF.durationSeconds);
      buffApplied = {
        stat: "hackPower",
        amount: SABOTEUR_BUFF.hackPower,
        durationSeconds: SABOTEUR_BUFF.durationSeconds,
      };
    }

    // Reset deployment state or destroy if no durability
    const durability = daemon.durability_remaining as number;
    let updatedDaemon = null;
    if (durability <= 0) {
      await client.query("DELETE FROM player_daemons WHERE id = $1", [daemonId]);
    } else {
      await client.query(
        `UPDATE player_daemons SET deployed_at = NULL, completes_at = NULL, mission_duration = NULL WHERE id = $1`,
        [daemonId]
      );
      const uRes = await client.query("SELECT * FROM player_daemons WHERE id = $1", [daemonId]);
      updatedDaemon = mapDaemonRow(uRes.rows[0]);
    }

    const finalRes = await client.query("SELECT * FROM players WHERE id = $1", [playerId]);
    return {
      daemon: updatedDaemon,
      rewards,
      buffApplied,
      player: mapPlayerRow(computeEnergy(finalRes.rows[0])),
    };
  });
}

export async function scrapDaemon(playerId: string, daemonId: string) {
  const result = await query(
    "DELETE FROM player_daemons WHERE id = $1 AND player_id = $2 RETURNING id",
    [daemonId, playerId]
  );
  if (result.rows.length === 0) {
    throw new DaemonForgeError("Daemon not found", 404);
  }
  return { success: true };
}

/**
 * Check if player has an active SENTINEL deployment.
 * Called from computeSystemHealth to reduce degradation.
 */
export async function hasActiveSentinel(playerId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM player_daemons
     WHERE player_id = $1
       AND daemon_type = 'SENTINEL'
       AND deployed_at IS NOT NULL
       AND completes_at > NOW()
     LIMIT 1`,
    [playerId]
  );
  return result.rows.length > 0;
}
