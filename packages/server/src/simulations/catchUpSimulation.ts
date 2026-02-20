/**
 * Catch-up Mechanics Simulation
 *
 * Tests convergence for late joiners, max achievable level,
 * and checks for perverse incentives.
 */
import {
  XP_THRESHOLDS,
  MAX_LEVEL,
  CATCH_UP_BASE,
  SEASON_DURATION_DAYS,
  SCANNER_BALANCE,
  PVP_REWARD_XP,
  getLevelForXP,
  getBaseReward,
  getEarlyHackSuccessFloor,
} from "@singularities/shared";
import { Rng, parseCliOptions, percentile, average, printGuardrails } from "./lib.js";

interface PlayerProgress {
  day: number;
  level: number;
  xp: number;
}

function xpPerHour(level: number, rng: Rng, xpMultiplier: number): number {
  let xp = 0;
  const hacksPerHour = 6;
  for (let h = 0; h < hacksPerHour; h++) {
    const security = Math.min(
      SCANNER_BALANCE.targetSecurity.max,
      SCANNER_BALANCE.targetSecurity.baseMin
      + rng.int(0, SCANNER_BALANCE.targetSecurity.randomRange)
      + (level - 1) * SCANNER_BALANCE.targetSecurity.levelStep
    );
    const hackPower = 6 + level * 2;
    const chance = Math.max(
      getEarlyHackSuccessFloor(level),
      Math.min(SCANNER_BALANCE.hackSuccess.maxChance, SCANNER_BALANCE.hackSuccess.baseChance + (hackPower - security))
    );
    if (rng.int(1, 100) <= chance) {
      const reward = getBaseReward(security);
      xp += Math.floor(reward.xp * xpMultiplier);
    }
  }
  // PvP XP (1-2 matches per hour while active, unlocks at level 8)
  if (level >= 8 && rng.chance(0.3)) {
    xp += Math.floor(PVP_REWARD_XP * xpMultiplier);
  }
  return xp;
}

function simulatePlayer(
  seed: number,
  joinDay: number,
  hoursPerDay: number,
  medianLevel: number // Current day-1 player's level for catch-up calc
): PlayerProgress[] {
  const rng = new Rng(seed);
  let xp = 0;
  let level = 1;
  const progress: PlayerProgress[] = [];

  for (let day = joinDay; day < SEASON_DURATION_DAYS; day++) {
    // Catch-up multiplier
    const levelsBehind = Math.max(0, medianLevel - level);
    const levelMultiplier = 1 + Math.min(CATCH_UP_BASE.maxXpMultiplier, levelsBehind * CATCH_UP_BASE.xpMultiplierPerLevelBehind);
    const daysPassed = day;
    const lateJoinBoost = (daysPassed / SEASON_DURATION_DAYS) * CATCH_UP_BASE.lateJoinMaxXpBoost;
    const xpMultiplier = levelMultiplier + lateJoinBoost;

    for (let h = 0; h < hoursPerDay; h++) {
      xp += xpPerHour(level, rng, xpMultiplier);
      level = getLevelForXP(xp);
    }

    progress.push({ day, level, xp });
  }

  return progress;
}

