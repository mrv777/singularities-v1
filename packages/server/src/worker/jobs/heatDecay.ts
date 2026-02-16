import { query } from "../../db/pool.js";
import { acquireLock, releaseLock } from "../lock.js";
import { getActiveModifierEffects } from "../../services/modifiers.js";

const LOCK_KEY = "worker:heat_decay";
const LOCK_TTL = 60_000; // 1 min

export async function runHeatDecay(): Promise<void> {
  const token = await acquireLock(LOCK_KEY, LOCK_TTL);
  if (!token) return;

  try {
    const effects = await getActiveModifierEffects();
    const decayAmount = Math.round(1 * (effects.heatDecayMultiplier ?? 1));

    await query(
      `UPDATE players SET heat_level = GREATEST(0, heat_level - $1) WHERE heat_level > 0`,
      [decayAmount]
    );
  } finally {
    await releaseLock(LOCK_KEY, token);
  }
}
