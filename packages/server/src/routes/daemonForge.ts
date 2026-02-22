import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import { enforceRateLimit } from "../middleware/rateLimit.js";
import {
  getDaemonForgeStatus,
  craftDaemon,
  deployDaemon,
  collectDaemon,
  scrapDaemon,
  DaemonForgeError,
} from "../services/daemonForge.js";

export async function daemonForgeRoutes(app: FastifyInstance) {
  app.get(
    "/api/daemon-forge/status",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      try {
        return await getDaemonForgeStatus(playerId);
      } catch (err) {
        if (err instanceof DaemonForgeError) {
          return reply.code(err.statusCode).send({
            error: "Daemon Forge",
            message: err.message,
            statusCode: err.statusCode,
          });
        }
        throw err;
      }
    }
  );

  app.post(
    "/api/daemon-forge/craft",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const { daemonType } = request.body as { daemonType: string };
      if (!daemonType) {
        return reply.code(400).send({
          error: "Validation",
          message: "daemonType is required",
          statusCode: 400,
        });
      }
      try {
        await enforceRateLimit(playerId, "daemon:craft", 5);
        return await craftDaemon(playerId, daemonType);
      } catch (err) {
        if (err instanceof DaemonForgeError) {
          return reply.code(err.statusCode).send({
            error: "Daemon Forge",
            message: err.message,
            statusCode: err.statusCode,
          });
        }
        throw err;
      }
    }
  );

  app.post(
    "/api/daemon-forge/deploy",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const { daemonId, duration } = request.body as { daemonId: string; duration: number };
      if (!daemonId || !duration) {
        return reply.code(400).send({
          error: "Validation",
          message: "daemonId and duration are required",
          statusCode: 400,
        });
      }
      try {
        await enforceRateLimit(playerId, "daemon:deploy", 5);
        return await deployDaemon(playerId, daemonId, duration);
      } catch (err) {
        if (err instanceof DaemonForgeError) {
          return reply.code(err.statusCode).send({
            error: "Daemon Forge",
            message: err.message,
            statusCode: err.statusCode,
          });
        }
        throw err;
      }
    }
  );

  app.post(
    "/api/daemon-forge/collect",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const { daemonId } = request.body as { daemonId: string };
      if (!daemonId) {
        return reply.code(400).send({
          error: "Validation",
          message: "daemonId is required",
          statusCode: 400,
        });
      }
      try {
        await enforceRateLimit(playerId, "daemon:collect", 5);
        return await collectDaemon(playerId, daemonId);
      } catch (err) {
        if (err instanceof DaemonForgeError) {
          return reply.code(err.statusCode).send({
            error: "Daemon Forge",
            message: err.message,
            statusCode: err.statusCode,
          });
        }
        throw err;
      }
    }
  );

  app.delete(
    "/api/daemon-forge/:id",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const { id } = request.params as { id: string };
      try {
        return await scrapDaemon(playerId, id);
      } catch (err) {
        if (err instanceof DaemonForgeError) {
          return reply.code(err.statusCode).send({
            error: "Daemon Forge",
            message: err.message,
            statusCode: err.statusCode,
          });
        }
        throw err;
      }
    }
  );
}
