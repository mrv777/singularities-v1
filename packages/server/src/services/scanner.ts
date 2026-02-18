import { redis } from "../db/redis.js";
import { withTransaction } from "../db/pool.js";
import {
  TARGET_TYPES,
  type TargetType,
  type ScanTarget,
  SCANNER_BALANCE,
  getRiskRating,
  getBaseReward,
  getGameTypeForTarget,
  SCAN_ENERGY_COST,
  SCAN_TARGET_COUNT,
  SCAN_TTL_SECONDS,
} from "@singularities/shared";
import { computeEnergy } from "./player.js";

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
      gameType: getGameTypeForTarget(type),
      securityLevel,
      riskRating: getRiskRating(securityLevel),
      detectionChance: Math.round(detectionChance),
      rewards,
    });
  }
  return targets;
}

export async function scanTargets(playerId: string) {
  const activeGame = await redis.get(`minigame:${playerId}`);
  if (activeGame) {
    throw { statusCode: 409, message: "You have an active infiltration. Resolve it before scanning again." };
  }

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
