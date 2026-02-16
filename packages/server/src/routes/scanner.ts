import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import { scanTargets, executeHack } from "../services/scanner.js";

export async function scannerRoutes(app: FastifyInstance) {
  // Scan for targets
  app.post(
    "/api/scanner/scan",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;

      try {
        const result = await scanTargets(playerId);
        return result;
      } catch (err: any) {
        if (err.statusCode) {
          return reply
            .code(err.statusCode)
            .send({ error: "Scanner", message: err.message, statusCode: err.statusCode });
        }
        throw err;
      }
    }
  );

  // Execute hack on target
  app.post(
    "/api/scanner/hack",
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
        const result = await executeHack(playerId, targetIndex);
        return result;
      } catch (err: any) {
        if (err.statusCode) {
          return reply
            .code(err.statusCode)
            .send({ error: "Scanner", message: err.message, statusCode: err.statusCode });
        }
        throw err;
      }
    }
  );
}
