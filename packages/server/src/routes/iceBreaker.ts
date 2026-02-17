import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import {
  getIceBreakerStatus,
  initiateBreach,
  resolveLayer,
  extractRewards,
  IceBreakerError,
} from "../services/iceBreaker.js";

export async function iceBreakerRoutes(app: FastifyInstance) {
  app.get(
    "/api/ice-breaker/status",
    { preHandler: [authGuard] },
    async (request) => {
      const { sub: playerId } = request.user as AuthPayload;
      return getIceBreakerStatus(playerId);
    }
  );

  app.post(
    "/api/ice-breaker/initiate",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      try {
        return await initiateBreach(playerId);
      } catch (err) {
        if (err instanceof IceBreakerError) {
          return reply.code(err.statusCode).send({
            error: "ICE Breaker",
            message: err.message,
            statusCode: err.statusCode,
          });
        }
        throw err;
      }
    }
  );

  app.post(
    "/api/ice-breaker/resolve",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      try {
        return await resolveLayer(playerId);
      } catch (err) {
        if (err instanceof IceBreakerError) {
          return reply.code(err.statusCode).send({
            error: "ICE Breaker",
            message: err.message,
            statusCode: err.statusCode,
          });
        }
        throw err;
      }
    }
  );

  app.post(
    "/api/ice-breaker/extract",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      try {
        return await extractRewards(playerId);
      } catch (err) {
        if (err instanceof IceBreakerError) {
          return reply.code(err.statusCode).send({
            error: "ICE Breaker",
            message: err.message,
            statusCode: err.statusCode,
          });
        }
        throw err;
      }
    }
  );
}
