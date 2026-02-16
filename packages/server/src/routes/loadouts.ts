import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import { query } from "../db/pool.js";
import { mapLoadoutRow } from "../services/player.js";

const VALID_LOADOUT_TYPES = ["infiltration", "attack", "defense"];

export async function loadoutRoutes(app: FastifyInstance) {
  // Get player's loadout(s)
  // ?type=infiltration|attack|defense — returns that type only
  // No type param — returns ALL loadout types
  app.get(
    "/api/loadouts",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const { type } = request.query as { type?: string };

      if (type && !VALID_LOADOUT_TYPES.includes(type)) {
        return reply.code(400).send({
          error: "Validation",
          message: `Invalid loadout type. Must be one of: ${VALID_LOADOUT_TYPES.join(", ")}`,
          statusCode: 400,
        });
      }

      let res;
      if (type) {
        res = await query(
          "SELECT * FROM player_loadouts WHERE player_id = $1 AND loadout_type = $2 ORDER BY slot",
          [playerId, type]
        );
      } else {
        res = await query(
          "SELECT * FROM player_loadouts WHERE player_id = $1 ORDER BY loadout_type, slot",
          [playerId]
        );
      }

      return { loadout: res.rows.map(mapLoadoutRow) };
    }
  );

  // Update loadout
  // body: { type?: LoadoutType, slots: [string|null, string|null, string|null] }
  // Defaults to 'infiltration' if no type specified (backward compat)
  app.put(
    "/api/loadouts",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const { type, slots } = request.body as {
        type?: string;
        slots: [string | null, string | null, string | null];
      };

      const loadoutType = type ?? "infiltration";
      if (!VALID_LOADOUT_TYPES.includes(loadoutType)) {
        return reply.code(400).send({
          error: "Validation",
          message: `Invalid loadout type. Must be one of: ${VALID_LOADOUT_TYPES.join(", ")}`,
          statusCode: 400,
        });
      }

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
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (player_id, loadout_type, slot) DO UPDATE SET module_id = $4`,
          [playerId, loadoutType, slot, moduleId]
        );
      }

      const res = await query(
        "SELECT * FROM player_loadouts WHERE player_id = $1 AND loadout_type = $2 ORDER BY slot",
        [playerId, loadoutType]
      );

      return { loadout: res.rows.map(mapLoadoutRow) };
    }
  );
}
