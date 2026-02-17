import { runCascadeTick } from "./jobs/cascadeTick.js";
import { runHeatDecay } from "./jobs/heatDecay.js";
import { runScriptExecution } from "./jobs/scriptExecution.js";
import { runDailyModifierRotation } from "./jobs/dailyModifierRotation.js";
import { runArenaReset } from "./jobs/arenaReset.js";
import { runDeathCheck } from "./jobs/deathCheck.js";
import { runNftTransferCheck } from "./jobs/nftTransferCheck.js";
import { runWeeklyTopologyRotation } from "./jobs/weeklyTopologyRotation.js";
import { runWorldEventGeneration } from "./jobs/worldEventGeneration.js";
import { runSeasonCheck } from "./jobs/seasonCheck.js";

const intervals: NodeJS.Timeout[] = [];

function scheduleJob(name: string, fn: () => Promise<void>, intervalMs: number) {
  // Run once on startup (with delay to let server finish booting)
  setTimeout(async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`[worker] ${name} initial run failed:`, err);
    }
  }, 5_000);

  // Then schedule recurring
  const id = setInterval(async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`[worker] ${name} failed:`, err);
    }
  }, intervalMs);

  intervals.push(id);
}

export function startWorker(): void {
  console.log("[worker] Starting background worker...");

  scheduleJob("cascadeTick", runCascadeTick, 30 * 60 * 1000);       // Every 30 min
  scheduleJob("heatDecay", runHeatDecay, 60 * 60 * 1000);           // Every 60 min
  scheduleJob("scriptExecution", runScriptExecution, 15 * 60 * 1000); // Every 15 min
  scheduleJob("dailyModifierRotation", runDailyModifierRotation, 60 * 60 * 1000); // Every hour
  scheduleJob("arenaReset", runArenaReset, 60 * 60 * 1000);                       // Every hour
  scheduleJob("deathCheck", runDeathCheck, 30 * 60 * 1000);                       // Every 30 min
  scheduleJob("nftTransferCheck", runNftTransferCheck, 60 * 60 * 1000);           // Every hour
  scheduleJob("weeklyTopologyRotation", runWeeklyTopologyRotation, 60 * 60 * 1000); // Every hour
  scheduleJob("worldEventGeneration", runWorldEventGeneration, 60 * 60 * 1000);     // Every hour
  scheduleJob("seasonCheck", runSeasonCheck, 60 * 60 * 1000);                       // Every hour

  console.log("[worker] Background worker started with 10 jobs.");
}

export function stopWorker(): void {
  for (const id of intervals) {
    clearInterval(id);
  }
  intervals.length = 0;
  console.log("[worker] Background worker stopped.");
}
