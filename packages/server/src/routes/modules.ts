import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import { query } from "../db/pool.js";
import { ALL_MODULES } from "@singularities/shared";
import { mapModuleRow } from "../services/player.js";
import { purchaseOrUpgradeModule } from "../services/modules.js";

export async function moduleRoutes(app: FastifyInstance) {
  // Get all module definitions + player's owned modules
  app.get(
    "/api/modules",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;

      const ownedRes = await query(
        "SELECT * FROM player_modules WHERE player_id = $1",
        [playerId]
      );

      return {
        definitions: ALL_MODULES,
        owned: ownedRes.rows.map(mapModuleRow),
      };
    }
  );

  // Purchase or upgrade a module
  app.post(
    "/api/modules/purchase",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const { moduleId } = request.body as { moduleId: string };

      if (!moduleId || typeof moduleId !== "string") {
        return reply.code(400).send({
          error: "Validation",
          message: "moduleId is required",
          statusCode: 400,
        });
      }

      try {
        const result = await purchaseOrUpgradeModule(playerId, moduleId);
        return result;
      } catch (err: any) {
        if (err.statusCode) {
          return reply
            .code(err.statusCode)
            .send({ error: "Modules", message: err.message, statusCode: err.statusCode });
        }
        throw err;
      }
    }
  );
}
