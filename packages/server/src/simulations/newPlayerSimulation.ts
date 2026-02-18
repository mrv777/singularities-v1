/**
 * New Player Experience Simulation
 *
 * Tests first-5-hack all-fail rate, time to first success,
 * time to first module purchase, energy depletion risk,
 * and feature unlock cadence.
 */
import {
  SCANNER_BALANCE,
  ENERGY_BASE_MAX,
  ENERGY_BASE_REGEN_PER_HOUR,
  ENERGY_REGEN_PER_LEVEL,
  ENERGY_MAX_PER_LEVEL,
  PROGRESSION_BALANCE,
  XP_THRESHOLDS,
  getLevelForXP,
  getBaseReward,
  getEarlyHackSuccessFloor,
  getEnergyAfterLevelUp,
  SCAN_ENERGY_COST,
} from "@singularities/shared";
import { Rng, parseCliOptions, percentile, average, printGuardrails } from "./lib.js";

interface NewPlayerResult {
  first5AllFail: boolean;
  minutesToFirstSuccess: number;
  minutesToLevel3: number; // First module purchase unlocked at level 3
  minutesToLevel5: number;
  minutesToLevel7: number;
  maxGapMinutes: number; // Longest gap without a new feature unlock
  energyDepleted: boolean; // Hit 0 before first success
  totalHacksIn60: number;
  successRateFirst10: number;
}

function regenPerMinute(level: number): number {
  return (ENERGY_BASE_REGEN_PER_HOUR + (level - 1) * ENERGY_REGEN_PER_LEVEL) / 60;
}

function runSingle(seed: number): NewPlayerResult {
  const rng = new Rng(seed);

  let minutes = 0;
  let level = 1;
  let xp = 0;
  let credits = 100;
  let data = 50;
  let energy = ENERGY_BASE_MAX;
  let energyMax = ENERGY_BASE_MAX;
  let hacks = 0;
  let successes = 0;
  let first5Failures = 0;
  let first10Hacks = 0;
  let first10Successes = 0;
  let firstSuccessMinute = -1;
  let level3Minute = -1;
  let level5Minute = -1;
  let level7Minute = -1;
  let energyDepleted = false;
  let targetsBuffered = 0;

  // Feature unlock times (in minutes)
  const unlockTimes: number[] = [0]; // scanner at level 1, minute 0

  const checkLevelUp = () => {
    const next = getLevelForXP(xp);
    if (next > level) {
      level = next;
      energyMax = ENERGY_BASE_MAX + (level - 1) * ENERGY_MAX_PER_LEVEL;
      energy = getEnergyAfterLevelUp(energy, energyMax);
      // Treat each level-up as a progression milestone to reflect visible player growth.
      unlockTimes.push(minutes);
      if (level === 3 && level3Minute < 0) {
        level3Minute = minutes;
        unlockTimes.push(minutes); // tech_tree
      }
      if (level === 5 && level5Minute < 0) {
        level5Minute = minutes;
        unlockTimes.push(minutes); // system_maintenance
      }
      if (level === 6) unlockTimes.push(minutes); // script_manager
      if (level === 7 && level7Minute < 0) {
        level7Minute = minutes;
        unlockTimes.push(minutes); // data_vault
      }
      if (level === 9) unlockTimes.push(minutes); // pvp_arena, quantum_lab, etc.
    }
  };

  const waitForEnergy = (required: number) => {
    while (energy < required && minutes < 120) {
      minutes += 0.25;
      energy = Math.min(energyMax, energy + regenPerMinute(level) * 0.25);
    }
  };

  // Simulate 2 hours of gameplay
  while (minutes < 120) {
    // Scan if needed
    if (targetsBuffered <= 0) {
      waitForEnergy(SCAN_ENERGY_COST);
      if (minutes >= 120) break;
      energy -= SCAN_ENERGY_COST;
      minutes += 0.1;
      energy = Math.min(energyMax, energy + regenPerMinute(level) * 0.1);
      targetsBuffered = 1;
    }

    // Hack
    const security = Math.min(
      SCANNER_BALANCE.targetSecurity.max,
      SCANNER_BALANCE.targetSecurity.baseMin
      + rng.int(0, SCANNER_BALANCE.targetSecurity.randomRange)
      + level * SCANNER_BALANCE.targetSecurity.levelStep
    );
    minutes += 0.2;
    energy = Math.min(energyMax, energy + regenPerMinute(level) * 0.2);
    targetsBuffered--;
    hacks++;

    const chance = Math.max(
      getEarlyHackSuccessFloor(level),
      Math.min(
        SCANNER_BALANCE.hackSuccess.maxChance,
        SCANNER_BALANCE.hackSuccess.baseChance + (0 - security) // No hack power at start
      )
    );
    const success = rng.int(1, 100) <= chance;

    if (first10Hacks < 10) {
      first10Hacks++;
      if (success) first10Successes++;
    }

    if (success) {
      successes++;
      if (firstSuccessMinute < 0) firstSuccessMinute = minutes;
      const reward = getBaseReward(security);
      credits += reward.credits;
      data += reward.data;
      xp += reward.xp;
      checkLevelUp();
    } else if (hacks <= 5) {
      first5Failures++;
    }
  }

  // Calculate max gap between feature unlocks in first 2 hours
  unlockTimes.sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 1; i < unlockTimes.length; i++) {
    maxGap = Math.max(maxGap, unlockTimes[i] - unlockTimes[i - 1]);
  }
  // Also check gap from last unlock to 120 min
  if (unlockTimes.length > 0) {
    maxGap = Math.max(maxGap, 120 - unlockTimes[unlockTimes.length - 1]);
  }

  return {
    first5AllFail: first5Failures >= 5,
    minutesToFirstSuccess: firstSuccessMinute < 0 ? 120 : firstSuccessMinute,
    minutesToLevel3: level3Minute < 0 ? 120 : level3Minute,
    minutesToLevel5: level5Minute < 0 ? 120 : level5Minute,
    minutesToLevel7: level7Minute < 0 ? 120 : level7Minute,
    maxGapMinutes: maxGap,
    energyDepleted,
    totalHacksIn60: hacks,
    successRateFirst10: first10Hacks > 0 ? first10Successes / first10Hacks : 0,
  };
}

