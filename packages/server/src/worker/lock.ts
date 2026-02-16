import { redis } from "../db/redis.js";
import crypto from "node:crypto";

/**
 * Acquire a distributed lock using Redis SET NX EX.
 * Returns a token string if acquired (used to release), or null if not.
 */
export async function acquireLock(key: string, ttlMs: number): Promise<string | null> {
  const token = crypto.randomUUID();
  const ttlSeconds = Math.ceil(ttlMs / 1000);
  const result = await redis.set(`lock:${key}`, token, "EX", ttlSeconds, "NX");
  return result === "OK" ? token : null;
}

/**
 * Release a distributed lock (only if we own it via matching token).
 */
export async function releaseLock(key: string, token: string): Promise<void> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, `lock:${key}`, token);
}
