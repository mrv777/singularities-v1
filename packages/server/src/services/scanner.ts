import { redis } from "../db/redis.js";
import { query, withTransaction } from "../db/pool.js";
import {
  TARGET_TYPES,
  TARGET_TYPE_LABELS,
  type TargetType,
  type ScanTarget,
  getRiskRating,
  getBaseReward,
  getHackEnergyCost,
  SCAN_ENERGY_COST,
  SCAN_TARGET_COUNT,
  SCAN_TTL_SECONDS,
  getHeatDamageConfig,
  SYSTEM_TYPES,
  type SystemType,
} from "@singularities/shared";
import { computeEnergy, mapPlayerRow, mapSystemRow } from "./player.js";
import { awardXP } from "./progression.js";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const TARGET_NAME_PREFIXES = [
  "NEXUS", "OMEGA", "CIPHER", "VECTOR", "HELIX",
  "PRISM", "ZENITH", "CORTEX", "AXIOM", "VERTEX",
  "SPARK", "NOVA", "PULSE", "ECHO", "FLUX",
];

function generateTargetName(type: TargetType, index: number): string {
  const prefix = TARGET_NAME_PREFIXES[randomInt(0, TARGET_NAME_PREFIXES.length - 1)];
  const suffix = randomInt(100, 999);
  return `${prefix}-${suffix}`;
}

export function generateTargets(playerLevel: number): ScanTarget[] {
  const targets: ScanTarget[] = [];
  for (let i = 0; i < SCAN_TARGET_COUNT; i++) {
    const type = TARGET_TYPES[randomInt(0, TARGET_TYPES.length - 1)];
    const securityLevel = Math.min(95, 20 + randomInt(0, 15) + playerLevel * 5);
    const detectionChance = Math.max(5, Math.min(95, securityLevel * 0.6 + randomInt(-10, 10)));
    const rewards = getBaseReward(securityLevel);
    targets.push({
      index: i,
      name: generateTargetName(type, i),
      type,
      securityLevel,
      riskRating: getRiskRating(securityLevel),
      detectionChance: Math.round(detectionChance),
      rewards,
    });
  }
  return targets;
}

export async function scanTargets(playerId: string) {
  return withTransaction(async (client) => {
    // Lock player row and compute energy
    const res = await client.query("SELECT * FROM players WHERE id = $1 FOR UPDATE", [playerId]);
    const row = res.rows[0];
    const player = computeEnergy(row);
    const energy = player.energy as number;

    if (energy < SCAN_ENERGY_COST) {
      throw { statusCode: 400, message: "Not enough energy to scan" };
    }

    // Deduct energy
    const newEnergy = energy - SCAN_ENERGY_COST;
    await client.query(
      `UPDATE players SET energy = $2, energy_updated_at = NOW() WHERE id = $1`,
      [playerId, newEnergy]
    );

    // Generate targets
    const targets = generateTargets(player.level as number);

    // Store in Redis
    const key = `scan:${playerId}`;
    await redis.set(key, JSON.stringify(targets), "EX", SCAN_TTL_SECONDS);

    const expiresAt = new Date(Date.now() + SCAN_TTL_SECONDS * 1000).toISOString();
    return { targets, expiresAt };
  });
}

