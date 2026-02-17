import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import {
  getCurrentSeason,
  getSeasonLeaderboard,
  getPlayerRank,
} from "../services/seasons.js";

export async function seasonRoutes(app: FastifyInstance) {
  // Get current season info
  app.get(
    "/api/seasons/current",
    { preHandler: [authGuard] },
    async (_request, _reply) => {
      const season = await getCurrentSeason();
      const daysRemaining = season
        ? Math.max(0, Math.ceil((new Date(season.endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;
      return { season, daysRemaining };
    }
  );

  // Get season leaderboard
  app.get(
    "/api/seasons/leaderboard",
    { preHandler: [authGuard] },
    async (request, _reply) => {
      const { sub: playerId } = request.user as AuthPayload;
      const leaderboard = await getSeasonLeaderboard(20);
      const playerRank = await getPlayerRank(playerId);
      return { leaderboard, playerRank };
    }
  );
}
