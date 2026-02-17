import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import {
  activateDataVaultProtocol,
  DataVaultError,
  getDataVaultStatus,
} from "../services/dataVault.js";

export async function dataVaultRoutes(app: FastifyInstance) {
  app.get(
    "/api/data-vault/status",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;

      try {
        return await getDataVaultStatus(playerId);
      } catch (err) {
        if (err instanceof DataVaultError) {
          return reply.code(err.statusCode).send({
            error: "Data Vault",
            message: err.message,
            statusCode: err.statusCode,
          });
        }
        throw err;
      }
    }
  );

  app.post(
    "/api/data-vault/activate",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const { protocolId } = request.body as { protocolId?: string };

      if (!protocolId || typeof protocolId !== "string") {
        return reply.code(400).send({
          error: "Validation",
          message: "protocolId is required",
          statusCode: 400,
        });
      }

      try {
        return await activateDataVaultProtocol(playerId, protocolId);
      } catch (err) {
        if (err instanceof DataVaultError) {
          return reply.code(err.statusCode).send({
            error: "Data Vault",
            message: err.message,
            statusCode: err.statusCode,
          });
        }
        throw err;
      }
    }
  );
}
