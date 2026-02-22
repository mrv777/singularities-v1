import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import { scanTargets } from "../services/scanner.js";
import { startGame, submitMove, resolveGame, getGameStatus, MinigameError } from "../services/minigame.js";
import { enforceRateLimit } from "../middleware/rateLimit.js";

const SCANNER_RATE_LIMITS = {
  startGame: 8,
  move: 45,
  resolve: 8,
  status: 30,
} as const;

function handleError(err: any, reply: any) {
  if (err instanceof MinigameError || err.statusCode) {
    return reply
      .code(err.statusCode)
      .send({ error: "Scanner", message: err.message, statusCode: err.statusCode });
  }
  throw err;
}

export async function scannerRoutes(app: FastifyInstance) {
  // Scan for targets
  app.post(
    "/api/scanner/scan",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      try {
        return await scanTargets(playerId);
      } catch (err: any) {
        return handleError(err, reply);
      }
    }
  );

  // Start a mini-game on a selected target
  app.post(
    "/api/scanner/start-game",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const { targetIndex } = request.body as { targetIndex: number };

      if (targetIndex === undefined || typeof targetIndex !== "number") {
        return reply.code(400).send({
          error: "Validation",
          message: "targetIndex is required",
          statusCode: 400,
        });
      }

      try {
        await enforceRateLimit(playerId, "scanner:startGame", SCANNER_RATE_LIMITS.startGame);
        return await startGame(playerId, targetIndex);
      } catch (err: any) {
        return handleError(err, reply);
      }
    }
  );

  // Submit a move in the active mini-game
  app.post(
    "/api/scanner/move",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const { move } = request.body as { move: any };

      if (!move || !move.type) {
        return reply.code(400).send({
          error: "Validation",
          message: "move object with type is required",
          statusCode: 400,
        });
      }

      try {
        await enforceRateLimit(playerId, "scanner:move", SCANNER_RATE_LIMITS.move);
        return await submitMove(playerId, move);
      } catch (err: any) {
        return handleError(err, reply);
      }
    }
  );

  // Resolve the active mini-game (compute score, apply rewards)
  app.post(
    "/api/scanner/resolve",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      try {
        await enforceRateLimit(playerId, "scanner:resolve", SCANNER_RATE_LIMITS.resolve);
        return await resolveGame(playerId);
      } catch (err: any) {
        return handleError(err, reply);
      }
    }
  );

  // Get active game status (for resume on reconnect)
  app.get(
    "/api/scanner/game-status",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      try {
        await enforceRateLimit(playerId, "scanner:status", SCANNER_RATE_LIMITS.status);
        return await getGameStatus(playerId);
      } catch (err: any) {
        return handleError(err, reply);
      }
    }
  );
}
