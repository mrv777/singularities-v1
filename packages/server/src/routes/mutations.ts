import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import { attemptMutation } from "../services/mutations.js";

export async function mutationRoutes(app: FastifyInstance) {
  // Attempt module mutation
  app.post(
    "/api/modules/mutate",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const { moduleId } = request.body as { moduleId: string };

      if (!moduleId) {
        return reply.code(400).send({
          error: "Validation",
          message: "moduleId is required",
          statusCode: 400,
        });
      }

      try {
        const result = await attemptMutation(playerId, moduleId);
        return result;
      } catch (err: any) {
        const statusCode = err.statusCode ?? 500;
        return reply.code(statusCode).send({
          error: "Mutation Error",
          message: err.message ?? "Mutation failed",
          statusCode,
        });
      }
    }
  );
}
