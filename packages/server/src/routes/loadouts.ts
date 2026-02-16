import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import { query } from "../db/pool.js";
import { mapLoadoutRow } from "../services/player.js";

export async function loadoutRoutes(app: FastifyInstance) {
  // Get player's infiltration loadout
  app.get(
    "/api/loadouts",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;

      const res = await query(
        "SELECT * FROM player_loadouts WHERE player_id = $1 AND loadout_type = 'infiltration' ORDER BY slot",
        [playerId]
      );

      return { loadout: res.rows.map(mapLoadoutRow) };
    }
  );

  // Update infiltration loadout
  app.put(
    "/api/loadouts",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const { slots } = request.body as {
        slots: [string | null, string | null, string | null];
      };

      if (!Array.isArray(slots) || slots.length !== 3) {
        return reply.code(400).send({
          error: "Validation",
          message: "slots must be an array of 3 module IDs or nulls",
          statusCode: 400,
        });
      }

      // Check for duplicate modules
      const moduleIds = slots.filter((s): s is string => s !== null);
      if (new Set(moduleIds).size !== moduleIds.length) {
        return reply.code(400).send({
          error: "Validation",
          message: "Cannot assign the same module to multiple slots",
          statusCode: 400,
        });
      }

      // Validate player owns all specified modules
      if (moduleIds.length > 0) {
        const owned = await query(
          "SELECT module_id FROM player_modules WHERE player_id = $1",
          [playerId]
        );
        const ownedIds = new Set(owned.rows.map((r) => r.module_id as string));
        for (const mid of moduleIds) {
          if (!ownedIds.has(mid)) {
            return reply.code(400).send({
              error: "Validation",
              message: `Module ${mid} not owned`,
              statusCode: 400,
            });
          }
        }
      }

      // Upsert each slot
      for (let i = 0; i < 3; i++) {
        const slot = i + 1;
        const moduleId = slots[i];
        await query(
          `INSERT INTO player_loadouts (player_id, loadout_type, slot, module_id)
           VALUES ($1, 'infiltration', $2, $3)
           ON CONFLICT (player_id, loadout_type, slot) DO UPDATE SET module_id = $3`,
          [playerId, slot, moduleId]
        );
      }

      const res = await query(
        "SELECT * FROM player_loadouts WHERE player_id = $1 AND loadout_type = 'infiltration' ORDER BY slot",
        [playerId]
      );

      return { loadout: res.rows.map(mapLoadoutRow) };
    }
  );
}
