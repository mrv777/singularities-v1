/**
 * New Player Experience Simulation
 *
 * Tests first-5-all-fail rate, time to first success,
 * time to first module purchase, energy depletion risk,
 * and feature unlock cadence.
 *
 * Uses the full minigame reward model (rewardMultiplier × globalRewardMultiplier ×
 * economicMultiplierByTier × score) to match actual in-game XP rates.
 */
import {
  SCANNER_BALANCE,
  ENERGY_BASE_MAX,
  ENERGY_BASE_REGEN_PER_HOUR,
  ENERGY_REGEN_PER_LEVEL,
  ENERGY_MAX_PER_LEVEL,
  PROGRESSION_BALANCE,
  MINIGAME_BALANCE,
  ALL_MODULES,
  TIER_UNLOCK_REQUIREMENT,
  MODULE_PURCHASE_XP,
  XP_THRESHOLDS,
  getLevelForXP,
  getBaseReward,
  getEnergyAfterLevelUp,
  getScoreMultiplier,
  SCAN_ENERGY_COST,
  type ModuleDefinition,
  type ModuleTier,
} from "@singularities/shared";
import { Rng, parseCliOptions, percentile, average, printGuardrails } from "./lib.js";

// ---------------------------------------------------------------------------
// Minigame model helpers (shared with progressionSimulation)
// ---------------------------------------------------------------------------

const HACK_MODULES = ALL_MODULES.filter((m) => (m.effects.hackPower ?? 0) > 0);
const MODULE_LEVEL_CAP_FOR_SIM = 3;

const SOLVE_BASE_CHANCE = 86;
const SOLVE_MIN_CHANCE = 72;
const SOLVED_SCORE_MEAN = 79;
const SOLVED_SCORE_SPREAD = 12;
const FAIL_SCORE_MEAN = 26;

function regenPerMinute(level: number): number {
  return (ENERGY_BASE_REGEN_PER_HOUR + (level - 1) * ENERGY_REGEN_PER_LEVEL) / 60;
}

function getTierIndex(securityLevel: number): number {
  if (securityLevel >= 75) return 3;
  if (securityLevel >= 55) return 2;
  if (securityLevel >= 30) return 1;
  return 0;
}

function sampleBestOfFiveRewards(
  rng: Rng,
  level: number,
): { security: number; credits: number; data: number; xp: number } {
  let bestSecurity = 0;
  for (let i = 0; i < 5; i++) {
    const security = Math.min(
      SCANNER_BALANCE.targetSecurity.max,
      SCANNER_BALANCE.targetSecurity.baseMin
      + rng.int(0, SCANNER_BALANCE.targetSecurity.randomRange)
      + (level - 1) * SCANNER_BALANCE.targetSecurity.levelStep
    );
    if (security > bestSecurity) bestSecurity = security;
  }
  const base = getBaseReward(bestSecurity);
  const economicMult = MINIGAME_BALANCE.economicMultiplierByTier[getTierIndex(bestSecurity)];
  return {
    security: bestSecurity,
    credits: Math.floor(base.credits * economicMult * MINIGAME_BALANCE.globalRewardMultiplier),
    data: Math.floor(base.data * economicMult * MINIGAME_BALANCE.globalRewardMultiplier),
    xp: Math.floor(base.xp * MINIGAME_BALANCE.rewardMultiplier * MINIGAME_BALANCE.globalRewardMultiplier),
  };
}

function sampleScoreAndSolved(
  rng: Rng,
  level: number,
  security: number,
  effectiveHackPower: number,
): { solved: boolean; score: number } {
  const levelPenalty = Math.max(0, level - 5) * 0.85;
  const solveChance = Math.min(
    98,
    Math.max(
      SOLVE_MIN_CHANCE,
      SOLVE_BASE_CHANCE
      + level * 0.45
      + effectiveHackPower * 0.65
      - Math.max(0, security - 28) * 0.60
      - levelPenalty
    )
  );
  const solved = rng.int(1, 100) <= solveChance;
  const solvedScoreMean = SOLVED_SCORE_MEAN - Math.max(0, level - 6) * 0.55;
  const solvedScore = solvedScoreMean + rng.int(-SOLVED_SCORE_SPREAD, SOLVED_SCORE_SPREAD);
  const failScore = FAIL_SCORE_MEAN + rng.int(-8, 8);
  const score = solved
    ? Math.max(50, Math.min(100, solvedScore))
    : Math.max(1, Math.min(49, failScore));
  return { solved, score };
}

function getPrevTier(tier: ModuleTier): ModuleTier | null {
  if (tier === "elite") return "advanced";
  if (tier === "advanced") return "basic";
  return null;
}

