import { query, type TxClient } from "../db/pool.js";
import {
  XP_THRESHOLDS,
  MAX_LEVEL,
  getLevelForXP,
  ENERGY_BASE_MAX,
  ENERGY_MAX_PER_LEVEL,
} from "@singularities/shared";
import { computeEnergy, mapPlayerRow } from "./player.js";
import { getSeasonCatchUpMultiplier, applySeasonXPBoost } from "./seasons.js";

type DbQuery = (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

export async function awardXP(
  playerId: string,
  amount: number,
  client?: TxClient
): Promise<{ player: ReturnType<typeof mapPlayerRow>; levelUp: boolean; newLevel: number }> {
  const dbQuery: DbQuery = client
    ? (text, params) => client.query(text, params)
    : (text, params) => query(text, params);

  // Phase 4: Apply season catch-up multiplier
  let boostedAmount = amount;
  try {
    const multiplier = await getSeasonCatchUpMultiplier(playerId);
    boostedAmount = applySeasonXPBoost(amount, multiplier);
  } catch {
    // Non-critical — use base amount if season service fails
  }

  // Get current player
  const res = await dbQuery("SELECT * FROM players WHERE id = $1", [playerId]);
  const row = res.rows[0];
  const currentLevel = row.level as number;
  const currentXP = row.xp as number;
  const newXP = currentXP + boostedAmount;
  const newLevel = getLevelForXP(newXP);
  const levelUp = newLevel > currentLevel;

  if (levelUp) {
    const newEnergyMax = ENERGY_BASE_MAX + (newLevel - 1) * ENERGY_MAX_PER_LEVEL;
    await dbQuery(
      `UPDATE players SET xp = $2, level = $3, energy_max = $4 WHERE id = $1`,
      [playerId, newXP, newLevel, newEnergyMax]
    );
  } else {
    await dbQuery(`UPDATE players SET xp = $2 WHERE id = $1`, [playerId, newXP]);
  }

  const updated = await dbQuery("SELECT * FROM players WHERE id = $1", [playerId]);
  const player = computeEnergy(updated.rows[0]);
  return {
    player: mapPlayerRow({ ...updated.rows[0], energy: player.energy }),
    levelUp,
    newLevel,
  };
}
