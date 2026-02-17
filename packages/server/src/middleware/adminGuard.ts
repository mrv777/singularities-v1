import type { FastifyRequest, FastifyReply } from "fastify";
import type { AuthPayload } from "./auth.js";
import { env } from "../lib/env.js";
import { query } from "../db/pool.js";

const ADMIN_PLAYER_IDS = new Set(
  env.ADMIN_PLAYER_IDS
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);
const ADMIN_WALLET_ADDRESSES = new Set(
  env.ADMIN_WALLET_ADDRESSES
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

export async function adminGuard(request: FastifyRequest, reply: FastifyReply) {
  if (!env.ADMIN_ENABLED) {
    return reply.code(404).send({
      error: "Not Found",
      message: "Admin endpoints are disabled",
      statusCode: 404,
    });
  }

  const user = request.user as AuthPayload;
  const playerRes = await query(
    "SELECT wallet_address FROM players WHERE id = $1",
    [user.sub]
  );
  const walletAddress = playerRes.rows[0]?.wallet_address as string | undefined;
  if (!walletAddress || walletAddress !== user.wallet) {
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Stale or invalid admin token",
      statusCode: 401,
    });
  }

  const byPlayerId = ADMIN_PLAYER_IDS.has(user.sub);
  const byTokenWallet = ADMIN_WALLET_ADDRESSES.has(user.wallet);
  const byCurrentWallet = ADMIN_WALLET_ADDRESSES.has(walletAddress);

  if (!byPlayerId && !byTokenWallet && !byCurrentWallet) {
    return reply.code(403).send({
      error: "Forbidden",
      message: "Admin access required",
      statusCode: 403,
    });
  }
}