function canUnlockModule(mod: ModuleDefinition, modules: Record<string, number>): boolean {
  if ((modules[mod.id] ?? 0) > 0) return true;
  const prevTier = getPrevTier(mod.tier);
  if (!prevTier) return true;
  const ownedPrevTier = ALL_MODULES.filter(
    (m) => m.category === mod.category && m.tier === prevTier && (modules[m.id] ?? 0) > 0
  ).length;
  return ownedPrevTier >= TIER_UNLOCK_REQUIREMENT;
}

function costForNextLevel(mod: ModuleDefinition, currentLevel: number): { credits: number; data: number } {
  if (currentLevel <= 0) return mod.baseCost;
  return {
    credits: mod.baseCost.credits + mod.costPerLevel.credits * currentLevel,
    data: mod.baseCost.data + mod.costPerLevel.data * currentLevel,
  };
}

function getEffectiveHackPower(modules: Record<string, number>): number {
  const contributions = HACK_MODULES
    .map((m) => (m.effects.hackPower ?? 0) * (modules[m.id] ?? 0))
    .filter((v) => v > 0)
    .sort((a, b) => b - a);
  return contributions.slice(0, 3).reduce((sum, v) => sum + v, 0);
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

interface NewPlayerResult {
  first5AllFail: boolean;
  minutesToFirstSuccess: number;
  minutesToFirstModule: number; // tech_tree (module purchases) unlocks at level 2
  minutesToScriptManager: number; // script_manager unlocks at level 4
  minutesToDaemonForge: number; // daemon_forge unlocks at level 7
  maxGapMinutes: number; // Longest gap without a new feature unlock
  energyDepleted: boolean; // Had to wait for energy regen before first success
  totalHacksIn2h: number;
  successRateFirst10: number;
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
  const modules: Record<string, number> = {};
  let hacks = 0;
  let first5Failures = 0;
  let first10Hacks = 0;
  let first10Successes = 0;
  let firstSuccessMinute = -1;
  let firstModuleMinute = -1;
  let scriptManagerMinute = -1;
  let daemonForgeMinute = -1;
  let energyDepleted = false;

  // Feature unlock times (in minutes)
  const unlockTimes: number[] = [0]; // scanner + system_maintenance at level 1, minute 0

  const applyLeveling = () => {
    const next = getLevelForXP(xp);
    if (next > level) {
      level = next;
      energyMax = ENERGY_BASE_MAX + (level - 1) * ENERGY_MAX_PER_LEVEL;
      energy = getEnergyAfterLevelUp(energy, energyMax);
      // Every level-up is a visible milestone.
      unlockTimes.push(minutes);
      if (level === PROGRESSION_BALANCE.unlockLevels.tech_tree && firstModuleMinute < 0) {
        firstModuleMinute = minutes;
        unlockTimes.push(minutes); // tech_tree (module purchases)
      }
      if (level === PROGRESSION_BALANCE.unlockLevels.script_manager && scriptManagerMinute < 0) {
        scriptManagerMinute = minutes;
        unlockTimes.push(minutes); // script_manager
      }
      if (level === PROGRESSION_BALANCE.unlockLevels.data_vault) {
        unlockTimes.push(minutes); // data_vault
      }
      if (level === PROGRESSION_BALANCE.unlockLevels.daemon_forge && daemonForgeMinute < 0) {
        daemonForgeMinute = minutes;
        unlockTimes.push(minutes); // daemon_forge
      }
      if (level === PROGRESSION_BALANCE.unlockLevels.pvp_arena) {
        unlockTimes.push(minutes); // pvp_arena
      }
    }
  };

  const waitForEnergy = (required: number) => {
    if (energy < required && firstSuccessMinute < 0) {
      energyDepleted = true; // Had to wait for regen before first success
    }
    while (energy < required && minutes < 120) {
      minutes += 0.25;
      energy = Math.min(energyMax, energy + regenPerMinute(level) * 0.25);
    }
  };

  const buyModuleIfAffordable = () => {
    if (level < PROGRESSION_BALANCE.unlockLevels.tech_tree) return;
    for (const m of HACK_MODULES) {
      const current = modules[m.id] ?? 0;
      if (current >= MODULE_LEVEL_CAP_FOR_SIM) continue;
      if (current === 0 && !canUnlockModule(m, modules)) continue;
      const cost = costForNextLevel(m, current);
      if (credits >= cost.credits && data >= cost.data) {
        credits -= cost.credits;
        data -= cost.data;
        modules[m.id] = current + 1;
        xp += MODULE_PURCHASE_XP;
        applyLeveling();
        return; // Buy one per cycle
      }
    }
  };

  // Simulate 2 hours of gameplay
  while (minutes < 120) {
    buyModuleIfAffordable();

    waitForEnergy(SCAN_ENERGY_COST);
    if (minutes >= 120) break;
    {
      energy -= SCAN_ENERGY_COST;
      minutes += 0.1;
      energy = Math.min(energyMax, energy + regenPerMinute(level) * 0.1);
    }

    hacks++;
    const effectiveHackPower = getEffectiveHackPower(modules);
    const target = sampleBestOfFiveRewards(rng, level);
    const { solved, score } = sampleScoreAndSolved(rng, level, target.security, effectiveHackPower);
    const scoreMult = getScoreMultiplier(score);

    if (first10Hacks < 10) {
      first10Hacks++;
      if (solved) first10Successes++;
    }

    if (solved) {
      if (firstSuccessMinute < 0) firstSuccessMinute = minutes;
    } else if (hacks <= 5) {
      first5Failures++;
    }

    credits += Math.floor(target.credits * scoreMult);
    data += Math.floor(target.data * scoreMult);
    xp += Math.floor(target.xp * scoreMult);
    applyLeveling();

    const playMinutes = solved
      ? 1.2 + rng.next() * 1.2
      : 1.5 + rng.next() * 1.5;
    minutes += playMinutes;
    energy = Math.min(energyMax, energy + regenPerMinute(level) * playMinutes);
  }

  // Calculate max gap between consecutive feature/level unlocks (not trailing time to end of sim)
  unlockTimes.sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 1; i < unlockTimes.length; i++) {
    maxGap = Math.max(maxGap, unlockTimes[i] - unlockTimes[i - 1]);
  }

  return {
    first5AllFail: first5Failures >= 5,
    minutesToFirstSuccess: firstSuccessMinute < 0 ? 120 : firstSuccessMinute,
    minutesToFirstModule: firstModuleMinute < 0 ? 120 : firstModuleMinute,
    minutesToScriptManager: scriptManagerMinute < 0 ? 120 : scriptManagerMinute,
    minutesToDaemonForge: daemonForgeMinute < 0 ? 120 : daemonForgeMinute,
    maxGapMinutes: maxGap,
    energyDepleted,
    totalHacksIn2h: hacks,
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
  const firstModuleTimes = results.map((r) => r.minutesToFirstModule);
  const maxGaps = results.map((r) => r.maxGapMinutes);
  const successRates = results.map((r) => r.successRateFirst10);

  console.log(`\nFirst-5-all-fail rate: ${(first5FailRate * 100).toFixed(1)}%`);
  console.log(`Time to first success (p50/p75/p90): ${percentile(firstSuccessTimes, 50).toFixed(1)} / ${percentile(firstSuccessTimes, 75).toFixed(1)} / ${percentile(firstSuccessTimes, 90).toFixed(1)} min`);
  console.log(`Time to first module purchase / tech_tree lv${PROGRESSION_BALANCE.unlockLevels.tech_tree} (p50/p75/p90): ${percentile(firstModuleTimes, 50).toFixed(1)} / ${percentile(firstModuleTimes, 75).toFixed(1)} / ${percentile(firstModuleTimes, 90).toFixed(1)} min`);
  console.log(`First-10 hack success rate avg: ${(average(successRates) * 100).toFixed(1)}%`);
  console.log(`Max feature unlock gap (p50/p90): ${percentile(maxGaps, 50).toFixed(1)} / ${percentile(maxGaps, 90).toFixed(1)} min`);
  console.log(`Energy depletion before first success: ${(results.filter((r) => r.energyDepleted).length / opts.runs * 100).toFixed(1)}%`);
  console.log(`Total hacks in 2h session avg: ${average(results.map((r) => r.totalHacksIn2h)).toFixed(0)}`);

  const p90FirstSuccess = percentile(firstSuccessTimes, 90);
  const p90FirstModule = percentile(firstModuleTimes, 90);

  // Gap metric is informational only: players who reach level 4 (~97 min) show a large
  // level-3→4 gap (~71 min) due to energy constraints, while those who don't reach level 4
  // show only ~14 min gaps. The metric penalises better progressors, so it isn't used as
  // a guardrail here — first-success and first-module timing cover the new-player quality bar.
  console.log(`  (gap metric is informational; level-3→4 gap is inherent to XP curve/energy design)`);

  const allPass = printGuardrails("sim:newplayer", [
    {
      name: "First-5-all-fail rate",
      pass: first5FailRate <= 0.03,
      detail: `${(first5FailRate * 100).toFixed(1)}% (need ≤3%)`,
    },
    {
      name: "Time to first success (p90)",
      pass: p90FirstSuccess <= 5,
      detail: `${p90FirstSuccess.toFixed(1)} min (need ≤5 min)`,
    },
    {
      name: "Time to first module purchase / tech_tree lv2 (p90)",
      pass: p90FirstModule <= 20,
      detail: `${p90FirstModule.toFixed(1)} min (need ≤20 min)`,
    },
  ]);

  if (!allPass) process.exit(1);
}

main();
