import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import { scanTargets } from "../services/scanner.js";
import { startGame, submitMove, resolveGame, getGameStatus, MinigameError } from "../services/minigame.js";
import { redis } from "../db/redis.js";

const RATE_LIMIT_WINDOW_SECONDS = 10;
const SCANNER_RATE_LIMITS = {
  startGame: 8,
  move: 45,
  resolve: 8,
  status: 30,
} as const;

async function enforceScannerRateLimit(
  playerId: string,
  action: keyof typeof SCANNER_RATE_LIMITS
) {
  const bucket = Math.floor(Date.now() / (RATE_LIMIT_WINDOW_SECONDS * 1000));
  const key = `rl:scanner:${action}:${playerId}:${bucket}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS + 1);
  }
  if (count > SCANNER_RATE_LIMITS[action]) {
    throw new MinigameError("Too many scanner actions. Slow down and try again.", 429);
  }
}

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
        await enforceScannerRateLimit(playerId, "startGame");
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
        await enforceScannerRateLimit(playerId, "move");
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
        await enforceScannerRateLimit(playerId, "resolve");
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
        await enforceScannerRateLimit(playerId, "status");
        return await getGameStatus(playerId);
      } catch (err: any) {
        return handleError(err, reply);
      }
    }
  );
}
