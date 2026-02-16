import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import { query } from "../db/pool.js";
import { mapLoadoutRow, mapCombatLogRow } from "../services/player.js";
import { computeSystemHealth } from "../services/maintenance.js";
import { getActiveModifierEffects } from "../services/modifiers.js";

export async function securityRoutes(app: FastifyInstance) {
  // Security center overview
  app.get(
    "/api/security/overview",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;

      const [playerRes, loadoutRes, attacksRes, systemsRes] = await Promise.all([
        query("SELECT heat_level FROM players WHERE id = $1", [playerId]),
        query(
          "SELECT * FROM player_loadouts WHERE player_id = $1 AND loadout_type = 'defense' ORDER BY slot",
          [playerId]
        ),
        query(
          `SELECT * FROM combat_logs
           WHERE defender_id = $1
           ORDER BY created_at DESC
           LIMIT 10`,
          [playerId]
        ),
        query("SELECT * FROM player_systems WHERE player_id = $1 ORDER BY system_type", [playerId]),
      ]);

      if (playerRes.rows.length === 0) {
        return reply.code(404).send({ error: "Not Found", message: "Player not found", statusCode: 404 });
      }

      const effects = await getActiveModifierEffects();

      return {
        defenseLoadout: loadoutRes.rows.map(mapLoadoutRow),
        recentAttacks: attacksRes.rows.map(mapCombatLogRow),
        heatLevel: playerRes.rows[0].heat_level as number,
        systemHealthSummary: systemsRes.rows.map((r) => {
          const computed = computeSystemHealth(r, effects);
          return {
            systemType: computed.system_type as string,
            health: computed.health as number,
            status: computed.status as string,
          };
        }),
      };
    }
  );
}
