import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import { query } from "../db/pool.js";
import { computeEnergy, mapPlayerRow } from "../services/player.js";
import {
  getAvailableOpponents,
  enterArena,
  leaveArena,
  executeAttack,
  getRecentCombatLogs,
  isPvpHours,
} from "../services/arena.js";

export async function arenaRoutes(app: FastifyInstance) {
  // List available opponents
  app.get(
    "/api/arena/available",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;

      const playerRes = await query("SELECT * FROM players WHERE id = $1", [playerId]);
      if (playerRes.rows.length === 0) {
        return reply.code(404).send({ error: "Not Found", message: "Player not found", statusCode: 404 });
      }

      const player = playerRes.rows[0];
      const inArena = player.in_pvp_arena as boolean;
      const pvpActive = isPvpHours();

      let opponents: Awaited<ReturnType<typeof getAvailableOpponents>> = [];
      if (inArena && pvpActive) {
        opponents = await getAvailableOpponents(playerId, player.level as number);
      }

      return {
        opponents,
        isInArena: inArena,
        isPvpHours: pvpActive,
      };
    }
  );

  // Enter arena
  app.post(
    "/api/arena/enter",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;

      try {
        const player = await enterArena(playerId);
        return { success: true, player };
      } catch (err: any) {
        const statusCode = err.statusCode ?? 500;
        return reply.code(statusCode).send({
          error: "Arena Error",
          message: err.message ?? "Failed to enter arena",
          statusCode,
        });
      }
    }
  );

  // Leave arena
  app.post(
    "/api/arena/leave",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;

      try {
        const player = await leaveArena(playerId);
        return { success: true, player };
      } catch (err: any) {
        const statusCode = err.statusCode ?? 500;
        return reply.code(statusCode).send({
          error: "Arena Error",
          message: err.message ?? "Failed to leave arena",
          statusCode,
        });
      }
    }
  );

  // Attack a player
  app.post(
    "/api/arena/attack",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const { targetId } = request.body as { targetId: string };

      if (!targetId) {
        return reply.code(400).send({
          error: "Validation",
          message: "targetId is required",
          statusCode: 400,
        });
      }

      if (targetId === playerId) {
        return reply.code(400).send({
          error: "Validation",
          message: "Cannot attack yourself",
          statusCode: 400,
        });
      }

      try {
        const result = await executeAttack(playerId, targetId);
        return result;
      } catch (err: any) {
        const statusCode = err.statusCode ?? 500;
        return reply.code(statusCode).send({
          error: "Combat Error",
          message: err.message ?? "Attack failed",
          statusCode,
        });
      }
    }
  );

  // Get combat logs
  app.get(
    "/api/arena/combat-logs",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;

      const logs = await getRecentCombatLogs(playerId);
      return { logs };
    }
  );
}
