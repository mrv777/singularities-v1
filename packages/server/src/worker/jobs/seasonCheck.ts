import { acquireLock, releaseLock } from "../lock.js";
import { getCurrentSeason, endSeason } from "../../services/seasons.js";

const LOCK_KEY = "worker:season_check";
const LOCK_TTL = 60_000;

export async function runSeasonCheck(): Promise<void> {
  const token = await acquireLock(LOCK_KEY, LOCK_TTL);
  if (!token) return;

  try {
    const season = await getCurrentSeason();
    if (season && new Date(season.endsAt) <= new Date()) {
      await endSeason();
      console.log(`[worker] Season "${season.name}" has ended`);
    }
  } finally {
    await releaseLock(LOCK_KEY, token);
  }
}