function main() {
  const opts = parseCliOptions(process.argv.slice(2));
  console.log("=== Catch-up Mechanics Simulation ===");
  console.log(`runs=${opts.runs} seed=${opts.seed}`);

  const guardrails: Array<{ name: string; pass: boolean; detail: string }> = [];
  const hoursPerDay = 2;

  // -- Simulate day-1 players as baseline --
  console.log("\n[Day-1 Player Baseline]");
  const day1Results: PlayerProgress[][] = [];
  for (let i = 0; i < opts.runs; i++) {
    day1Results.push(simulatePlayer(opts.seed + i, 0, hoursPerDay, 0));
  }

  // Get median level at each checkpoint
  const day30Levels = day1Results.map((r) => {
    const entry = r.find((p) => p.day >= 30);
    return entry?.level ?? 1;
  });
  const day60Levels = day1Results.map((r) => {
    const entry = r.find((p) => p.day >= 60);
    return entry?.level ?? 1;
  });
  const day90Levels = day1Results.map((r) => {
    const entry = r[r.length - 1];
    return entry?.level ?? 1;
  });

  const medianDay30 = percentile(day30Levels, 50);
  const medianDay60 = percentile(day60Levels, 50);
  const medianDay90 = percentile(day90Levels, 50);

  console.log(`Day 30 level (p50): ${medianDay30}`);
  console.log(`Day 60 level (p50): ${medianDay60}`);
  console.log(`Day 90 level (p50): ${medianDay90}`);

  // -- Day 30 joiner --
  console.log("\n[Day-30 Joiner]");
  const day30JoinResults: PlayerProgress[][] = [];
  for (let i = 0; i < opts.runs; i++) {
    day30JoinResults.push(simulatePlayer(opts.seed + i + 10000, 30, hoursPerDay, medianDay30));
  }

  const day30JoinFinalLevels = day30JoinResults.map((r) => r[r.length - 1]?.level ?? 1);
  // Days to reach 80% of day-1 median
  const targetLevel80 = Math.floor(medianDay90 * 0.8);
  const daysToConverge30: number[] = [];
  for (const progress of day30JoinResults) {
    const entry = progress.find((p) => p.level >= targetLevel80);
    if (entry) daysToConverge30.push(entry.day - 30);
    else daysToConverge30.push(60);
  }

  const p50Converge30 = percentile(daysToConverge30, 50);
  console.log(`Final level (p50): ${percentile(day30JoinFinalLevels, 50)}`);
  console.log(`Days to reach 80% of day-1 median (p50): ${p50Converge30}`);

  guardrails.push({
    name: "Day 30 joiner reaches 80% median within 40 days",
    pass: p50Converge30 <= 40,
    detail: `p50=${p50Converge30} days (need ≤40)`,
  });

  // -- Day 60 joiner --
  console.log("\n[Day-60 Joiner]");
  const day60JoinResults: PlayerProgress[][] = [];
  for (let i = 0; i < opts.runs; i++) {
    day60JoinResults.push(simulatePlayer(opts.seed + i + 20000, 60, hoursPerDay, medianDay60));
  }

  const day60JoinFinalLevels = day60JoinResults.map((r) => r[r.length - 1]?.level ?? 1);
  const p50Day60Final = percentile(day60JoinFinalLevels, 50);
  console.log(`Final level (p50): ${p50Day60Final}`);

  guardrails.push({
    name: "Day 60 joiner reaches Level 9+ by season end",
    pass: p50Day60Final >= 9,
    detail: `p50=${p50Day60Final} (need ≥9)`,
  });

  // -- Perverse incentive check --
  console.log("\n[Perverse Incentive Check]");
  const day1XpAt90 = day1Results.map((r) => r[r.length - 1]?.xp ?? 0);
  const day60XpAt90 = day60JoinResults.map((r) => r[r.length - 1]?.xp ?? 0);
  const day1AvgXp = average(day1XpAt90);
  const day60AvgXp = average(day60XpAt90);
  // Day-1 players always accumulate more total XP (90 days vs 30 days).
  const lateJoinerBetter = day60AvgXp > day1AvgXp;
  // Rate check: day-60 joiners should have a higher XP/day to verify boost is active.
  const day1DaysPlayed = SEASON_DURATION_DAYS; // 90 days
  const day60DaysPlayed = SEASON_DURATION_DAYS - 60; // 30 days
  const day1XpRate = day1AvgXp / day1DaysPlayed;
  const day60XpRate = day60AvgXp / day60DaysPlayed;
  const boostIsActive = day60XpRate > day1XpRate;
  console.log(`Day 1 avg XP at season end: ${day1AvgXp.toFixed(0)} (${day1XpRate.toFixed(1)} XP/day)`);
  console.log(`Day 60 avg XP at season end: ${day60AvgXp.toFixed(0)} (${day60XpRate.toFixed(1)} XP/day)`);
  console.log(`Late joining has higher XP rate? ${boostIsActive}`);

  guardrails.push({
    name: "Late joining never better in total XP than Day 1",
    pass: !lateJoinerBetter,
    detail: `day1=${day1AvgXp.toFixed(0)} vs day60=${day60AvgXp.toFixed(0)}`,
  });

  guardrails.push({
    name: "Day-60 joiner XP rate exceeds Day-1 (catch-up boost active)",
    pass: boostIsActive,
    detail: `day60=${day60XpRate.toFixed(1)} XP/day vs day1=${day1XpRate.toFixed(1)} XP/day`,
  });

  const allPass = printGuardrails("sim:catchup", guardrails);
  if (!allPass) process.exit(1);
}

main();
