import { query, withTransaction } from "../db/pool.js";
import {
  MUTATION_COST,
  MUTATION_SUCCESS_RATE,
  MAX_MODULE_LEVEL,
  MUTATION_ELIGIBLE_TIERS,
  MUTATION_VARIANTS,
  MUTATION_VARIANT_MAP,
  MODULE_MAP,
  type MutationVariant,
} from "@singularities/shared";
import { computeEnergy, mapPlayerRow } from "./player.js";

export async function attemptMutation(playerId: string, moduleId: string) {
  return withTransaction(async (client) => {
    // Lock player
    const pRes = await client.query("SELECT * FROM players WHERE id = $1 FOR UPDATE", [playerId]);
    if (pRes.rows.length === 0) throw { statusCode: 404, message: "Player not found" };
    const playerRow = pRes.rows[0];

    // Check resources
    if ((playerRow.credits as number) < MUTATION_COST.credits) {
      throw { statusCode: 400, message: `Need ${MUTATION_COST.credits} credits` };
    }
    if ((playerRow.data as number) < MUTATION_COST.data) {
      throw { statusCode: 400, message: `Need ${MUTATION_COST.data} data` };
    }
    if ((playerRow.processing_power as number) < MUTATION_COST.processingPower) {
      throw { statusCode: 400, message: `Need ${MUTATION_COST.processingPower} processing power` };
    }

    // Check module exists and is eligible
    const modRes = await client.query(
      "SELECT * FROM player_modules WHERE player_id = $1 AND module_id = $2 FOR UPDATE",
      [playerId, moduleId]
    );
    if (modRes.rows.length === 0) {
      throw { statusCode: 404, message: "Module not found" };
    }

    const modRow = modRes.rows[0];
    if ((modRow.level as number) < MAX_MODULE_LEVEL) {
      throw { statusCode: 400, message: `Module must be max level (L${MAX_MODULE_LEVEL})` };
    }
    const moduleDef = MODULE_MAP[moduleId];
    if (moduleDef && !MUTATION_ELIGIBLE_TIERS.includes(moduleDef.tier as "advanced" | "elite")) {
      throw { statusCode: 400, message: "Only advanced and elite modules can be mutated" };
    }
    if (modRow.mutation) {
      throw { statusCode: 400, message: "Module is already mutated" };
    }

    // Deduct resources
    await client.query(
      `UPDATE players SET credits = credits - $2, data = data - $3, processing_power = processing_power - $4 WHERE id = $1`,
      [playerId, MUTATION_COST.credits, MUTATION_COST.data, MUTATION_COST.processingPower]
    );

    // Roll success
    const success = Math.random() < MUTATION_SUCCESS_RATE;
    let mutation: string | null = null;
    let message: string;

    if (success) {
      const variant = MUTATION_VARIANTS[Math.floor(Math.random() * MUTATION_VARIANTS.length)];
      mutation = variant.id;
      message = `Mutation successful! Module gained ${variant.name} mutation.`;

      await client.query(
        "UPDATE player_modules SET mutation = $2 WHERE id = $1",
        [modRow.id, mutation]
      );
    } else {
      message = "Mutation failed. Resources consumed. The module remains unchanged.";
    }

    // Get updated state
    const finalPlayer = await client.query("SELECT * FROM players WHERE id = $1", [playerId]);
    const player = computeEnergy(finalPlayer.rows[0]);

    const finalMod = await client.query("SELECT * FROM player_modules WHERE id = $1", [modRow.id]);

    return {
      result: { success, mutation, message },
      player: mapPlayerRow({ ...finalPlayer.rows[0], energy: player.energy }),
      module: {
        id: finalMod.rows[0].id as string,
        playerId: finalMod.rows[0].player_id as string,
        moduleId: finalMod.rows[0].module_id as string,
        level: finalMod.rows[0].level as number,
        mutation: finalMod.rows[0].mutation as string | null,
        purchasedAt: (finalMod.rows[0].purchased_at as Date).toISOString(),
      },
    };
  });
}

export function getMutationEffect(mutation: string | null): Record<string, number> {
  if (!mutation) return {};
  const variant = MUTATION_VARIANT_MAP[mutation];
  if (!variant) return {};
  return { ...variant.effects };
}
