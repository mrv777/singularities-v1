import { acquireLock, releaseLock } from "../lock.js";
import {
  getCurrentSeason,
  endSeason,
  createSeason,
  getLastEndedSeason,
} from "../../services/seasons.js";

const LOCK_KEY = "worker:season_check";
const LOCK_TTL = 60_000;

export async function runSeasonCheck(): Promise<void> {
  const token = await acquireLock(LOCK_KEY, LOCK_TTL);
  if (!token) return;

  try {
    const season = await getCurrentSeason();

    if (season && new Date(season.endsAt) <= new Date()) {
      // Season expired naturally
      await endSeason(false);
      console.log(`[worker] Season "${season.name}" has ended (natural expiry)`);
    }

    if (!season || new Date(season.endsAt) <= new Date()) {
      // No active season — check if we should auto-create
      const last = await getLastEndedSeason();

      if (last?.adminEnded) {
        // Admin ended the last season — wait for manual creation
        return;
      }

      // Either no previous season (first boot) or natural expiry → create
      const newSeason = await createSeason();
      console.log(`[worker] Auto-created "${newSeason.name}"`);
    }
  } finally {
    await releaseLock(LOCK_KEY, token);
  }
}
