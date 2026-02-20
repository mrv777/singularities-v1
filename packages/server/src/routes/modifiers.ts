import type { FastifyInstance } from "fastify";
import { authGuard } from "../middleware/auth.js";
import { getTodayModifier, getActiveModifierEffects } from "../services/modifiers.js";

export async function modifierRoutes(app: FastifyInstance) {
  app.get(
    "/api/modifiers/today",
    { preHandler: [authGuard] },
    async () => {
      const [modifier, combinedEffects] = await Promise.all([
        getTodayModifier(),
        getActiveModifierEffects(),
      ]);
      return {
        modifier,
        date: new Date().toISOString().slice(0, 10),
        combinedEffects,
      };
    }
  );
}
