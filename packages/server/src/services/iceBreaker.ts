import { redis } from "../db/redis.js";
import { query, withTransaction } from "../db/pool.js";
import { computeEnergy, mapPlayerRow, mapSystemRow } from "./player.js";
import { resolveLoadoutStats } from "./stats.js";
import { computeSystemHealth } from "./maintenance.js";
import { awardXP } from "./progression.js";
import { getActiveModifierEffects } from "./modifiers.js";
import { acquireLock, releaseLock } from "../worker/lock.js";
import {
  ICE_BREAKER_BALANCE,
  ICE_LAYER_TYPES,
  ICE_LAYER_STAT,
  SYSTEM_STATUS_THRESHOLDS,
  SYSTEM_TYPES,
  PROGRESSION_BALANCE,
  computeLayerPassRate,
  type IceLayerType,
} from "@singularities/shared";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getStatusForHealth(health: number): string {
  if (health <= SYSTEM_STATUS_THRESHOLDS.CORRUPTED.max) return "CORRUPTED";
  if (health <= SYSTEM_STATUS_THRESHOLDS.CRITICAL.max) return "CRITICAL";
  if (health <= SYSTEM_STATUS_THRESHOLDS.DEGRADED.max) return "DEGRADED";
  return "OPTIMAL";
}

const RUN_KEY = (pid: string) => `ice:${pid}:run`;
const DAILY_KEY = (pid: string, date: string) => `ice:${pid}:daily:${date}`;
const COOLDOWN_KEY = (pid: string) => `ice:${pid}:cooldown`;

interface IceRunState {
  layers: Array<{ type: IceLayerType; threshold: number; depth: number }>;
  currentDepth: number;
  accumulatedRewards: { credits: number; data: number; xp: number; processingPower: number };
  completed: boolean;
  failed: boolean;
}

export class IceBreakerError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "IceBreakerError";
  }
}

export async function getIceBreakerStatus(playerId: string) {
  const today = todayDateString();
  const [dailyRaw, cooldownTTL, runRaw] = await Promise.all([
    redis.get(DAILY_KEY(playerId, today)),
    redis.ttl(COOLDOWN_KEY(playerId)),
    redis.get(RUN_KEY(playerId)),
  ]);

  const dailyUsed = dailyRaw ? parseInt(dailyRaw, 10) : 0;
  return {
    dailyAttemptsRemaining: Math.max(0, ICE_BREAKER_BALANCE.dailyLimit - dailyUsed),
    cooldownTTL: cooldownTTL > 0 ? cooldownTTL : 0,
    activeRun: runRaw ? (JSON.parse(runRaw) as IceRunState) : null,
  };
}

export async function initiateBreach(playerId: string) {
  const token = await acquireLock(`ice:${playerId}`, 30_000);
  if (!token) throw new IceBreakerError("Operation in progress, try again", 409);
  try {
    // Check for existing run
    const existingRun = await redis.get(RUN_KEY(playerId));
    if (existingRun) {
      throw new IceBreakerError("An ICE Breaker run is already active", 409);
    }

    // Check cooldown
    const cooldownTTL = await redis.ttl(COOLDOWN_KEY(playerId));
    if (cooldownTTL > 0) {
      throw new IceBreakerError(`ICE Breaker on cooldown. ${cooldownTTL}s remaining.`, 429);
    }

    // Check daily limit
    const today = todayDateString();
    const dailyRaw = await redis.get(DAILY_KEY(playerId, today));
    const dailyUsed = dailyRaw ? parseInt(dailyRaw, 10) : 0;
    if (dailyUsed >= ICE_BREAKER_BALANCE.dailyLimit) {
      throw new IceBreakerError("Daily ICE Breaker limit reached", 400);
    }

    return await withTransaction(async (client) => {
      const pRes = await client.query("SELECT * FROM players WHERE id = $1 FOR UPDATE", [playerId]);
      if (pRes.rows.length === 0) throw new IceBreakerError("Player not found", 404);
      const playerRow = computeEnergy(pRes.rows[0]);
      const level = playerRow.level as number;

      if (level < PROGRESSION_BALANCE.unlockLevels.ice_breaker) {
        throw new IceBreakerError(
          `ICE Breaker unlocks at level ${PROGRESSION_BALANCE.unlockLevels.ice_breaker}`,
          400
        );
      }

      const energy = playerRow.energy as number;
      if (energy < ICE_BREAKER_BALANCE.energyCost) {
        throw new IceBreakerError(
          `Not enough energy. Need ${ICE_BREAKER_BALANCE.energyCost}, have ${energy}.`,
          400
        );
      }

      // Deduct energy
      await client.query(
        `UPDATE players SET energy = $2, energy_updated_at = NOW() WHERE id = $1`,
        [playerId, energy - ICE_BREAKER_BALANCE.energyCost]
      );

      // Generate layers
      const layerCount = ICE_BREAKER_BALANCE.layerCount(level);
      const layers: IceRunState["layers"] = [];
      for (let d = 0; d < layerCount; d++) {
        const type = ICE_LAYER_TYPES[randomInt(0, ICE_LAYER_TYPES.length - 1)];
        layers.push({
          type,
          threshold: ICE_BREAKER_BALANCE.layerThreshold(type, d, level),
          depth: d,
        });
      }

      const run: IceRunState = {
        layers,
        currentDepth: 0,
        accumulatedRewards: { credits: 0, data: 0, xp: 0, processingPower: 0 },
        completed: false,
        failed: false,
      };

      // Store run in Redis (TTL 30 minutes — auto-cleanup if abandoned)
      await redis.set(RUN_KEY(playerId), JSON.stringify(run), "EX", 1800);

      // Increment daily counter
      const newCount = await redis.incr(DAILY_KEY(playerId, today));
      if (newCount === 1) {
        // Expire at midnight UTC
        const now = new Date();
        const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
        const ttl = Math.max(1, Math.floor((midnight.getTime() - now.getTime()) / 1000));
        await redis.expire(DAILY_KEY(playerId, today), ttl);
      }

      const finalRes = await client.query("SELECT * FROM players WHERE id = $1", [playerId]);
      return {
        run,
        player: mapPlayerRow(computeEnergy(finalRes.rows[0])),
      };
    });
  } finally {
    await releaseLock(`ice:${playerId}`, token);
  }
}

