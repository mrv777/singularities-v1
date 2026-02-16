import { query, withTransaction } from "../../db/pool.js";
import { acquireLock, releaseLock } from "../lock.js";
import { getActiveModifierEffects } from "../../services/modifiers.js";
import { computeSystemHealth } from "../../services/maintenance.js";
import { checkDeath } from "../../services/death.js";
import {
  SYSTEM_ADJACENCY,
  CASCADE_THRESHOLD,
  CASCADE_DAMAGE_PER_TICK,
  SYSTEM_STATUS_THRESHOLDS,
  type ModifierEffect,
} from "@singularities/shared";
import type { SystemType } from "@singularities/shared";

const LOCK_KEY = "worker:cascade_tick";
const LOCK_TTL = 120_000; // 2 min

function getStatusForHealth(health: number): string {
  if (health <= SYSTEM_STATUS_THRESHOLDS.CORRUPTED.max) return "CORRUPTED";
  if (health <= SYSTEM_STATUS_THRESHOLDS.CRITICAL.max) return "CRITICAL";
  if (health <= SYSTEM_STATUS_THRESHOLDS.DEGRADED.max) return "DEGRADED";
  return "OPTIMAL";
}

export async function runCascadeTick(): Promise<void> {
  const token = await acquireLock(LOCK_KEY, LOCK_TTL);
  if (!token) return;

  try {
    const effects = await getActiveModifierEffects();

    // Find all players that have CRITICAL systems (potential cascade sources)
    const playersResult = await query(
      `SELECT DISTINCT player_id FROM player_systems WHERE status IN ('CRITICAL', 'CORRUPTED')`
    );

    for (const { player_id: playerId } of playersResult.rows) {
      await processCascadeForPlayer(playerId as string, effects);
      // Check if cascade caused enough corruption for death
      await checkDeath(playerId as string);
    }
  } finally {
    await releaseLock(LOCK_KEY, token);
  }
}

async function processCascadeForPlayer(playerId: string, effects: ModifierEffect): Promise<void> {
  await withTransaction(async (client) => {
    // Load all systems for this player with lock
    const result = await client.query(
      "SELECT * FROM player_systems WHERE player_id = $1 FOR UPDATE",
      [playerId]
    );

    const systems = result.rows.map((row) => computeSystemHealth(row, effects));

    // First, materialize the degraded health values
    for (const sys of systems) {
      await client.query(
        "UPDATE player_systems SET health = $1, status = $2, updated_at = NOW() WHERE player_id = $3 AND system_type = $4",
        [sys.health, sys.status, playerId, sys.system_type]
      );
    }

    // Now apply cascade damage from CRITICAL systems
    const criticalSystems = systems.filter(
      (s) => (s.health as number) > 0 && (s.health as number) < CASCADE_THRESHOLD
    );

    for (const critical of criticalSystems) {
      const adjacent = SYSTEM_ADJACENCY[critical.system_type as SystemType] ?? [];
      for (const adjType of adjacent) {
        const adjSystem = systems.find((s) => s.system_type === adjType);
        if (!adjSystem) continue;
        const currentHealth = adjSystem.health as number;
        if (currentHealth <= 0) continue; // Already corrupted

        const newHealth = Math.max(0, currentHealth - CASCADE_DAMAGE_PER_TICK);
        const newStatus = getStatusForHealth(newHealth);

        await client.query(
          "UPDATE player_systems SET health = $1, status = $2, updated_at = NOW() WHERE player_id = $3 AND system_type = $4",
          [newHealth, newStatus, playerId, adjType]
        );
      }
    }
  });
}