export async function executeHack(playerId: string, targetIndex: number) {
  // Load targets from Redis (outside transaction — Redis is separate)
  const key = `scan:${playerId}`;
  const cached = await redis.get(key);
  if (!cached) {
    throw { statusCode: 400, message: "No active scan. Run a scan first." };
  }

  const targets: ScanTarget[] = JSON.parse(cached);
  const target = targets.find((t) => t.index === targetIndex);
  if (!target) {
    throw { statusCode: 400, message: "Invalid target index" };
  }

  const result = await withTransaction(async (client) => {
    // Lock player row and compute energy
    const pRes = await client.query("SELECT * FROM players WHERE id = $1 FOR UPDATE", [playerId]);
    const playerRow = pRes.rows[0];
    const player = computeEnergy(playerRow);
    const playerEnergy = player.energy as number;

    const energyCost = getHackEnergyCost(target.securityLevel);
    if (playerEnergy < energyCost) {
      throw { statusCode: 400, message: "Not enough energy to hack this target" };
    }

    // Get loadout power
    const loadoutRes = await client.query(
      `SELECT pm.module_id, pm.level FROM player_loadouts pl
       JOIN player_modules pm ON pm.player_id = pl.player_id AND pm.module_id = pl.module_id
       WHERE pl.player_id = $1 AND pl.loadout_type = 'infiltration'`,
      [playerId]
    );

    let loadoutPower = 0;
    for (const mod of loadoutRes.rows) {
      loadoutPower += (mod.level as number) * 5;
    }

    // Deduct energy
    const newEnergy = playerEnergy - energyCost;
    await client.query(
      `UPDATE players SET energy = $2, energy_updated_at = NOW() WHERE id = $1`,
      [playerId, newEnergy]
    );

    // Success calculation
    const baseChance = 50 + (loadoutPower - target.securityLevel);
    const successChance = Math.max(10, Math.min(95, baseChance));
    const roll = randomInt(1, 100);
    const success = roll <= successChance;

    let detected = false;
    let rewards = undefined;
    let damage = undefined;
    let levelUp = false;
    let newLevel = player.level as number;
    let narrative = "";

    if (success) {
      // Award resources
      const r = target.rewards;
      await client.query(
        `UPDATE players SET credits = credits + $2, data = data + $3, reputation = reputation + $4, heat_level = 0 WHERE id = $1`,
        [playerId, r.credits, r.data, r.reputation]
      );
      rewards = r;

      // Award XP within the same transaction
      const xpResult = await awardXP(playerId, r.xp, client);
      levelUp = xpResult.levelUp;
      newLevel = xpResult.newLevel;

      narrative = `> Infiltration of ${target.name} successful.\n` +
        `> Security level ${target.securityLevel} breached.\n` +
        `> Extracted: ${r.credits} CR, ${r.data} DATA\n` +
        `> Reputation +${r.reputation}\n` +
        (levelUp ? `> LEVEL UP! Now level ${newLevel}\n` : "") +
        `> Connection terminated. No traces found.`;
    } else {
      // Check detection
      const detectionRoll = randomInt(1, 100);
      detected = detectionRoll <= target.detectionChance;

      if (detected) {
        const heatLevel = player.heatLevel as number;
        const config = getHeatDamageConfig(heatLevel);

        // Apply damage to random systems
        const systemsRes = await client.query(
          "SELECT * FROM player_systems WHERE player_id = $1",
          [playerId]
        );
        const systems = systemsRes.rows;
        const affectedCount = Math.min(config.systemsAffected, systems.length);
        const shuffled = systems.sort(() => Math.random() - 0.5);
        const affected = shuffled.slice(0, affectedCount);

        const damageSystems: Array<{ systemType: string; damage: number }> = [];
        for (const sys of affected) {
          const dmg = randomInt(config.minDamage, config.maxDamage);
          const newHealth = Math.max(0, (sys.health as number) - dmg);
          const newStatus = newHealth >= 75 ? "OPTIMAL" : newHealth >= 30 ? "DEGRADED" : newHealth > 0 ? "CRITICAL" : "CORRUPTED";
          await client.query(
            `UPDATE player_systems SET health = $2, status = $3, updated_at = NOW() WHERE id = $1`,
            [sys.id, newHealth, newStatus]
          );
          damageSystems.push({ systemType: sys.system_type as string, damage: dmg });
        }

        // Increment heat
        await client.query(
          `UPDATE players SET heat_level = heat_level + 1 WHERE id = $1`,
          [playerId]
        );

        damage = { systems: damageSystems };

        narrative = `> Infiltration of ${target.name} FAILED.\n` +
          `> DETECTED by security systems!\n` +
          `> Countermeasures engaged — ${damageSystems.map(d => `${d.systemType}: -${d.damage}HP`).join(", ")}\n` +
          `> Heat level increased.\n` +
          `> Connection severed.`;
      } else {
        narrative = `> Infiltration of ${target.name} FAILED.\n` +
          `> Target security held. Hack unsuccessful.\n` +
          `> Escaped undetected. No damage taken.\n` +
          `> Connection terminated cleanly.`;
      }
    }

    // Log infiltration
    await client.query(
      `INSERT INTO infiltration_logs (player_id, target_type, security_level, success, detected, credits_earned, reputation_earned, damage_taken)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        playerId,
        target.type,
        target.securityLevel,
        success,
        detected,
        rewards?.credits ?? 0,
        rewards?.reputation ?? 0,
        damage ? JSON.stringify(damage.systems) : null,
      ]
    );

    // Get final player state
    const finalRes = await client.query("SELECT * FROM players WHERE id = $1", [playerId]);
    const finalPlayer = computeEnergy(finalRes.rows[0]);

    return {
      success,
      detected,
      narrative,
      rewards,
      damage,
      levelUp,
      newLevel,
      player: mapPlayerRow({
        ...finalRes.rows[0],
        energy: finalPlayer.energy,
      }),
    };
  });

  // Remove used target from Redis (after successful transaction)
  const remaining = targets.filter((t) => t.index !== targetIndex);
  if (remaining.length > 0) {
    await redis.set(key, JSON.stringify(remaining), "EX", SCAN_TTL_SECONDS);
  } else {
    await redis.del(key);
  }

  return result;
}
