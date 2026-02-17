import { redis } from "../db/redis.js";
import { query, withTransaction } from "../db/pool.js";
import {
  TARGET_TYPES,
  TARGET_TYPE_LABELS,
  type TargetType,
  type ScanTarget,
  HOOK_BALANCE,
  SCANNER_BALANCE,
  getEarlyHackSuccessFloor,
  getRiskRating,
  getBaseReward,
  getHackEnergyCost,
  SCAN_ENERGY_COST,
  SCAN_TARGET_COUNT,
  SCAN_TTL_SECONDS,
  getHeatDamageConfig,
  SYSTEM_TYPES,
  SYSTEM_STATUS_THRESHOLDS,
  type SystemType,
} from "@singularities/shared";
import { computeEnergy, mapPlayerRow, mapSystemRow } from "./player.js";
import { awardXP } from "./progression.js";
import { getSeasonCatchUpBonuses } from "./seasons.js";
import { resolveLoadoutStats } from "./stats.js";
import { computeSystemHealth } from "./maintenance.js";
import { triggerDecision } from "./decisions.js";
import { shiftAlignment } from "./alignment.js";
import {
  ALIGNMENT_SHIFTS,
  pickTemplate,
  fillTemplate,
  HACK_SUCCESS_TEMPLATES,
  HACK_FAIL_UNDETECTED_TEMPLATES,
  HACK_FAIL_DETECTED_TEMPLATES,
} from "@singularities/shared";
import { sendActivity } from "./ws.js";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

async function applyTimedBuff(playerId: string, stat: "hackPower" | "stealth", amount: number, ttl: number) {
  const key = `buff:${playerId}:${stat}`;
  const existing = await redis.get(key);
  const newValue = (existing ? parseInt(existing, 10) : 0) + amount;
  await redis.set(key, String(newValue), "EX", ttl);
}

