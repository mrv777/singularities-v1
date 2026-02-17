import { query, type TxClient } from "../db/pool.js";
import {
  getLevelForXP,
  ENERGY_BASE_MAX,
  ENERGY_MAX_PER_LEVEL,
  getEnergyAfterLevelUp,
} from "@singularities/shared";
import { computeEnergy, mapPlayerRow } from "./player.js";
import { getSeasonCatchUpMultiplier, applySeasonXPBoost } from "./seasons.js";
import { broadcastSystem, sendActivity } from "./ws.js";

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
  const computed = computeEnergy(row);
  const currentEnergy = computed.energy as number;
  const currentLevel = row.level as number;
  const currentXP = row.xp as number;
  const newXP = currentXP + boostedAmount;
  const newLevel = getLevelForXP(newXP);
  const levelUp = newLevel > currentLevel;

  if (levelUp) {
    const newEnergyMax = ENERGY_BASE_MAX + (newLevel - 1) * ENERGY_MAX_PER_LEVEL;
    const newEnergy = getEnergyAfterLevelUp(currentEnergy, newEnergyMax);
    await dbQuery(
      `UPDATE players
         SET xp = $2,
             level = $3,
             energy_max = $4,
             energy = $5,
             energy_updated_at = NOW()
       WHERE id = $1`,
      [playerId, newXP, newLevel, newEnergyMax, newEnergy]
    );
    // Broadcast level up
    const nameRes = await dbQuery("SELECT ai_name FROM players WHERE id = $1", [playerId]);
    const aiName = nameRes.rows[0]?.ai_name as string ?? "Unknown";
    broadcastSystem(`${aiName} reached level ${newLevel}!`);
    sendActivity(playerId, `Level up! Now level ${newLevel}`);
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
