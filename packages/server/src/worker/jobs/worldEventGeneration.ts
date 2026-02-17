import { acquireLock, releaseLock } from "../lock.js";
import { analyzeAndGenerateRipples } from "../../services/worldEvents.js";

const LOCK_KEY = "worker:world_events";
const LOCK_TTL = 60_000;

export async function runWorldEventGeneration(): Promise<void> {
  const token = await acquireLock(LOCK_KEY, LOCK_TTL);
  if (!token) return;

  try {
    const events = await analyzeAndGenerateRipples();
    if (events.length > 0) {
      console.log(`[worker] Generated ${events.length} world event(s)`);
    }
  } finally {
    await releaseLock(LOCK_KEY, token);
  }
}
