import { query } from "../../db/pool.js";
import { acquireLock, releaseLock } from "../lock.js";

const LOCK_KEY = "worker:arena_reset";
const LOCK_TTL = 60_000; // 1 min

export async function runArenaReset(): Promise<void> {
  const token = await acquireLock(LOCK_KEY, LOCK_TTL);
  if (!token) return;

  try {
    const hour = new Date().getUTCHours();

    // At midnight UTC (hour 0): reset all arena participation
    // Redis PvP tracking keys (pvp_attacks_received, pvp_damage_received) are set
    // with 24h TTL and expire naturally — no manual cleanup needed.
    if (hour === 0) {
      const result = await query(
        "UPDATE players SET in_pvp_arena = false WHERE in_pvp_arena = true"
      );
      console.log(`[arenaReset] Reset ${result.rowCount} players' arena status.`);
    }
  } finally {
    await releaseLock(LOCK_KEY, token);
  }
}
