import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import { getCurrentTopology } from "../services/topology.js";
import { getActiveWorldEvents } from "../services/worldEvents.js";
import { getNetworkStats } from "../services/networkStats.js";

export async function worldRoutes(app: FastifyInstance) {
  // Get current weekly topology
  app.get(
    "/api/world/topology",
    { preHandler: [authGuard] },
    async (_request, _reply) => {
      const topology = await getCurrentTopology();
      return { topology };
    }
  );

  // Get active world events today
  app.get(
    "/api/world/events",
    { preHandler: [authGuard] },
    async (_request, _reply) => {
      const events = await getActiveWorldEvents();
      return { events };
    }
  );

  // Get network statistics
  app.get(
    "/api/world/stats",
    { preHandler: [authGuard] },
    async (_request, _reply) => {
      const stats = await getNetworkStats();
      return { stats };
    }
  );
}
