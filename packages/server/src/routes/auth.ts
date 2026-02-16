import type { FastifyInstance } from "fastify";
import {
  createChallenge,
  verifySignature,
  findOrCreatePlayer,
} from "../services/auth.js";

export async function authRoutes(app: FastifyInstance) {
  // Step 1: Request a challenge nonce
  app.post<{
    Body: { walletAddress: string };
  }>("/api/auth/challenge", async (request, reply) => {
    const walletAddress = request.body?.walletAddress;
    if (!walletAddress || typeof walletAddress !== "string") {
      return reply
        .code(400)
        .send({ error: "Bad Request", message: "walletAddress is required", statusCode: 400 });
    }

    const challenge = await createChallenge(walletAddress);
    return challenge;
  });

  // Step 2: Verify the signed message and issue JWT
  app.post<{
    Body: { walletAddress: string; signature: string; nonce: string };
  }>("/api/auth/verify", async (request, reply) => {
    const walletAddress = request.body?.walletAddress;
    const signature = request.body?.signature;
    const nonce = request.body?.nonce;

    if (!walletAddress || !signature || !nonce) {
      return reply.code(400).send({
        error: "Bad Request",
        message: "walletAddress, signature, and nonce are required",
        statusCode: 400,
      });
    }

    const valid = await verifySignature(walletAddress, signature, nonce);
    if (!valid) {
      return reply
        .code(401)
        .send({ error: "Unauthorized", message: "Invalid signature", statusCode: 401 });
    }

    const player = await findOrCreatePlayer(walletAddress);
    const token = app.jwt.sign(
      { sub: player.id, wallet: walletAddress },
      { expiresIn: "7d" }
    );

    return { token, player };
  });
}
