import type { FastifyRequest, FastifyReply } from "fastify";
import type { AuthPayload } from "./auth.js";

const ADMIN_PLAYER_IDS = new Set(
  (process.env.ADMIN_PLAYER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

export async function adminGuard(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as AuthPayload;
  if (!ADMIN_PLAYER_IDS.has(user.sub)) {
    reply.code(403).send({
      error: "Forbidden",
      message: "Admin access required",
      statusCode: 403,
    });
  }
}
