import { query, withTransaction, type TxClient } from "../db/pool.js";
import { redis } from "../db/redis.js";
import { computeEnergy, mapPlayerRow, mapSystemRow } from "./player.js";
import { getActiveModifierEffects } from "./modifiers.js";
import { hasActiveSentinel } from "./daemonForge.js";
import {
  DEGRADATION_RATE_PER_HOUR,
  SYSTEM_STATUS_THRESHOLDS,
  ENERGY_COSTS,
  getRepairCreditCostForHealth,
  REPAIR_HEALTH_AMOUNT,
  REPAIR_COOLDOWN_SECONDS,
  SENTINEL_DEGRADATION_MULTIPLIER,
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
 * Returns modifier effects augmented with Sentinel daemon status for a player.
 */
export async function getPlayerModifierEffects(playerId: string): Promise<ModifierEffect> {
  const [effects, sentinelActive] = await Promise.all([
    getActiveModifierEffects(),
    hasActiveSentinel(playerId),
  ]);
  if (!sentinelActive) return effects;
  return {
    ...effects,
    degradationRateMultiplier: (effects.degradationRateMultiplier ?? 1) * SENTINEL_DEGRADATION_MULTIPLIER,
  };
}

/**
 * Full scan: return all 6 systems with computed (degraded) health.
 */
export async function fullScan(playerId: string) {
  const effects = await getPlayerModifierEffects(playerId);
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
  const effects = await getPlayerModifierEffects(playerId);
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
    if (energy < energyCost) {
      throw new RepairError(`Not enough energy. Need ${energyCost}, have ${energy}.`, 400);
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
    const playerLevel = playerRow.level as number;
    const creditCost = Math.round(
      getRepairCreditCostForHealth(currentHealth, playerLevel) * (effects.repairCostMultiplier ?? 1)
    );
    if (credits < creditCost) {
      throw new RepairError(`Not enough credits. Need ${creditCost}, have ${credits}.`, 400);
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

type RepairAllSkipReason =
  | "full_health"
  | "cooldown"
  | "insufficient_energy"
  | "insufficient_credits"
  | "budget_exhausted";

interface RepairAllSkipped {
  systemType: string;
  reason: RepairAllSkipReason;
}

interface PlannedRepair {
  rowId: string;
  systemType: string;
  newHealth: number;
  newStatus: string;
  creditCost: number;
}

interface RepairCandidate {
  rowId: string;
  systemType: string;
  currentHealth: number;
}

/**
 * One-click maintenance helper.
 * Economy parity: each repaired system pays the same costs as manual repair,
 * with no discounts and no bypass of per-system cooldown.
 */
export async function repairAllSystems(playerId: string) {
  const effects = await getPlayerModifierEffects(playerId);
  const energyCostPerRepair = Math.round(
    ENERGY_COSTS.repair * (effects.energyCostMultiplier ?? 1)
  );

  return withTransaction(async (client: TxClient) => {
    const playerResult = await client.query(
      "SELECT * FROM players WHERE id = $1 FOR UPDATE",
      [playerId]
    );
    if (playerResult.rows.length === 0) {
      throw new RepairError("Player not found", 404);
    }

    const playerRow = computeEnergy(playerResult.rows[0]);
    const systemsResult = await client.query(
      "SELECT * FROM player_systems WHERE player_id = $1 FOR UPDATE",
      [playerId]
    );

    const computedSystems = systemsResult.rows
      .map((row) => computeSystemHealth(row, effects))
      .sort((a, b) => (a.health as number) - (b.health as number));

    const damagedCount = computedSystems.filter((s) => (s.health as number) < 100).length;
    if (damagedCount === 0) {
      throw new RepairError("All systems are already at full health", 400);
    }

    const planned: PlannedRepair[] = [];
    const skipReasonBySystem = new Map<string, RepairAllSkipReason>();
    let remainingEnergy = playerRow.energy as number;
    let remainingCredits = playerRow.credits as number;
    let budgetExhausted = false;
    const repairCandidates: RepairCandidate[] = [];
    const playerLevel = playerRow.level as number;

    for (const system of computedSystems) {
      const systemType = system.system_type as string;
      const currentHealth = system.health as number;
      const rowId = system.id as string;

      if (currentHealth >= 100) {
        skipReasonBySystem.set(systemType, "full_health");
        continue;
      }

      repairCandidates.push({ rowId, systemType, currentHealth });

      if (budgetExhausted) {
        skipReasonBySystem.set(systemType, "budget_exhausted");
        continue;
      }

      const cooldownKey = `repair_cd:${playerId}:${systemType}`;
      const cooldownActive = await redis.get(cooldownKey);
      if (cooldownActive) {
        skipReasonBySystem.set(systemType, "cooldown");
        continue;
      }

      if (remainingEnergy < energyCostPerRepair) {
        skipReasonBySystem.set(systemType, "insufficient_energy");
        budgetExhausted = true;
        continue;
      }

      const creditCost = Math.round(
        getRepairCreditCostForHealth(currentHealth, playerLevel)
        * (effects.repairCostMultiplier ?? 1)
      );
      if (remainingCredits < creditCost) {
        skipReasonBySystem.set(systemType, "insufficient_credits");
        budgetExhausted = true;
        continue;
      }

      const newHealth = Math.min(100, currentHealth + REPAIR_HEALTH_AMOUNT);
      const newStatus = getStatusForHealth(newHealth);

      planned.push({
        rowId,
        systemType,
        newHealth,
        newStatus,
        creditCost,
      });
      skipReasonBySystem.delete(systemType);

      remainingEnergy -= energyCostPerRepair;
      remainingCredits -= creditCost;
    }

    // Preserve worst-health-first, but if that would repair none, repair the
    // worst damaged system that is actually affordable.
    if (planned.length === 0) {
      for (const candidate of repairCandidates) {
        const cooldownKey = `repair_cd:${playerId}:${candidate.systemType}`;
        const cooldownActive = await redis.get(cooldownKey);
        if (cooldownActive) continue;

        const creditCost = Math.round(
          getRepairCreditCostForHealth(candidate.currentHealth, playerLevel)
          * (effects.repairCostMultiplier ?? 1)
        );
        if (remainingEnergy < energyCostPerRepair) break;
        if (remainingCredits < creditCost) continue;

        const newHealth = Math.min(100, candidate.currentHealth + REPAIR_HEALTH_AMOUNT);
        const newStatus = getStatusForHealth(newHealth);
        planned.push({
          rowId: candidate.rowId,
          systemType: candidate.systemType,
          newHealth,
          newStatus,
          creditCost,
        });
        skipReasonBySystem.delete(candidate.systemType);
        remainingEnergy -= energyCostPerRepair;
        remainingCredits -= creditCost;
        break;
      }
    }

    const skipped: RepairAllSkipped[] = computedSystems
      .map((system) => {
        const systemType = system.system_type as string;
        const reason = skipReasonBySystem.get(systemType);
        return reason ? { systemType, reason } : null;
      })
      .filter((item): item is RepairAllSkipped => item !== null);

    if (planned.length === 0) {
      if (skipped.some((s) => s.reason === "cooldown")) {
        throw new RepairError("All damaged systems are on repair cooldown", 429);
      }
      if (skipped.some((s) => s.reason === "insufficient_energy")) {
        throw new RepairError(
          `Not enough energy. Need at least ${energyCostPerRepair}.`,
          400
        );
      }
      throw new RepairError("Not enough credits to repair damaged systems", 400);
    }

    const energySpent = planned.length * energyCostPerRepair;
    const creditsSpent = planned.reduce((sum, item) => sum + item.creditCost, 0);

    await client.query(
      `UPDATE players
       SET energy = $2,
           energy_updated_at = NOW(),
           credits = $3
       WHERE id = $1`,
      [playerId, remainingEnergy, remainingCredits]
    );

    for (const item of planned) {
      await client.query(
        `UPDATE player_systems
         SET health = $2, status = $3, updated_at = NOW()
         WHERE id = $1`,
        [item.rowId, item.newHealth, item.newStatus]
      );
    }

    for (const item of planned) {
      const cooldownKey = `repair_cd:${playerId}:${item.systemType}`;
      await redis.set(cooldownKey, "1", "EX", REPAIR_COOLDOWN_SECONDS);
    }

    const [updatedPlayerResult, updatedSystemsResult] = await Promise.all([
      client.query("SELECT * FROM players WHERE id = $1", [playerId]),
      client.query("SELECT * FROM player_systems WHERE player_id = $1", [playerId]),
    ]);

    const systemByType = new Map(
      updatedSystemsResult.rows.map((row) => [row.system_type as string, mapSystemRow(row)])
    );

    return {
      repaired: planned.map((item) => ({
        system: systemByType.get(item.systemType)!,
        energyCost: energyCostPerRepair,
        creditCost: item.creditCost,
      })),
      skipped,
      totals: {
        repairedCount: planned.length,
        skippedCount: skipped.length,
        damagedCount,
        energySpent,
        creditsSpent,
      },
      player: mapPlayerRow(computeEnergy(updatedPlayerResult.rows[0])),
    };
  });
}

/**
 * Lightweight summary for NetworkMap AI Core coloring.
 */
export async function getSystemHealthSummary(playerId: string) {
  const effects = await getPlayerModifierEffects(playerId);
  const result = await query(
    "SELECT * FROM player_systems WHERE player_id = $1",
    [playerId]
  );

  let criticalCount = 0;
  let degradedCount = 0;
  let worstStatus = "OPTIMAL";
  const statusRank: Record<string, number> = { OPTIMAL: 0, DEGRADED: 1, CRITICAL: 2, CORRUPTED: 3 };

  for (const row of result.rows) {
    const computed = computeSystemHealth(row, effects);
    const status = computed.status as string;
    if (status === "CRITICAL" || status === "CORRUPTED") criticalCount++;
    else if (status === "DEGRADED") degradedCount++;
    if ((statusRank[status] ?? 0) > (statusRank[worstStatus] ?? 0)) {
      worstStatus = status;
    }
  }

  return { worstStatus, criticalCount, degradedCount };
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
