import { query, withTransaction } from "../db/pool.js";
import {
  ALL_MODULES,
  MODULE_MAP,
  TIER_UNLOCK_REQUIREMENT,
  MAX_MODULE_LEVEL,
  MODULE_PURCHASE_XP,
  type ModuleDefinition,
  type ModuleTier,
} from "@singularities/shared";
import { mapPlayerRow, mapModuleRow } from "./player.js";
import { awardXP } from "./progression.js";

const TIER_ORDER: ModuleTier[] = ["basic", "advanced", "elite"];

function getPreviousTier(tier: ModuleTier): ModuleTier | null {
  const idx = TIER_ORDER.indexOf(tier);
  return idx > 0 ? TIER_ORDER[idx - 1] : null;
}

export async function purchaseOrUpgradeModule(playerId: string, moduleId: string) {
  const definition = MODULE_MAP[moduleId];
  if (!definition) {
    throw { statusCode: 400, message: "Unknown module" };
  }

  return withTransaction(async (client) => {
    // Lock player row
    const playerRes = await client.query("SELECT * FROM players WHERE id = $1 FOR UPDATE", [playerId]);
    const playerRow = playerRes.rows[0];

    // Get player's owned modules
    const ownedRes = await client.query("SELECT * FROM player_modules WHERE player_id = $1", [playerId]);
    const ownedModules = ownedRes.rows;
    const existing = ownedModules.find((m) => m.module_id === moduleId);

    if (existing) {
      // Upgrade existing module
      const currentLevel = existing.level as number;
      if (currentLevel >= MAX_MODULE_LEVEL) {
        throw { statusCode: 400, message: "Module already at max level" };
      }

      const cost = {
        credits: definition.baseCost.credits + definition.costPerLevel.credits * currentLevel,
        data: definition.baseCost.data + definition.costPerLevel.data * currentLevel,
      };

      if ((playerRow.credits as number) < cost.credits || (playerRow.data as number) < cost.data) {
        throw { statusCode: 400, message: "Insufficient resources" };
      }

      await client.query(
        `UPDATE players SET credits = credits - $2, data = data - $3 WHERE id = $1`,
        [playerId, cost.credits, cost.data]
      );

      await client.query(
        `UPDATE player_modules SET level = level + 1 WHERE id = $1`,
        [existing.id]
      );
    } else {
      // New purchase — check dependencies
      const prevTier = getPreviousTier(definition.tier);
      if (prevTier) {
        const prevTierModules = ALL_MODULES.filter(
          (m) => m.category === definition.category && m.tier === prevTier
        );
        const ownedPrevTier = prevTierModules.filter((m) =>
          ownedModules.some((om) => om.module_id === m.id)
        );
        if (ownedPrevTier.length < TIER_UNLOCK_REQUIREMENT) {
          throw {
            statusCode: 400,
            message: `Requires ${TIER_UNLOCK_REQUIREMENT} ${prevTier} modules in ${definition.category} category`,
          };
        }
      }

      const cost = definition.baseCost;
      if ((playerRow.credits as number) < cost.credits || (playerRow.data as number) < cost.data) {
        throw { statusCode: 400, message: "Insufficient resources" };
      }

      await client.query(
        `UPDATE players SET credits = credits - $2, data = data - $3 WHERE id = $1`,
        [playerId, cost.credits, cost.data]
      );

      await client.query(
        `INSERT INTO player_modules (player_id, module_id) VALUES ($1, $2)`,
        [playerId, moduleId]
      );
    }

    // Award XP within the same transaction
    const xpResult = await awardXP(playerId, MODULE_PURCHASE_XP, client);

    // Get updated module
    const updatedModRes = await client.query(
      "SELECT * FROM player_modules WHERE player_id = $1 AND module_id = $2",
      [playerId, moduleId]
    );

    return {
      player: xpResult.player,
      module: mapModuleRow(updatedModRes.rows[0]),
      levelUp: xpResult.levelUp,
      newLevel: xpResult.newLevel,
    };
  });
}
