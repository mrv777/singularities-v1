import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import { query } from "../db/pool.js";
import { mapPlayerRow, mapSystemRow, mapModuleRow } from "../services/player.js";

export async function playerRoutes(app: FastifyInstance) {
  // Get current player profile (protected)
  app.get(
    "/api/player/me",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;

      const [playerResult, systemsResult, modulesResult] = await Promise.all([
        query("SELECT * FROM players WHERE id = $1", [playerId]),
        query("SELECT * FROM player_systems WHERE player_id = $1", [playerId]),
        query("SELECT * FROM player_modules WHERE player_id = $1", [playerId]),
      ]);

      if (playerResult.rows.length === 0) {
        return reply.code(404).send({
          error: "Not Found",
          message: "Player not found",
          statusCode: 404,
        });
      }

      return {
        player: mapPlayerRow(playerResult.rows[0]),
        systems: systemsResult.rows.map(mapSystemRow),
        modules: modulesResult.rows.map(mapModuleRow),
      };
    }
  );
}
