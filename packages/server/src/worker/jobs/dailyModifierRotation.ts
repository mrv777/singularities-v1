import { acquireLock, releaseLock } from "../lock.js";
import { getTodayModifier } from "../../services/modifiers.js";

const LOCK_KEY = "worker:daily_modifier_rotation";
const LOCK_TTL = 30_000; // 30 sec

export async function runDailyModifierRotation(): Promise<void> {
  const token = await acquireLock(LOCK_KEY, LOCK_TTL);
  if (!token) return;

  try {
    // Lazy-creates today's modifier if it doesn't exist
    await getTodayModifier();
  } finally {
    await releaseLock(LOCK_KEY, token);
  }
}