export async function resolveLayer(playerId: string) {
  const token = await acquireLock(`ice:${playerId}`, 30_000);
  if (!token) throw new IceBreakerError("Operation in progress, try again", 409);
  try {
    const runRaw = await redis.get(RUN_KEY(playerId));
    if (!runRaw) throw new IceBreakerError("No active ICE Breaker run", 400);

    const run: IceRunState = JSON.parse(runRaw);
    if (run.completed || run.failed) {
      throw new IceBreakerError("Run already finished. Extract or start a new one.", 400);
    }

    const layer = run.layers[run.currentDepth];
    if (!layer) throw new IceBreakerError("No more layers to resolve", 400);

    // Resolve player stats for the relevant stat
    const stats = await resolveLoadoutStats(playerId, "infiltration");
    const statKey = ICE_LAYER_STAT[layer.type];
    const playerStat = Math.round(stats[statKey] * stats.healthMultiplier);

    // Success: sigmoid probability curve clamped to [10%, 92%]
    const passRate = computeLayerPassRate(playerStat, layer.threshold);
    const passed = Math.random() < passRate;

    let rewards = undefined;
    let damage = undefined;

    if (passed) {
      // Layer cleared — add depth rewards
      const depthRewards = ICE_BREAKER_BALANCE.rewards[run.currentDepth] ?? ICE_BREAKER_BALANCE.rewards[4];
      run.accumulatedRewards.credits += depthRewards.credits;
      run.accumulatedRewards.data += depthRewards.data;
      run.accumulatedRewards.xp += depthRewards.xp;
      run.accumulatedRewards.processingPower += depthRewards.processingPower;
      rewards = { ...depthRewards };

      run.currentDepth++;
      if (run.currentDepth >= run.layers.length) {
        run.completed = true;
      }
    } else {
      // Failed — apply partial rewards + system damage
      run.failed = true;

      // Apply fail penalty to accumulated rewards
      run.accumulatedRewards.credits = Math.floor(run.accumulatedRewards.credits * ICE_BREAKER_BALANCE.failRetentionPct);
      run.accumulatedRewards.data = Math.floor(run.accumulatedRewards.data * ICE_BREAKER_BALANCE.failRetentionPct);
      run.accumulatedRewards.xp = Math.floor(run.accumulatedRewards.xp * ICE_BREAKER_BALANCE.failRetentionPct);
      run.accumulatedRewards.processingPower = Math.floor(run.accumulatedRewards.processingPower * ICE_BREAKER_BALANCE.failRetentionPct);

      // Apply system damage
      const effects = await getActiveModifierEffects();
      damage = await withTransaction(async (client) => {
        const sysRes = await client.query(
          "SELECT * FROM player_systems WHERE player_id = $1 FOR UPDATE",
          [playerId]
        );
        const systems = sysRes.rows;
        const affectedCount = randomInt(
          ICE_BREAKER_BALANCE.failDamage.systemsAffected.min,
          Math.min(ICE_BREAKER_BALANCE.failDamage.systemsAffected.max, systems.length)
        );
        const shuffled = systems.sort(() => Math.random() - 0.5);
        const affected = shuffled.slice(0, affectedCount);

        const damageSystems: Array<{ systemType: string; damage: number }> = [];
        for (const sys of affected) {
          const computed = computeSystemHealth(sys, effects);
          const currentHealth = computed.health as number;
          const dmg = randomInt(
            ICE_BREAKER_BALANCE.failDamage.damagePerSystem.min,
            ICE_BREAKER_BALANCE.failDamage.damagePerSystem.max
          );
          const newHealth = Math.max(0, currentHealth - dmg);
          const newStatus = getStatusForHealth(newHealth);
          await client.query(
            `UPDATE player_systems SET health = $2, status = $3, updated_at = NOW() WHERE id = $1`,
            [sys.id, newHealth, newStatus]
          );
          damageSystems.push({ systemType: sys.system_type as string, damage: dmg });
        }
        return { systems: damageSystems };
      });
    }

    // Update run state in Redis
    await redis.set(RUN_KEY(playerId), JSON.stringify(run), "EX", 1800);

    return {
      passed,
      layerType: layer.type,
      depth: layer.depth,
      playerStat,
      threshold: layer.threshold,
      passRate: Math.round(passRate * 100),
      rewards,
      damage,
      run,
    };
  } finally {
    await releaseLock(`ice:${playerId}`, token);
  }
}