function getStatusForHealth(health: number): string {
  if (health <= SYSTEM_STATUS_THRESHOLDS.CORRUPTED.max) return "CORRUPTED";
  if (health <= SYSTEM_STATUS_THRESHOLDS.CRITICAL.max) return "CRITICAL";
  if (health <= SYSTEM_STATUS_THRESHOLDS.DEGRADED.max) return "DEGRADED";
  return "OPTIMAL";
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
    const securityLevel = Math.min(
      SCANNER_BALANCE.targetSecurity.max,
      SCANNER_BALANCE.targetSecurity.baseMin
      + randomInt(0, SCANNER_BALANCE.targetSecurity.randomRange)
      + playerLevel * SCANNER_BALANCE.targetSecurity.levelStep
    );
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

  let resourceMultiplier = 1;
  try {
    const catchUpBonuses = await getSeasonCatchUpBonuses(playerId);
    resourceMultiplier = catchUpBonuses.resourceMultiplier;
  } catch {
    // Non-critical: if season service fails, proceed with base rewards.
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

    // Resolve full loadout stats (modules × level + traits + health multiplier)
    const stats = await resolveLoadoutStats(playerId, "infiltration", client);
    const effectiveHackPower = Math.round(stats.hackPower * stats.healthMultiplier);

    // Deduct energy
    const newEnergy = playerEnergy - energyCost;
    await client.query(
      `UPDATE players SET energy = $2, energy_updated_at = NOW() WHERE id = $1`,
      [playerId, newEnergy]
    );

    // Success calculation: hackPower drives success chance
    const baseChance = SCANNER_BALANCE.hackSuccess.baseChance
      + (effectiveHackPower - target.securityLevel);
    const successFloor = getEarlyHackSuccessFloor(player.level as number);
    const successChance = Math.max(
      successFloor,
      Math.min(SCANNER_BALANCE.hackSuccess.maxChance, baseChance)
    );
    const roll = randomInt(1, 100);
    const success = roll <= successChance;

    let detected = false;
    let rewards = undefined;
    let damage = undefined;
    let levelUp = false;
    let newLevel = player.level as number;
    let narrative = "";

    if (success) {
      // Calculate rewards with module bonuses and daily modifier
      const baseRewards = target.rewards;
      const creditMultiplier = 1 + stats.creditBonus / 100;
      const dataMultiplier = 1 + stats.dataBonus / 100;
      const rewardModifier = stats.modifierEffects.hackRewardMultiplier ?? 1;

      const finalCredits = Math.floor(
        baseRewards.credits * creditMultiplier * rewardModifier * resourceMultiplier
      );
      const finalData = Math.floor(
        baseRewards.data * dataMultiplier * rewardModifier * resourceMultiplier
      );
      const finalReputation = baseRewards.reputation;
      const finalXp = Math.floor(baseRewards.xp * (stats.modifierEffects.xpGainMultiplier ?? 1));
      const processingPowerReward = target.securityLevel >= SCANNER_BALANCE.highRiskProcessingPower.securityThreshold
        ? Math.max(
          1,
          Math.floor(
            randomInt(
              SCANNER_BALANCE.highRiskProcessingPower.min,
              SCANNER_BALANCE.highRiskProcessingPower.max
            ) * resourceMultiplier
          )
        )
        : 0;

      await client.query(
        `UPDATE players
         SET credits = credits + $2,
             data = data + $3,
             reputation = reputation + $4,
             processing_power = processing_power + $5,
             heat_level = 0
         WHERE id = $1`,
        [playerId, finalCredits, finalData, finalReputation, processingPowerReward]
      );
      rewards = {
        credits: finalCredits,
        data: finalData,
        reputation: finalReputation,
        xp: finalXp,
        processingPower: processingPowerReward > 0 ? processingPowerReward : undefined,
      };

      // Award XP within the same transaction
      const xpResult = await awardXP(playerId, finalXp, client);
      levelUp = xpResult.levelUp;
      newLevel = xpResult.newLevel;

      // Hook loop: first successful hack each UTC day grants temporary combat buffs.
      const dailyBuffKey = `daily:first_success_buff:${playerId}:${todayDateString()}`;
      const alreadyGranted = await redis.get(dailyBuffKey);
      if (!alreadyGranted) {
        await redis.set(dailyBuffKey, "1", "EX", 86400);
        await applyTimedBuff(
          playerId,
          "hackPower",
          HOOK_BALANCE.firstSuccessDailyBuff.hackPower,
          HOOK_BALANCE.firstSuccessDailyBuff.durationSeconds
        );
        await applyTimedBuff(
          playerId,
          "stealth",
          HOOK_BALANCE.firstSuccessDailyBuff.stealth,
          HOOK_BALANCE.firstSuccessDailyBuff.durationSeconds
        );
      }

      narrative = fillTemplate(pickTemplate(HACK_SUCCESS_TEMPLATES), {
        target: target.name,
        security: target.securityLevel,
        power: effectiveHackPower,
        credits: finalCredits,
        data: finalData,
        reputation: finalReputation,
        processingPower: processingPowerReward,
        rounds: randomInt(2, 5),
      });
      if (levelUp) {
        narrative += `\n> LEVEL UP! Now level ${newLevel}`;
      }
      if (!alreadyGranted) {
        narrative += `\n> DAILY SYNC BONUS: +${HOOK_BALANCE.firstSuccessDailyBuff.hackPower} Hack Power, +${HOOK_BALANCE.firstSuccessDailyBuff.stealth} Stealth for 1 hour`;
      }
    } else {
      // Detection check: stealth + detectionReduction lower the chance
      const stealthReduction = (stats.stealth + stats.detectionReduction) / 2;
      const detectionModifier = stats.modifierEffects.detectionChanceMultiplier ?? 1;
      const effectiveDetection = Math.max(5, Math.min(95,
        (target.detectionChance - stealthReduction) * detectionModifier
      ));
      const detectionRoll = randomInt(1, 100);
      detected = detectionRoll <= effectiveDetection;

      if (detected) {
        const heatLevel = player.heat_level as number;
        const config = getHeatDamageConfig(heatLevel);

        // Fix 3: Materialize degraded health before applying damage
        const systemsRes = await client.query(
          "SELECT * FROM player_systems WHERE player_id = $1 FOR UPDATE",
          [playerId]
        );
        const systems = systemsRes.rows;
        const affectedCount = Math.min(config.systemsAffected, systems.length);
        const shuffled = systems.sort(() => Math.random() - 0.5);
        const affected = shuffled.slice(0, affectedCount);

        const damageSystems: Array<{ systemType: string; damage: number }> = [];
        for (const sys of affected) {
          // Materialize degraded health first
          const computed = computeSystemHealth(sys, stats.modifierEffects);
          const currentHealth = computed.health as number;

          const dmg = randomInt(config.minDamage, config.maxDamage);
          const newHealth = Math.max(0, currentHealth - dmg);
          const newStatus = getStatusForHealth(newHealth);
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

        narrative = fillTemplate(pickTemplate(HACK_FAIL_DETECTED_TEMPLATES), {
          target: target.name,
          detection: Math.round(effectiveDetection),
          damageReport: damageSystems.map(d => `${d.systemType}: -${d.damage}HP`).join(", "),
        });
      } else {
        narrative = fillTemplate(pickTemplate(HACK_FAIL_UNDETECTED_TEMPLATES), {
          target: target.name,
          security: target.securityLevel,
          stealth: stats.stealth,
          power: effectiveHackPower,
        });
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

  // Send activity notification
  try {
    const msg = result.success
      ? `Hack succeeded on ${target.name} — +${result.rewards?.credits ?? 0} CR${
        result.rewards?.processingPower ? `, +${result.rewards.processingPower} PP` : ""
      }`
      : `Hack failed on ${target.name}${result.detected ? " (DETECTED)" : ""}`;
    sendActivity(playerId, msg);
  } catch { /* non-critical */ }

  // Phase 4: Post-hack alignment shifts and decision triggers (fire-and-forget)
  try {
    // Civilian target types shift alignment negatively
    if (["database", "research", "infrastructure"].includes(target.type)) {
      await shiftAlignment(playerId, ALIGNMENT_SHIFTS.hackCivilian);
    }
    // 10% chance to trigger a binary decision
    await triggerDecision(playerId, "afterHack");
  } catch {
    // Non-critical — don't fail the hack
  }

  return result;
}
