import { query, withTransaction, type TxClient } from "../db/pool.js";
import { redis } from "../db/redis.js";
import { computeEnergy, mapPlayerRow, mapSystemRow } from "./player.js";
import { getActiveModifierEffects } from "./modifiers.js";
import {
  DEGRADATION_RATE_PER_HOUR,
  SYSTEM_STATUS_THRESHOLDS,
  ENERGY_COSTS,
  REPAIR_CREDIT_COST,
  REPAIR_HEALTH_AMOUNT,
  REPAIR_COOLDOWN_SECONDS,
  type ModifierEffect,
} from "@singularities/shared";

function getStatusForHealth(health: number): string {
  if (health <= SYSTEM_STATUS_THRESHOLDS.CORRUPTED.max) return "CORRUPTED";
  if (health <= SYSTEM_STATUS_THRESHOLDS.CRITICAL.max) return "CRITICAL";
  if (health <= SYSTEM_STATUS_THRESHOLDS.DEGRADED.max) return "DEGRADED";
  return "OPTIMAL";
}

/**
 * Calculate-on-read degradation for a system row.
 * Returns the row with computed health and derived status.
 */
export function computeSystemHealth(
  row: Record<string, unknown>,
  modifierEffects: ModifierEffect
): Record<string, unknown> {
  const storedHealth = row.health as number;
  const updatedAt = new Date(row.updated_at as string).getTime();
  const now = Date.now();
  const hoursElapsed = Math.max(0, (now - updatedAt) / (1000 * 3600));
  const degradation = hoursElapsed * DEGRADATION_RATE_PER_HOUR * (modifierEffects.degradationRateMultiplier ?? 1);
  const currentHealth = Math.max(0, Math.round((storedHealth - degradation) * 100) / 100);
  const healthClamped = Math.round(Math.max(0, Math.min(100, currentHealth)));
  const status = getStatusForHealth(healthClamped);
  return { ...row, health: healthClamped, status };
}

/**
 * Full scan: return all 6 systems with computed (degraded) health.
 */
export async function fullScan(playerId: string) {
  const effects = await getActiveModifierEffects();
  const result = await query(
    "SELECT * FROM player_systems WHERE player_id = $1 ORDER BY system_type",
    [playerId]
  );
  return result.rows.map((row) => mapSystemRow(computeSystemHealth(row, effects)));
}

/**
 * Repair a system. Transaction-based with energy+credit deduction and cooldown.
 */
export async function repairSystem(playerId: string, systemType: string) {
  const effects = await getActiveModifierEffects();
  const cooldownKey = `repair_cd:${playerId}:${systemType}`;

  return withTransaction(async (client: TxClient) => {
    // Lock player row first (serializes concurrent repair requests)
    const playerResult = await client.query(
      "SELECT * FROM players WHERE id = $1 FOR UPDATE",
      [playerId]
    );

    // Check cooldown after acquiring row lock (now safe from races)
    const cooldownActive = await redis.get(cooldownKey);
    if (cooldownActive) {
      const ttl = await redis.ttl(cooldownKey);
      throw new RepairError(`Repair on cooldown. ${ttl}s remaining.`, 429);
    }
    if (playerResult.rows.length === 0) {
      throw new RepairError("Player not found", 404);
    }

    const playerRow = computeEnergy(playerResult.rows[0]);
    const energy = playerRow.energy as number;
    const credits = playerRow.credits as number;

    const energyCost = Math.round(ENERGY_COSTS.repair * (effects.energyCostMultiplier ?? 1));
    const creditCost = Math.round(REPAIR_CREDIT_COST * (effects.repairCostMultiplier ?? 1));

    if (energy < energyCost) {
      throw new RepairError(`Not enough energy. Need ${energyCost}, have ${energy}.`, 400);
    }
    if (credits < creditCost) {
      throw new RepairError(`Not enough credits. Need ${creditCost}, have ${credits}.`, 400);
    }

    // Lock system
    const sysResult = await client.query(
      "SELECT * FROM player_systems WHERE player_id = $1 AND system_type = $2 FOR UPDATE",
      [playerId, systemType]
    );
    if (sysResult.rows.length === 0) {
      throw new RepairError("System not found", 404);
    }

    const sysRow = computeSystemHealth(sysResult.rows[0], effects);
    const currentHealth = sysRow.health as number;

    if (currentHealth >= 100) {
      throw new RepairError("System already at full health", 400);
    }

    const newHealth = Math.min(100, currentHealth + REPAIR_HEALTH_AMOUNT);
    const newStatus = getStatusForHealth(newHealth);

    // Deduct resources
    await client.query(
      `UPDATE players SET energy = $2, energy_updated_at = NOW(), credits = credits - $3 WHERE id = $1`,
      [playerId, energy - energyCost, creditCost]
    );

    // Update system health + reset updated_at (so degradation restarts from now)
    await client.query(
      `UPDATE player_systems SET health = $2, status = $3, updated_at = NOW() WHERE player_id = $1 AND system_type = $4`,
      [playerId, newHealth, newStatus, systemType]
    );

    // Set cooldown
    await redis.set(cooldownKey, "1", "EX", REPAIR_COOLDOWN_SECONDS);

    // Return updated system and player
    const updatedPlayer = await client.query(
      "SELECT * FROM players WHERE id = $1",
      [playerId]
    );
    const updatedSystem = await client.query(
      "SELECT * FROM player_systems WHERE player_id = $1 AND system_type = $2",
      [playerId, systemType]
    );

    return {
      system: mapSystemRow(updatedSystem.rows[0]),
      player: mapPlayerRow(computeEnergy(updatedPlayer.rows[0])),
    };
  });
}

export class RepairError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "RepairError";
  }
}
