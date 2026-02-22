import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import { adminGuard } from "../middleware/adminGuard.js";
import { env } from "../lib/env.js";
import {
  getAdminOverview,
  getArenaBotPreview,
  getArenaBotsEnabled,
  getEconomyOverview,
  getPlayerDetail,
  grantResources,
  recordAdminAction,
  searchPlayers,
  setArenaBotsEnabled,
} from "../services/admin.js";
import { endSeason, createSeason, getCurrentSeason } from "../services/seasons.js";

function extractMeta(request: { ip: string; headers: Record<string, unknown> }) {
  const rawUa = request.headers["user-agent"];
  const userAgent = typeof rawUa === "string" ? rawUa.slice(0, 500) : null;
  return {
    ipAddress: request.ip ?? null,
    userAgent,
  };
}

export async function adminRoutes(app: FastifyInstance) {
  app.get(
    "/api/admin/status",
    { preHandler: [authGuard, adminGuard] },
    async (request) => {
      const user = request.user as AuthPayload;
      return {
        adminEnabled: env.ADMIN_ENABLED,
        isAdmin: true as const,
        actor: {
          playerId: user.sub,
          walletAddress: user.wallet,
        },
        serverTime: new Date().toISOString(),
      };
    }
  );

  app.get(
    "/api/admin/overview",
    { preHandler: [authGuard, adminGuard] },
    async () => {
      return getAdminOverview();
    }
  );

  app.get(
    "/api/admin/bots/preview",
    { preHandler: [authGuard, adminGuard] },
    async (request, reply) => {
      const user = request.user as AuthPayload;
      const levelRaw = (request.query as { level?: string }).level;
      const level = Number(levelRaw ?? 12);
      if (!Number.isFinite(level)) {
        return reply.code(400).send({
          error: "Validation",
          message: "level must be numeric",
          statusCode: 400,
        });
      }
      return getArenaBotPreview(level, user.sub);
    }
  );

  app.post(
    "/api/admin/bots/enabled",
    { preHandler: [authGuard, adminGuard] },
    async (request, reply) => {
      const user = request.user as AuthPayload;
      const body = (request.body ?? {}) as { enabled?: boolean; note?: string };
      if (typeof body.enabled !== "boolean") {
        return reply.code(400).send({
          error: "Validation",
          message: "enabled(boolean) is required",
          statusCode: 400,
        });
      }

      await setArenaBotsEnabled(
        body.enabled,
        user.sub,
        body.note?.slice(0, 300) ?? null,
        extractMeta(request)
      );
      const enabled = await getArenaBotsEnabled(true);
      return { success: true, enabled };
    }
  );

  app.post(
    "/api/admin/season/end",
    { preHandler: [authGuard, adminGuard] },
    async (request, reply) => {
      const user = request.user as AuthPayload;
      const body = (request.body ?? {}) as { confirmation?: string; reason?: string };
      if (body.confirmation !== "END SEASON") {
        return reply.code(400).send({
          error: "Validation",
          message: "confirmation must be exactly 'END SEASON'",
          statusCode: 400,
        });
      }

      try {
        await endSeason(true);
        await recordAdminAction(
          user.sub,
          "season_end_forced",
          { reason: body.reason?.slice(0, 300) ?? null },
          extractMeta(request)
        );
        return { success: true };
      } catch (err: any) {
        return reply.code(500).send({
          error: "Season Error",
          message: err.message ?? "Failed to end season",
          statusCode: 500,
        });
      }
    }
  );

  app.post(
    "/api/admin/season/start",
    { preHandler: [authGuard, adminGuard] },
    async (request, reply) => {
      const user = request.user as AuthPayload;
      const body = (request.body ?? {}) as { name?: string };

      // Don't allow starting a season if one is already active
      const current = await getCurrentSeason();
      if (current) {
        return reply.code(409).send({
          error: "Conflict",
          message: "A season is already active",
          statusCode: 409,
        });
      }

      try {
        const season = await createSeason(body.name?.slice(0, 64) || undefined);
        await recordAdminAction(
          user.sub,
          "season_start",
          { seasonId: season.id, seasonName: season.name },
          extractMeta(request)
        );
        return { success: true, season };
      } catch (err: any) {
        return reply.code(500).send({
          error: "Season Error",
          message: err.message ?? "Failed to start season",
          statusCode: 500,
        });
      }
    }
  );

  // --- Player Lookup ---

  app.get(
    "/api/admin/players/search",
    { preHandler: [authGuard, adminGuard] },
    async (request, reply) => {
      const q = (request.query as { q?: string }).q?.trim();
      if (!q) {
        return reply.code(400).send({
          error: "Validation",
          message: "q query param is required",
          statusCode: 400,
        });
      }
      return searchPlayers(q);
    }
  );

  app.get(
    "/api/admin/players/:id",
    { preHandler: [authGuard, adminGuard] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const detail = await getPlayerDetail(id);
      if (!detail) {
        return reply.code(404).send({
          error: "Not Found",
          message: "Player not found",
          statusCode: 404,
        });
      }
      return detail;
    }
  );

  app.post(
    "/api/admin/players/:id/grant",
    { preHandler: [authGuard, adminGuard] },
    async (request, reply) => {
      const user = request.user as AuthPayload;
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as {
        credits?: number;
        data?: number;
        processingPower?: number;
        xp?: number;
        reason?: string;
      };

      if (!body.reason?.trim()) {
        return reply.code(400).send({
          error: "Validation",
          message: "reason is required",
          statusCode: 400,
        });
      }

      try {
        return await grantResources(
          id,
          {
            credits: body.credits,
            data: body.data,
            processingPower: body.processingPower,
            xp: body.xp,
          },
          user.sub,
          body.reason.trim(),
          extractMeta(request)
        );
      } catch (err: any) {
        const msg = err.message ?? "Failed to grant resources";
        const code = msg === "Player not found" ? 404 : 400;
        return reply.code(code).send({
          error: code === 404 ? "Not Found" : "Grant Error",
          message: msg,
          statusCode: code,
        });
      }
    }
  );

  // --- Economy Dashboard ---

  app.get(
    "/api/admin/economy",
    { preHandler: [authGuard, adminGuard] },
    async () => {
      return getEconomyOverview();
    }
  );
}