export async function extractRewards(playerId: string) {
  const token = await acquireLock(`ice:${playerId}`, 30_000);
  if (!token) throw new IceBreakerError("Operation in progress, try again", 409);
  try {
    const runRaw = await redis.get(RUN_KEY(playerId));
    if (!runRaw) throw new IceBreakerError("No active ICE Breaker run", 400);

    const run: IceRunState = JSON.parse(runRaw);
    if (!run.completed && !run.failed && run.currentDepth === 0) {
      throw new IceBreakerError("Resolve at least one layer before extracting", 400);
    }

    const rewards = run.accumulatedRewards;

    // Apply completion bonus if all layers cleared
    const completionBonus = run.completed;
    if (completionBonus) {
      const m = ICE_BREAKER_BALANCE.completionBonusMultiplier;
      rewards.credits = Math.floor(rewards.credits * m);
      rewards.data = Math.floor(rewards.data * m);
      rewards.xp = Math.floor(rewards.xp * m);
      rewards.processingPower = Math.floor(rewards.processingPower * m);
    }

    const result = await withTransaction(async (client) => {
      const pRes = await client.query("SELECT * FROM players WHERE id = $1 FOR UPDATE", [playerId]);
      if (pRes.rows.length === 0) throw new IceBreakerError("Player not found", 404);

      await client.query(
        `UPDATE players
         SET credits = credits + $2,
             data = data + $3,
             processing_power = processing_power + $4
         WHERE id = $1`,
        [playerId, rewards.credits, rewards.data, rewards.processingPower]
      );

      const xpResult = await awardXP(playerId, rewards.xp, client);

      // Log the run
      await client.query(
        `INSERT INTO ice_breaker_logs (player_id, layers_attempted, layers_cleared, extracted, credits_earned, data_earned, xp_earned, processing_power_earned, system_damage)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          playerId,
          run.currentDepth + (run.failed ? 1 : 0),
          run.currentDepth,
          !run.failed,
          rewards.credits,
          rewards.data,
          rewards.xp,
          rewards.processingPower,
          run.failed ? JSON.stringify({ failed: true }) : null,
        ]
      );

      const finalRes = await client.query("SELECT * FROM players WHERE id = $1", [playerId]);
      return {
        rewards,
        completionBonus,
        player: mapPlayerRow(computeEnergy(finalRes.rows[0])),
        levelUp: xpResult.levelUp,
        newLevel: xpResult.newLevel,
      };
    });

    // Clean up run + set cooldown (inside lock to prevent double-extract)
    await Promise.all([
      redis.del(RUN_KEY(playerId)),
      redis.set(COOLDOWN_KEY(playerId), "1", "EX", ICE_BREAKER_BALANCE.cooldownSeconds),
    ]);

    return result;
  } finally {
    await releaseLock(`ice:${playerId}`, token);
  }
}
