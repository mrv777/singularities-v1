import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import { enforceRateLimit } from "../middleware/rateLimit.js";
import {
  fullScan,
  repairSystem,
  repairAllSystems,
  getSystemHealthSummary,
  RepairError,
} from "../services/maintenance.js";

export async function maintenanceRoutes(app: FastifyInstance) {
  app.get(
    "/api/maintenance/summary",
    { preHandler: [authGuard] },
    async (request) => {
      const { sub: playerId } = request.user as AuthPayload;
      return getSystemHealthSummary(playerId);
    }
  );

  app.post(
    "/api/maintenance/full-scan",
    { preHandler: [authGuard] },
    async (request) => {
      const { sub: playerId } = request.user as AuthPayload;
      await enforceRateLimit(playerId, "maintenance:fullScan", 3);
      const systems = await fullScan(playerId);
      return { systems };
    }
  );

  app.post(
    "/api/maintenance/repair",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const { systemType } = request.body as { systemType: string };

      if (!systemType || typeof systemType !== "string") {
        return reply.code(400).send({
          error: "Validation",
          message: "systemType is required",
          statusCode: 400,
        });
      }

      try {
        await enforceRateLimit(playerId, "maintenance:repair", 5);
        const result = await repairSystem(playerId, systemType);
        return result;
      } catch (err) {
        if (err instanceof RepairError) {
          return reply.code(err.statusCode).send({
            error: "Repair Failed",
            message: err.message,
            statusCode: err.statusCode,
          });
        }
        throw err;
      }
    }
  );

  app.post(
    "/api/maintenance/repair-all",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;

      try {
        await enforceRateLimit(playerId, "maintenance:repairAll", 3);
        const result = await repairAllSystems(playerId);
        return result;
      } catch (err) {
        if (err instanceof RepairError) {
          return reply.code(err.statusCode).send({
            error: "Repair Failed",
            message: err.message,
            statusCode: err.statusCode,
          });
        }
        throw err;
      }
    }
  );
}
