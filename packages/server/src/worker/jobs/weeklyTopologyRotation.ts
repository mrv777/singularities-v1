import { acquireLock, releaseLock } from "../lock.js";
import { getCurrentTopology, generateWeeklyTopology } from "../../services/topology.js";

const LOCK_KEY = "worker:weekly_topology";
const LOCK_TTL = 60_000;

export async function runWeeklyTopologyRotation(): Promise<void> {
  const token = await acquireLock(LOCK_KEY, LOCK_TTL);
  if (!token) return;

  try {
    const existing = await getCurrentTopology();
    if (!existing) {
      await generateWeeklyTopology();
      console.log("[worker] Generated weekly topology");
    }
  } finally {
    await releaseLock(LOCK_KEY, token);
  }
}
