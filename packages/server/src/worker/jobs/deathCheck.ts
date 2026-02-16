import { query } from "../../db/pool.js";
import { acquireLock, releaseLock } from "../lock.js";
import { executeDeath } from "../../services/death.js";
import { DEATH_CORRUPTED_COUNT } from "@singularities/shared";

const LOCK_KEY = "worker:death_check";
const LOCK_TTL = 120_000; // 2 min

export async function runDeathCheck(): Promise<void> {
  const token = await acquireLock(LOCK_KEY, LOCK_TTL);
  if (!token) return;

  try {
    // Find alive players with 3+ CORRUPTED systems
    const res = await query(
      `SELECT ps.player_id, COUNT(*) as corrupted_count
       FROM player_systems ps
       JOIN players p ON p.id = ps.player_id
       WHERE ps.status = 'CORRUPTED'
         AND p.is_alive = true
       GROUP BY ps.player_id
       HAVING COUNT(*) >= $1`,
      [DEATH_CORRUPTED_COUNT]
    );

    for (const row of res.rows) {
      const playerId = row.player_id as string;
      try {
        await executeDeath(playerId);
        console.log(`[deathCheck] Player ${playerId} died (${row.corrupted_count} corrupted systems).`);
      } catch (err) {
        console.error(`[deathCheck] Failed to process death for ${playerId}:`, err);
      }
    }

    if (res.rows.length > 0) {
      console.log(`[deathCheck] Processed ${res.rows.length} player death(s).`);
    }
  } finally {
    await releaseLock(LOCK_KEY, token);
  }
}
