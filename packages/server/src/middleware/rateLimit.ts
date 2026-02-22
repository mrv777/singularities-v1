import { redis } from "../db/redis.js";

const DEFAULT_WINDOW_SECONDS = 10;

/**
 * Generic Redis-based rate limiter using sliding-bucket INCR + EXPIRE.
 * Throws a Fastify-style 429 error when the limit is exceeded.
 */
export async function enforceRateLimit(
  identifier: string,
  action: string,
  limit: number,
  windowSeconds: number = DEFAULT_WINDOW_SECONDS
) {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `rl:${action}:${identifier}:${bucket}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds + 1);
  }
  if (count > limit) {
    const err = new Error("Too many requests. Slow down and try again.") as Error & { statusCode: number };
    err.statusCode = 429;
    throw err;
  }
}
