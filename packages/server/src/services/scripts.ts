import { query, withTransaction } from "../db/pool.js";
import { redis } from "../db/redis.js";
import { computeEnergy } from "./player.js";
import { getActiveModifierEffects } from "./modifiers.js";
import { generateTargets } from "./scanner.js";
import {
  SCRIPT_TRIGGER_MAP,
  SCRIPT_ACTION_MAP,
  SCRIPT_EFFICIENCY,
  SCRIPT_ENERGY_COST_MULTIPLIER,
  MAX_ACTIVE_SCRIPTS,
  MAX_SCRIPTS,
  ENERGY_COSTS,
  SCAN_TTL_SECONDS,
  type ModifierEffect,
} from "@singularities/shared";

export async function getScripts(playerId: string) {
  const result = await query(
    "SELECT * FROM player_scripts WHERE player_id = $1 ORDER BY created_at DESC",
    [playerId]
  );
  return result.rows.map(mapScriptRow);
}

export async function createScript(playerId: string, triggerCondition: string, action: string) {
  if (!SCRIPT_TRIGGER_MAP[triggerCondition]) {
    throw new ScriptError(
      `Invalid trigger condition. Valid: ${Object.keys(SCRIPT_TRIGGER_MAP).join(", ")}`,
      400
    );
  }
  if (!SCRIPT_ACTION_MAP[action]) {
    throw new ScriptError(
      `Invalid action. Valid: ${Object.keys(SCRIPT_ACTION_MAP).join(", ")}`,
      400
    );
  }

  // Check total script count and active script count
  const [countResult, activeCountResult] = await Promise.all([
    query("SELECT COUNT(*) as count FROM player_scripts WHERE player_id = $1", [playerId]),
    query("SELECT COUNT(*) as count FROM player_scripts WHERE player_id = $1 AND is_active = true", [playerId]),
  ]);
  if (Number(countResult.rows[0].count) >= MAX_SCRIPTS) {
    throw new ScriptError(`Maximum ${MAX_SCRIPTS} scripts allowed`, 400);
  }

  const startActive = Number(activeCountResult.rows[0].count) < MAX_ACTIVE_SCRIPTS;

  const result = await query(
    `INSERT INTO player_scripts (player_id, trigger_condition, action, is_active)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [playerId, triggerCondition, action, startActive]
  );

  return mapScriptRow(result.rows[0]);
}

export async function activateScript(playerId: string, scriptId: string) {
  // Check script belongs to player
  const scriptResult = await query(
    "SELECT * FROM player_scripts WHERE id = $1 AND player_id = $2",
    [scriptId, playerId]
  );
  if (scriptResult.rows.length === 0) {
    throw new ScriptError("Script not found", 404);
  }

  const currentlyActive = scriptResult.rows[0].is_active as boolean;

  if (!currentlyActive) {
    // Check active script count
    const activeCount = await query(
      "SELECT COUNT(*) as count FROM player_scripts WHERE player_id = $1 AND is_active = true",
      [playerId]
    );
    if (Number(activeCount.rows[0].count) >= MAX_ACTIVE_SCRIPTS) {
      throw new ScriptError(`Maximum ${MAX_ACTIVE_SCRIPTS} active scripts allowed`, 400);
    }
  }

  // Toggle activation
  const result = await query(
    "UPDATE player_scripts SET is_active = NOT is_active WHERE id = $1 RETURNING *",
    [scriptId]
  );

  return mapScriptRow(result.rows[0]);
}

export async function deleteScript(playerId: string, scriptId: string) {
  const result = await query(
    "DELETE FROM player_scripts WHERE id = $1 AND player_id = $2 RETURNING id",
    [scriptId, playerId]
  );
  if (result.rows.length === 0) {
    throw new ScriptError("Script not found", 404);
  }
}

/**
 * Called by the background worker every 15 minutes.
 * Evaluates all active scripts and executes matching actions.
 */
export async function evaluateAndExecuteScripts(): Promise<void> {
  const effects = await getActiveModifierEffects();

  // Get all active scripts with their player data (including last_active_at)
  const result = await query(
    `SELECT ps.*, p.energy, p.energy_max, p.energy_updated_at, p.level,
            p.credits, p.heat_level, p.last_active_at, p.id as pid
     FROM player_scripts ps
     JOIN players p ON ps.player_id = p.id
     WHERE ps.is_active = true AND p.is_alive = true`
  );

  for (const row of result.rows) {
    try {
      const playerRow = computeEnergy({
        energy: row.energy,
        energy_max: row.energy_max,
        energy_updated_at: row.energy_updated_at,
        level: row.level,
      });
      const currentEnergy = playerRow.energy as number;
      const energyMax = row.energy_max as number;
      const level = row.level as number;
      const credits = row.credits as number;
      const heatLevel = row.heat_level as number;
      const playerId = row.player_id as string;
      const triggerCondition = row.trigger_condition as string;
      const action = row.action as string;
      const scriptId = row.id as string;

      // For system_critical trigger, check if player has any critical systems
      let hasCriticalSystem = false;
      if (triggerCondition === "system_critical") {
        const sysResult = await query(
          `SELECT 1 FROM player_systems WHERE player_id = $1 AND health > 0 AND health < 30 LIMIT 1`,
          [playerId]
        );
        hasCriticalSystem = sysResult.rows.length > 0;
      }

      // Evaluate trigger
      const triggered = evaluateTrigger(triggerCondition, {
        currentEnergy,
        energyMax,
        credits,
        heatLevel,
        lastActiveAt: row.last_active_at as string,
        hasCriticalSystem,
      });

      if (!triggered) continue;

      // Execute action
      await executeAction(playerId, scriptId, action, level, effects);
    } catch (err) {
      // Log but don't stop other scripts
      console.error(`[scripts] Error executing script ${row.id}:`, err);
    }
  }
}

interface TriggerContext {
  currentEnergy: number;
  energyMax: number;
  credits: number;
  heatLevel: number;
  lastActiveAt: string;
  hasCriticalSystem: boolean;
}

function evaluateTrigger(trigger: string, ctx: TriggerContext): boolean {
  switch (trigger) {
    case "energy_full":
      return ctx.currentEnergy >= ctx.energyMax;
    case "energy_low":
      return ctx.currentEnergy < ctx.energyMax * 0.2;
    case "system_critical":
      return ctx.hasCriticalSystem;
    case "heat_high":
      return ctx.heatLevel >= 2;
    case "credits_above_500":
      return ctx.credits > 500;
    case "idle_1h": {
      const lastActive = new Date(ctx.lastActiveAt).getTime();
      return Date.now() - lastActive > 3600_000;
    }
    default:
      return false;
  }
}

async function executeAction(
  playerId: string,
  scriptId: string,
  action: string,
  playerLevel: number,
  effects: ModifierEffect
): Promise<void> {
  const energyCostMultiplier = effects.energyCostMultiplier ?? 1;

  switch (action) {
    case "auto_scan": {
      const energyCost = Math.round(ENERGY_COSTS.scan * SCRIPT_ENERGY_COST_MULTIPLIER * energyCostMultiplier);
      await withTransaction(async (client) => {
        const player = await client.query(
          "SELECT * FROM players WHERE id = $1 FOR UPDATE",
          [playerId]
        );
        const row = computeEnergy(player.rows[0]);
        if ((row.energy as number) < energyCost) return;

        // Generate and store scan targets (same as manual scan)
        const targets = generateTargets(playerLevel);
        const redisKey = `scan:${playerId}`;
        const expiresAt = new Date(Date.now() + SCAN_TTL_SECONDS * 1000).toISOString();
        await redis.set(redisKey, JSON.stringify(targets), "EX", SCAN_TTL_SECONDS);

        await client.query(
          "UPDATE players SET energy = $2, energy_updated_at = NOW() WHERE id = $1",
          [playerId, (row.energy as number) - energyCost]
        );
        await logScriptExecution(client, playerId, scriptId, "auto_scan", action, true, 0, 0, energyCost);
      });
      break;
    }
    case "auto_repair_worst": {
      const energyCost = Math.round(ENERGY_COSTS.repair * SCRIPT_ENERGY_COST_MULTIPLIER * energyCostMultiplier);
      await withTransaction(async (client) => {
        const player = await client.query(
          "SELECT * FROM players WHERE id = $1 FOR UPDATE",
          [playerId]
        );
        const row = computeEnergy(player.rows[0]);
        if ((row.energy as number) < energyCost) return;

        // Find worst system
        const sysResult = await client.query(
          "SELECT * FROM player_systems WHERE player_id = $1 ORDER BY health ASC LIMIT 1",
          [playerId]
        );
        if (sysResult.rows.length === 0) return;
        const sys = sysResult.rows[0];
        if ((sys.health as number) >= 100) return;

        const repairAmount = Math.round(20 * SCRIPT_EFFICIENCY);
        const newHealth = Math.min(100, (sys.health as number) + repairAmount);

        await client.query(
          "UPDATE players SET energy = $2, energy_updated_at = NOW() WHERE id = $1",
          [playerId, (row.energy as number) - energyCost]
        );
        await client.query(
          "UPDATE player_systems SET health = $2, updated_at = NOW() WHERE id = $3",
          [playerId, newHealth, sys.id]
        );
        await logScriptExecution(client, playerId, scriptId, "auto_repair_worst", action, true, 0, 0, energyCost);
      });
      break;
    }
    case "reduce_heat": {
      await withTransaction(async (client) => {
        await client.query(
          "UPDATE players SET heat_level = GREATEST(0, heat_level - 1) WHERE id = $1 AND heat_level > 0",
          [playerId]
        );
        await logScriptExecution(client, playerId, scriptId, "reduce_heat", action, true, 0, 0, 0);
      });
      break;
    }
  }
}

async function logScriptExecution(
  client: any,
  playerId: string,
  scriptId: string,
  trigger: string,
  action: string,
  success: boolean,
  creditsEarned: number,
  dataEarned: number,
  energySpent: number
): Promise<void> {
  const q = client?.query?.bind(client) ?? query;
  await q(
    `INSERT INTO script_logs (player_id, script_id, trigger_condition, action, success, credits_earned, data_earned, energy_spent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [playerId, scriptId, trigger, action, success, creditsEarned, dataEarned, energySpent]
  );
}

function mapScriptRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    playerId: row.player_id as string,
    triggerCondition: row.trigger_condition as string,
    action: row.action as string,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
  };
}

export class ScriptError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "ScriptError";
  }
}
