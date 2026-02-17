import type { FastifyRequest, FastifyReply } from "fastify";

export interface AuthPayload {
  sub: string; // player id
  wallet: string;
}

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({
      error: "Unauthorized",
      message: "Invalid or missing token",
      statusCode: 401,
    });
  }
}
