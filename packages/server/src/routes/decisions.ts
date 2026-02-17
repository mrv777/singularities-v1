import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import {
  getPendingDecision,
  resolveDecision,
  getDecisionHistory,
} from "../services/decisions.js";

export async function decisionRoutes(app: FastifyInstance) {
  // Check for pending decision
  app.get(
    "/api/decisions/pending",
    { preHandler: [authGuard] },
    async (request, _reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const result = await getPendingDecision(playerId);

      if (!result) return { decision: null };

      return {
        decision: {
          id: result.pending.id,
          playerId,
          decisionId: result.pending.decisionId,
          triggeredBy: result.pending.triggeredBy,
          createdAt: result.pending.createdAt,
          definition: result.definition,
        },
      };
    }
  );

  // Submit decision choice
  app.post(
    "/api/decisions/choose",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const { decisionId, choice } = request.body as {
        decisionId: string;
        choice: "yes" | "no";
      };

      if (!decisionId || !choice || !["yes", "no"].includes(choice)) {
        return reply.code(400).send({
          error: "Validation",
          message: "decisionId and choice ('yes'/'no') are required",
          statusCode: 400,
        });
      }

      try {
        const result = await resolveDecision(playerId, decisionId, choice);
        return result;
      } catch (err: any) {
        const statusCode = err.statusCode ?? 500;
        return reply.code(statusCode).send({
          error: "Decision Error",
          message: err.message ?? "Failed to resolve decision",
          statusCode,
        });
      }
    }
  );

  // Decision history
  app.get(
    "/api/decisions/history",
    { preHandler: [authGuard] },
    async (request, _reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const decisions = await getDecisionHistory(playerId);
      return { decisions };
    }
  );
}
