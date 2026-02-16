import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import {
  getScripts,
  createScript,
  activateScript,
  deleteScript,
  ScriptError,
} from "../services/scripts.js";

export async function scriptRoutes(app: FastifyInstance) {
  app.get(
    "/api/scripts",
    { preHandler: [authGuard] },
    async (request) => {
      const { sub: playerId } = request.user as AuthPayload;
      const scripts = await getScripts(playerId);
      return { scripts };
    }
  );

  app.post(
    "/api/scripts",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const { triggerCondition, action } = request.body as {
        triggerCondition: string;
        action: string;
      };

      if (!triggerCondition || !action) {
        return reply.code(400).send({
          error: "Validation",
          message: "triggerCondition and action are required",
          statusCode: 400,
        });
      }

      try {
        const script = await createScript(playerId, triggerCondition, action);
        return script;
      } catch (err) {
        if (err instanceof ScriptError) {
          return reply.code(err.statusCode).send({
            error: "Script Error",
            message: err.message,
            statusCode: err.statusCode,
          });
        }
        throw err;
      }
    }
  );

  app.put(
    "/api/scripts/:id/activate",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const { id: scriptId } = request.params as { id: string };

      try {
        const script = await activateScript(playerId, scriptId);
        return script;
      } catch (err) {
        if (err instanceof ScriptError) {
          return reply.code(err.statusCode).send({
            error: "Script Error",
            message: err.message,
            statusCode: err.statusCode,
          });
        }
        throw err;
      }
    }
  );

  app.delete(
    "/api/scripts/:id",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const { id: scriptId } = request.params as { id: string };

      try {
        await deleteScript(playerId, scriptId);
        return { success: true };
      } catch (err) {
        if (err instanceof ScriptError) {
          return reply.code(err.statusCode).send({
            error: "Script Error",
            message: err.message,
            statusCode: err.statusCode,
          });
        }
        throw err;
      }
    }
  );
}
