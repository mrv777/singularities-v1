/**
 * Energy Budget Simulation
 *
 * Tests actions per session, time to deplete, optimal action chains,
 * and the impact of energy efficiency modules and modifiers.
 */
import {
  ENERGY_BASE_MAX,
  ENERGY_BASE_REGEN_PER_HOUR,
  ENERGY_MAX_PER_LEVEL,
  ENERGY_REGEN_PER_LEVEL,
  ENERGY_COSTS,
  SCAN_ENERGY_COST,
  PVP_ENERGY_COST,
} from "@singularities/shared";
import { Rng, parseCliOptions, percentile, average, printGuardrails } from "./lib.js";

interface SessionResult {
  level: number;
  sessionMinutes: number;
  totalActions: number;
  hackActions: number;
  pvpActions: number;
  downtimeMinutes: number;
  downtimeRatio: number;
  energyCostMultiplier: number;
}

function regenPerMinute(level: number): number {
  return (ENERGY_BASE_REGEN_PER_HOUR + (level - 1) * ENERGY_REGEN_PER_LEVEL) / 60;
}

function runSession(
  seed: number,
  level: number,
  sessionMinutes: number,
  mode: "hack_only" | "mixed" | "pvp_heavy",
  energyCostMultiplier: number
): SessionResult {
  const rng = new Rng(seed);
  const energyMax = ENERGY_BASE_MAX + (level - 1) * ENERGY_MAX_PER_LEVEL;
  let energy = energyMax;
  let minutes = 0;
  let hackActions = 0;
  let pvpActions = 0;
  let downtime = 0;
  let targetsBuffered = 0;

  while (minutes < sessionMinutes) {
    // Decide action based on mode
    let wantPvP = false;
    if (mode === "mixed") {
      wantPvP = rng.chance(0.2) && pvpActions < 3;
    } else if (mode === "pvp_heavy") {
      wantPvP = rng.chance(0.4) && pvpActions < 5;
    }

    if (wantPvP) {
      const pvpCost = Math.ceil(PVP_ENERGY_COST * energyCostMultiplier);
      if (energy >= pvpCost) {
        energy -= pvpCost;
        minutes += 0.5;
        energy = Math.min(energyMax, energy + regenPerMinute(level) * 0.5);
        pvpActions++;
        continue;
      }
    }

    // Scan if needed
    if (targetsBuffered <= 0) {
      const scanCost = Math.ceil(SCAN_ENERGY_COST * energyCostMultiplier);
      if (energy < scanCost) {
        // Wait for regen
        const needed = scanCost - energy;
        const waitMin = needed / regenPerMinute(level);
        minutes += waitMin;
        downtime += waitMin;
        energy = scanCost;
        if (minutes >= sessionMinutes) break;
      }
      energy -= Math.ceil(SCAN_ENERGY_COST * energyCostMultiplier);
      minutes += 0.1;
      energy = Math.min(energyMax, energy + regenPerMinute(level) * 0.1);
      targetsBuffered = 1;
    }

    minutes += 0.2;
    energy = Math.min(energyMax, energy + regenPerMinute(level) * 0.2);
    targetsBuffered--;
    hackActions++;
  }

  const totalActions = hackActions + pvpActions;
  return {
    level,
    sessionMinutes,
    totalActions,
    hackActions,
    pvpActions,
    downtimeMinutes: downtime,
    downtimeRatio: downtime / sessionMinutes,
    energyCostMultiplier,
  };
}

function main() {
  const opts = parseCliOptions(process.argv.slice(2));
  console.log("=== Energy Budget Simulation ===");
  console.log(`runs=${opts.runs} seed=${opts.seed}`);

  const levels = [1, 5, 10, 15, 20, 25];
  const sessionDurations = [15, 30, 60];
  const guardrailChecks: Array<{ name: string; pass: boolean; detail: string }> = [];

  for (const duration of sessionDurations) {
    console.log(`\n--- ${duration}-min session ---`);

    for (const level of levels) {
      const results: SessionResult[] = [];
      for (let i = 0; i < opts.runs; i++) {
        results.push(runSession(opts.seed + i, level, duration, "hack_only", 1));
      }

      const avgActions = average(results.map((r) => r.totalActions));
      const avgDowntime = average(results.map((r) => r.downtimeRatio));

      console.log(`Level ${level}: ${avgActions.toFixed(0)} actions, ${(avgDowntime * 100).toFixed(1)}% downtime`);

      if (duration === 30) {
        guardrailChecks.push({
          name: `Actions per 30-min session (Level ${level})`,
          pass: avgActions >= 15,
          detail: `${avgActions.toFixed(0)} (need ≥15)`,
        });
        guardrailChecks.push({
          name: `Downtime ratio (Level ${level}, 30 min)`,
          pass: avgDowntime <= 0.55,
          detail: `${(avgDowntime * 100).toFixed(1)}% (need ≤55%)`,
        });
      }
    }
  }

  // Mixed session PvP affordability check
  console.log("\n--- Mixed session PvP affordability ---");
  for (const level of levels) {
    const results: SessionResult[] = [];
    for (let i = 0; i < opts.runs; i++) {
      results.push(runSession(opts.seed + i + 50000, level, 30, "mixed", 1));
    }
    const avgPvP = average(results.map((r) => r.pvpActions));
    const avgTotal = average(results.map((r) => r.totalActions));
    console.log(`Level ${level}: ${avgPvP.toFixed(1)} PvP + ${(avgTotal - avgPvP).toFixed(0)} hacks`);

    guardrailChecks.push({
      name: `PvP affordability (Level ${level}, 30 min mixed)`,
      pass: avgPvP >= 2,
      detail: `${avgPvP.toFixed(1)} PvP attacks (need ≥2)`,
    });
  }

  // Blackout Protocol stress test (1.3x energy costs)
  console.log("\n--- Blackout Protocol (1.3x energy) ---");
  for (const level of [1, 10, 25]) {
    const results: SessionResult[] = [];
    for (let i = 0; i < opts.runs; i++) {
      results.push(runSession(opts.seed + i + 60000, level, 30, "hack_only", 1.3));
    }
    const avgActions = average(results.map((r) => r.totalActions));
    console.log(`Level ${level}: ${avgActions.toFixed(0)} actions (30 min, 1.3x cost)`);
  }

  const allPass = printGuardrails("sim:energy", guardrailChecks);
  if (!allPass) process.exit(1);
}

main();