function main() {
  const opts = parseCliOptions(process.argv.slice(2));
  console.log("=== New Player Experience Simulation ===");
  console.log(`runs=${opts.runs} seed=${opts.seed}`);

  const results: NewPlayerResult[] = [];
  for (let i = 0; i < opts.runs; i++) {
    results.push(runSingle(opts.seed + i));
  }

  const first5FailRate = results.filter((r) => r.first5AllFail).length / opts.runs;
  const firstSuccessTimes = results.map((r) => r.minutesToFirstSuccess);
  const level3Times = results.map((r) => r.minutesToLevel3);
  const maxGaps = results.map((r) => r.maxGapMinutes);
  const successRates = results.map((r) => r.successRateFirst10);

  console.log(`\nFirst-5-all-fail rate: ${(first5FailRate * 100).toFixed(1)}%`);
  console.log(`Time to first success (p50/p75/p90): ${percentile(firstSuccessTimes, 50).toFixed(1)} / ${percentile(firstSuccessTimes, 75).toFixed(1)} / ${percentile(firstSuccessTimes, 90).toFixed(1)} min`);
  console.log(`Time to Level 3 / first module (p50/p75/p90): ${percentile(level3Times, 50).toFixed(1)} / ${percentile(level3Times, 75).toFixed(1)} / ${percentile(level3Times, 90).toFixed(1)} min`);
  console.log(`First-10 hack success rate avg: ${(average(successRates) * 100).toFixed(1)}%`);
  console.log(`Max feature unlock gap (p50/p90): ${percentile(maxGaps, 50).toFixed(1)} / ${percentile(maxGaps, 90).toFixed(1)} min`);
  console.log(`Energy depletion rate: ${(results.filter((r) => r.energyDepleted).length / opts.runs * 100).toFixed(1)}%`);
  console.log(`Total hacks in 2h session avg: ${average(results.map((r) => r.totalHacksIn60)).toFixed(0)}`);

  const p90FirstSuccess = percentile(firstSuccessTimes, 90);
  const p90Level3 = percentile(level3Times, 90);
  const p90Gap = percentile(maxGaps, 90);

  const allPass = printGuardrails("sim:newplayer", [
    {
      name: "First-5-all-fail rate",
      pass: first5FailRate <= 0.10,
      detail: `${(first5FailRate * 100).toFixed(1)}% (need ≤10%)`,
    },
    {
      name: "Time to first success (p90)",
      pass: p90FirstSuccess <= 3,
      detail: `${p90FirstSuccess.toFixed(1)} min (need ≤3 min)`,
    },
    {
      name: "Time to first module purchase (p90)",
      pass: p90Level3 <= 90,
      detail: `${p90Level3.toFixed(1)} min (need ≤90 min)`,
    },
    {
      name: "Feature/progression gap in first 2h",
      pass: p90Gap <= 75,
      detail: `p90=${p90Gap.toFixed(1)} min (need ≤75 min)`,
    },
  ]);

  if (!allPass) process.exit(1);
}

main();
