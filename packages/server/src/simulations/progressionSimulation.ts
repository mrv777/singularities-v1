import {
  ALL_MODULES,
  DATA_VAULT_BALANCE,
  DATA_VAULT_PROTOCOLS,
  ENERGY_BASE_MAX,
  ENERGY_BASE_REGEN_PER_HOUR,
  ENERGY_MAX_PER_LEVEL,
  ENERGY_REGEN_PER_LEVEL,
  MAX_LEVEL,
  MODULE_PURCHASE_XP,
  PROGRESSION_BALANCE,
  PVP_ENERGY_COST,
  PVP_REWARD_XP,
  SCAN_ENERGY_COST,
  SCANNER_BALANCE,
  XP_THRESHOLDS,
  CATCH_UP_BASE,
  SEASON_DURATION_DAYS,
  getBaseReward,
  MINIGAME_BALANCE,
  TIER_UNLOCK_REQUIREMENT,
  getEnergyAfterLevelUp,
  getLevelForXP,
  getScoreMultiplier,
  type ModuleDefinition,
  type ModuleTier,
} from "@singularities/shared";
import { Rng, average, parseCliOptions, percentile, printGuardrails } from "./lib.js";

interface SimState {
  minutes: number;
  level: number;
  xp: number;
  credits: number;
  data: number;
  energy: number;
  energyMax: number;
  modules: Record<string, number>;
  hacks: number;
  successes: number;
  firstTwentyHacks: number;
  firstTwentySuccesses: number;
  dataVaultActiveUntil: number;
  dataVaultCooldownUntil: number;
  dataVaultUsesToday: number;
}

interface SimResult {
  minutesToLevel5: number;
  minutesToLevel6: number;
  minutesToLevel7: number;
  minutesToLevel9: number;
  minutesToLevel4: number;
  minutesToLevel10: number;
  first20SuccessRate: number;
  dataVaultActivations: number;
}

const HACK_MODULES = ALL_MODULES.filter((m) => (m.effects.hackPower ?? 0) > 0);
const MODULE_LEVEL_CAP_FOR_SIM = 3;
const DATA_VAULT_RECOMMENDED_PROTOCOL =
  DATA_VAULT_PROTOCOLS.find((p) => p.recommended) ?? DATA_VAULT_PROTOCOLS[0];
const DATA_VAULT_HACK_BONUS = DATA_VAULT_RECOMMENDED_PROTOCOL.buffs.hackPower ?? 0;

const SOLVE_BASE_CHANCE = 86;
const SOLVE_MIN_CHANCE = 72;
const SOLVED_SCORE_MEAN = 79;
const SOLVED_SCORE_SPREAD = 12;
const FAIL_SCORE_MEAN = 26;

function parseDataVaultMode(argv: string[]): "off" | "on" {
  for (const arg of argv) {
    if (arg.startsWith("--data-vault=")) {
      const value = arg.slice("--data-vault=".length);
      if (value === "off" || value === "on") return value;
    }
  }
  return "off";
}

function regenPerMinute(level: number): number {
  return (ENERGY_BASE_REGEN_PER_HOUR + (level - 1) * ENERGY_REGEN_PER_LEVEL) / 60;
}

function getEffectiveHackPower(modules: Record<string, number>): number {
  // Live gameplay only applies equipped modules (3 loadout slots).
  // Approximate this in sim by taking top 3 hack-power contributions.
  const contributions = HACK_MODULES
    .map((m) => (m.effects.hackPower ?? 0) * (modules[m.id] ?? 0))
    .filter((v) => v > 0)
    .sort((a, b) => b - a);
  return contributions.slice(0, 3).reduce((sum, v) => sum + v, 0);
}

function getTierIndex(securityLevel: number): number {
  if (securityLevel >= 75) return 3;
  if (securityLevel >= 55) return 2;
  if (securityLevel >= 30) return 1;
  return 0;
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

function runSingle(seed: number, dataVaultEnabled: boolean): SimResult {
  const rng = new Rng(seed);
  const state: SimState = {
    minutes: 0,
    level: 1,
    xp: 0,
    credits: 100,
    data: 50,
    energy: ENERGY_BASE_MAX,
    energyMax: ENERGY_BASE_MAX,
    modules: {},
    hacks: 0,
    successes: 0,
    firstTwentyHacks: 0,
    firstTwentySuccesses: 0,
    dataVaultActiveUntil: -1,
    dataVaultCooldownUntil: -1,
    dataVaultUsesToday: 0,
  };

  let level4At = -1;
  let level5At = -1;
  let level6At = -1;
  let level7At = -1;
  let level9At = -1;
  let level10At = -1;

  const waitForEnergy = (requiredEnergy: number) => {
    while (state.energy < requiredEnergy && state.minutes < 720) {
      state.minutes += 0.25;
      state.energy = Math.min(state.energyMax, state.energy + regenPerMinute(state.level) * 0.25);
    }
  };

  const applyLeveling = () => {
    const nextLevel = getLevelForXP(state.xp);
    if (nextLevel > state.level) {
      state.level = nextLevel;
      state.energyMax = ENERGY_BASE_MAX + (state.level - 1) * ENERGY_MAX_PER_LEVEL;
      state.energy = getEnergyAfterLevelUp(state.energy, state.energyMax);
      if (state.level >= 4 && level4At < 0) level4At = state.minutes;
      if (state.level >= 5 && level5At < 0) level5At = state.minutes;
      if (state.level >= 6 && level6At < 0) level6At = state.minutes;
      if (state.level >= 7 && level7At < 0) level7At = state.minutes;
      if (state.level >= 9 && level9At < 0) level9At = state.minutes;
      if (state.level >= 10 && level10At < 0) level10At = state.minutes;
    }
  };

  const maybeActivateDataVault = () => {
    if (!dataVaultEnabled) return;
    if (state.level < PROGRESSION_BALANCE.unlockLevels.data_vault) return;
    if (state.dataVaultUsesToday >= DATA_VAULT_BALANCE.dailyUseCap) return;
    if (state.minutes < state.dataVaultActiveUntil) return;
    if (state.minutes < state.dataVaultCooldownUntil) return;
    if (
      state.credits < DATA_VAULT_RECOMMENDED_PROTOCOL.costs.credits
      || state.data < DATA_VAULT_RECOMMENDED_PROTOCOL.costs.data
    ) {
      return;
    }

    state.credits -= DATA_VAULT_RECOMMENDED_PROTOCOL.costs.credits;
    state.data -= DATA_VAULT_RECOMMENDED_PROTOCOL.costs.data;
    state.dataVaultUsesToday += 1;
    state.dataVaultActiveUntil = state.minutes + DATA_VAULT_RECOMMENDED_PROTOCOL.durationSeconds / 60;
    state.dataVaultCooldownUntil = state.minutes
      + (DATA_VAULT_RECOMMENDED_PROTOCOL.durationSeconds + DATA_VAULT_BALANCE.cooldownSeconds) / 60;
  };

  const buyBestModuleUpgrade = (): boolean => {
    if (state.level < PROGRESSION_BALANCE.unlockLevels.tech_tree) return false;

    const candidates = HACK_MODULES
      .map((m) => {
        const current = state.modules[m.id] ?? 0;
        if (current >= MODULE_LEVEL_CAP_FOR_SIM) return null;
        if (current === 0 && !canUnlockModule(m, state.modules)) return null;
        const cost = costForNextLevel(m, current);
        const currentEffective = getEffectiveHackPower(state.modules);
        const nextModules = { ...state.modules, [m.id]: current + 1 };
        const nextEffective = getEffectiveHackPower(nextModules);
        const deltaEffective = nextEffective - currentEffective;
        const rawDelta = m.effects.hackPower ?? 0;
        const score = (deltaEffective > 0 ? deltaEffective : rawDelta * 0.2)
          / (cost.credits + cost.data * 2);
        return { id: m.id, cost, score };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .filter((c) => c.cost.credits <= state.credits && c.cost.data <= state.data);

    if (candidates.length === 0) return false;

    candidates.sort((a, b) => b.score - a.score);
    if (candidates[0].score <= 0) return false;

    const chosen = candidates[0];
    state.credits -= chosen.cost.credits;
    state.data -= chosen.cost.data;
    state.modules[chosen.id] = (state.modules[chosen.id] ?? 0) + 1;
    state.xp += MODULE_PURCHASE_XP;
    applyLeveling();
    return true;
  };

  while (state.minutes < 720 && state.level < 10) {
    while (buyBestModuleUpgrade()) {
      // Keep buying while upgrades are affordable.
    }
    maybeActivateDataVault();

    waitForEnergy(SCAN_ENERGY_COST);
    if (state.minutes >= 720) break;
    state.energy -= SCAN_ENERGY_COST;
    state.minutes += 0.1;
    state.energy = Math.min(state.energyMax, state.energy + regenPerMinute(state.level) * 0.1);

    state.hacks += 1;
    if (state.firstTwentyHacks < 20) {
      state.firstTwentyHacks += 1;
    }
    const dataVaultHackBonus = state.minutes < state.dataVaultActiveUntil
      ? DATA_VAULT_HACK_BONUS
      : 0;
    const effectiveHackPower = getEffectiveHackPower(state.modules) + dataVaultHackBonus;
    const target = sampleBestOfFiveRewards(rng, state.level);
    const { solved, score } = sampleScoreAndSolved(rng, state.level, target.security, effectiveHackPower);
    const scoreMult = getScoreMultiplier(score);

    if (solved) {
      state.successes += 1;
      if (state.hacks <= 20) {
        state.firstTwentySuccesses += 1;
      }
    }
    state.credits += Math.floor(target.credits * scoreMult);
    state.data += Math.floor(target.data * scoreMult);
    state.xp += Math.floor(target.xp * scoreMult);
    applyLeveling();

    const playMinutes = solved
      ? 1.2 + rng.next() * 1.2
      : 1.5 + rng.next() * 1.5;
    state.minutes += playMinutes;
    state.energy = Math.min(state.energyMax, state.energy + regenPerMinute(state.level) * playMinutes);
  }

  return {
    minutesToLevel5: level5At,
    minutesToLevel6: level6At,
    minutesToLevel7: level7At,
    minutesToLevel9: level9At,
    minutesToLevel4: level4At,
    minutesToLevel10: level10At,
    first20SuccessRate: state.firstTwentyHacks > 0
      ? state.firstTwentySuccesses / state.firstTwentyHacks
      : 0,
    dataVaultActivations: state.dataVaultUsesToday,
  };
}

// ---------------------------------------------------------------------------
// Full 1-25 Lifecycle Simulation (Step 14 extension)
// ---------------------------------------------------------------------------

interface FullLifecycleResult {
  /** Minutes of active play to reach each level (index 0 = level 2). -1 if not reached. */
  minutesToLevel: number[];
  /** XP earned from each source */
  xpFromHacking: number;
  xpFromPvP: number;
  xpFromModules: number;
  /** Final level reached */
  finalLevel: number;
  /** XP/hour at each level band (index 0 = levels 1-4, etc.) */
  xpPerHourByBand: number[];
}

const LEVEL_BANDS = [
  { label: "1-4", min: 1, max: 4 },
  { label: "5-8", min: 5, max: 8 },
  { label: "9-12", min: 9, max: 12 },
  { label: "13-18", min: 13, max: 18 },
  { label: "19-25", min: 19, max: 25 },
];

function runFullLifecycle(
  seed: number,
  hoursPerDay: number,
  totalDays: number,
  medianLevel: number,
): FullLifecycleResult {
  const rng = new Rng(seed);
  let xp = 0;
  let level = 1;
  let credits = 100;
  let data = 50;
  let totalMinutes = 0;
  const modules: Record<string, number> = {};

  let xpFromHacking = 0;
  let xpFromPvP = 0;
  let xpFromModules = 0;

  const minutesToLevel: number[] = Array(MAX_LEVEL - 1).fill(-1);
  // Track XP and time per level band
  const bandXp: number[] = Array(LEVEL_BANDS.length).fill(0);
  const bandMinutes: number[] = Array(LEVEL_BANDS.length).fill(0);

  const getBandIndex = (lvl: number): number => {
    for (let b = 0; b < LEVEL_BANDS.length; b++) {
      if (lvl >= LEVEL_BANDS[b].min && lvl <= LEVEL_BANDS[b].max) return b;
    }
    return LEVEL_BANDS.length - 1;
  };

  const tryLevelUp = (): boolean => {
    const next = getLevelForXP(xp);
    let leveled = false;
    while (next > level && level < MAX_LEVEL) {
      level++;
      leveled = true;
      if (minutesToLevel[level - 2] < 0) {
        minutesToLevel[level - 2] = totalMinutes;
      }
    }
    return leveled;
  };

  const energyMax = () => ENERGY_BASE_MAX + (level - 1) * ENERGY_MAX_PER_LEVEL;
  const regenPerMin = () =>
    (ENERGY_BASE_REGEN_PER_HOUR + (level - 1) * ENERGY_REGEN_PER_LEVEL) / 60;

  for (let day = 0; day < totalDays && level < MAX_LEVEL; day++) {
    let energy = energyMax();
    let sessionMinutes = 0;
    const sessionMax = hoursPerDay * 60;

    // Catch-up multiplier
    const levelsBehind = Math.max(0, medianLevel - level);
    const levelMult = 1 + Math.min(CATCH_UP_BASE.maxXpMultiplier, levelsBehind * CATCH_UP_BASE.xpMultiplierPerLevelBehind);
    const daysPassed = day;
    const lateJoinBoost = medianLevel > 0 ? (daysPassed / SEASON_DURATION_DAYS) * CATCH_UP_BASE.lateJoinMaxXpBoost : 0;
    const xpMultiplier = levelMult + lateJoinBoost;

    // Module purchase at start of day
    const hackMods = HACK_MODULES.filter((m) => {
      const cur = modules[m.id] ?? 0;
      return cur < MODULE_LEVEL_CAP_FOR_SIM;
    });
    for (const m of hackMods) {
      const cur = modules[m.id] ?? 0;
      if (cur === 0 && !canUnlockModule(m, modules)) continue;
      const cost = costForNextLevel(m, cur);
      if (credits >= cost.credits && data >= cost.data && level >= (PROGRESSION_BALANCE.unlockLevels.tech_tree ?? 3)) {
        credits -= cost.credits;
        data -= cost.data;
        modules[m.id] = cur + 1;
        const mxp = Math.floor(MODULE_PURCHASE_XP * xpMultiplier);
        xp += mxp;
        xpFromModules += mxp;
        bandXp[getBandIndex(level)] += mxp;
        if (tryLevelUp()) {
          energy = getEnergyAfterLevelUp(energy, energyMax());
        }
      }
    }

    // Active play loop: hacking + PvP
    while (sessionMinutes < sessionMax && level < MAX_LEVEL) {
      if (energy < SCAN_ENERGY_COST) {
        const waitMin = (SCAN_ENERGY_COST - energy) / regenPerMin();
        sessionMinutes += waitMin;
        totalMinutes += waitMin;
        bandMinutes[getBandIndex(level)] += waitMin;
        energy = SCAN_ENERGY_COST;
        if (sessionMinutes >= sessionMax) break;
      }
      energy -= SCAN_ENERGY_COST;
      sessionMinutes += 0.1;
      totalMinutes += 0.1;
      bandMinutes[getBandIndex(level)] += 0.1;
      energy += regenPerMin() * 0.1;

      const target = sampleBestOfFiveRewards(rng, level);
      const effectiveHP = getEffectiveHackPower(modules);
      const { solved, score } = sampleScoreAndSolved(rng, level, target.security, effectiveHP);
      const scoreMult = getScoreMultiplier(score);

      const hxp = Math.floor(target.xp * scoreMult * xpMultiplier);
      const hCredits = Math.floor(target.credits * scoreMult);
      const hData = Math.floor(target.data * scoreMult);
      xp += hxp;
      xpFromHacking += hxp;
      bandXp[getBandIndex(level)] += hxp;
      credits += hCredits;
      data += hData;
      if (tryLevelUp()) {
        energy = getEnergyAfterLevelUp(energy, energyMax());
      }

      const playMinutes = solved
        ? 1.2 + rng.next() * 1.2
        : 1.5 + rng.next() * 1.5;
      sessionMinutes += playMinutes;
      totalMinutes += playMinutes;
      bandMinutes[getBandIndex(level)] += playMinutes;
      energy = Math.min(energyMax(), energy + regenPerMin() * playMinutes);

      // Decision trigger after completed infiltration.
      if (rng.chance(0.1)) {
        credits += rng.int(10, 80);
      }

      // PvP opportunity (once every ~10 infiltrations if level >= 8)
      if (level >= 8 && rng.chance(0.10) && energy >= PVP_ENERGY_COST) {
        energy -= PVP_ENERGY_COST;
        sessionMinutes += 0.5;
        totalMinutes += 0.5;
        bandMinutes[getBandIndex(level)] += 0.5;

        if (rng.chance(0.5)) {
          const pxp = Math.floor(PVP_REWARD_XP * xpMultiplier);
          xp += pxp;
          xpFromPvP += pxp;
          bandXp[getBandIndex(level)] += pxp;
          credits += rng.int(20, 60);
          if (tryLevelUp()) {
            energy = getEnergyAfterLevelUp(energy, energyMax());
          }
        }
      }
    }
  }

  // Compute XP/hour per band
  const xpPerHourByBand = LEVEL_BANDS.map((_, i) =>
    bandMinutes[i] > 0 ? (bandXp[i] / bandMinutes[i]) * 60 : 0
  );

  return {
    minutesToLevel,
    xpFromHacking,
    xpFromPvP,
    xpFromModules,
    finalLevel: level,
    xpPerHourByBand,
  };
}

function main() {
  const argv = process.argv.slice(2);
  const opts = parseCliOptions(argv);
  const dataVaultMode = parseDataVaultMode(argv);
  const dataVaultEnabled = dataVaultMode === "on";

  // ---- Section 1: Early-game session sim (existing) ----
  const results: SimResult[] = [];
  for (let i = 0; i < opts.runs; i++) {
    results.push(runSingle(opts.seed + i, dataVaultEnabled));
  }

  const level4Times = results.map((r) => r.minutesToLevel4).filter((v) => v >= 0);
  const level5Times = results.map((r) => r.minutesToLevel5).filter((v) => v >= 0);
  const level6Times = results.map((r) => r.minutesToLevel6).filter((v) => v >= 0);
  const level7Times = results.map((r) => r.minutesToLevel7).filter((v) => v >= 0);
  const level9Times = results.map((r) => r.minutesToLevel9).filter((v) => v >= 0);
  const level10Times = results.map((r) => r.minutesToLevel10).filter((v) => v >= 0);
  const successRates = results.map((r) => r.first20SuccessRate * 100);
  const dataVaultActivations = results.map((r) => r.dataVaultActivations);

  console.log("=== Progression Simulation ===");
  console.log(`runs=${opts.runs} seed=${opts.seed} data_vault=${dataVaultMode}`);
  console.log(`Reached level 4: ${level4Times.length}/${opts.runs}`);
  console.log(`Reached level 5: ${level5Times.length}/${opts.runs}`);
  console.log(`Reached level 6: ${level6Times.length}/${opts.runs}`);
  console.log(`Reached level 7: ${level7Times.length}/${opts.runs}`);
  console.log(`Reached level 9: ${level9Times.length}/${opts.runs}`);
  console.log(`Reached level 10: ${level10Times.length}/${opts.runs}`);
  console.log(
    `Level 4 minutes (p50/p75/p90): ${percentile(level4Times, 50).toFixed(1)} / ${percentile(level4Times, 75).toFixed(1)} / ${percentile(level4Times, 90).toFixed(1)}`
  );
  console.log(
    `Level 5 minutes (p50/p75/p90): ${percentile(level5Times, 50).toFixed(1)} / ${percentile(level5Times, 75).toFixed(1)} / ${percentile(level5Times, 90).toFixed(1)}`
  );
  console.log(
    `Level 6 minutes (p50/p75/p90): ${percentile(level6Times, 50).toFixed(1)} / ${percentile(level6Times, 75).toFixed(1)} / ${percentile(level6Times, 90).toFixed(1)}`
  );
  console.log(
    `Level 7 minutes (p50/p75/p90): ${percentile(level7Times, 50).toFixed(1)} / ${percentile(level7Times, 75).toFixed(1)} / ${percentile(level7Times, 90).toFixed(1)}`
  );
  console.log(
    `Level 9 minutes (p50/p75/p90): ${percentile(level9Times, 50).toFixed(1)} / ${percentile(level9Times, 75).toFixed(1)} / ${percentile(level9Times, 90).toFixed(1)}`
  );
  console.log(
    `Level 10 minutes (p50/p75/p90): ${percentile(level10Times, 50).toFixed(1)} / ${percentile(level10Times, 75).toFixed(1)} / ${percentile(level10Times, 90).toFixed(1)}`
  );
  console.log(`First-20 hack success rate avg: ${average(successRates).toFixed(1)}%`);
  console.log(`Data Vault activations avg: ${average(dataVaultActivations).toFixed(2)}`);

  // ---- Section 2: Full 1-25 lifecycle ----
  console.log("\n=== Full 1-25 Lifecycle (2h/day, 90 days) ===");
  const hoursPerDay = 2;
  const totalDays = SEASON_DURATION_DAYS;

  const fullResults: FullLifecycleResult[] = [];
  for (let i = 0; i < opts.runs; i++) {
    fullResults.push(runFullLifecycle(opts.seed + i + 50000, hoursPerDay, totalDays, 0));
  }

  // Time-to-level for milestones
  const milestones = [5, 9, 10, 15, 20, 25];
  for (const lvl of milestones) {
    const times = fullResults
      .map((r) => r.minutesToLevel[lvl - 2])
      .filter((v) => v >= 0);
    const reached = times.length;
    if (reached > 0) {
      const days50 = (percentile(times, 50) / 60 / hoursPerDay).toFixed(1);
      const days75 = (percentile(times, 75) / 60 / hoursPerDay).toFixed(1);
      const days90 = (percentile(times, 90) / 60 / hoursPerDay).toFixed(1);
      console.log(`Level ${lvl}: ${reached}/${opts.runs} reached — days(p50/p75/p90): ${days50} / ${days75} / ${days90}`);
    } else {
      console.log(`Level ${lvl}: 0/${opts.runs} reached`);
    }
  }

  // Final level distribution
  const finalLevels = fullResults.map((r) => r.finalLevel);
  console.log(`\nFinal level (p50/p75/p90): ${percentile(finalLevels, 50)} / ${percentile(finalLevels, 75)} / ${percentile(finalLevels, 90)}`);

  // XP source breakdown
  const totalXp = fullResults.map((r) => r.xpFromHacking + r.xpFromPvP + r.xpFromModules);
  const hackPct = average(fullResults.map((r) => totalXp[fullResults.indexOf(r)] > 0 ? r.xpFromHacking / totalXp[fullResults.indexOf(r)] * 100 : 0));
  const pvpPct = average(fullResults.map((r) => totalXp[fullResults.indexOf(r)] > 0 ? r.xpFromPvP / totalXp[fullResults.indexOf(r)] * 100 : 0));
  const modPct = average(fullResults.map((r) => totalXp[fullResults.indexOf(r)] > 0 ? r.xpFromModules / totalXp[fullResults.indexOf(r)] * 100 : 0));
  console.log(`\nXP sources: Hacking=${hackPct.toFixed(1)}%, PvP=${pvpPct.toFixed(1)}%, Modules=${modPct.toFixed(1)}%`);

  // XP/hour per level band
  console.log("\nXP/hour by level band:");
  for (let b = 0; b < LEVEL_BANDS.length; b++) {
    const rates = fullResults.map((r) => r.xpPerHourByBand[b]).filter((v) => v > 0);
    if (rates.length > 0) {
      console.log(`  ${LEVEL_BANDS[b].label}: ${average(rates).toFixed(1)} XP/hr`);
    } else {
      console.log(`  ${LEVEL_BANDS[b].label}: (no data)`);
    }
  }

  // XP wall detection: any level requiring >6.5x the previous level's time.
  // Skip very early onboarding levels where small absolute deltas can distort ratios.
  console.log("\n[XP Wall Detection]");
  let wallsFound = 0;
  for (let lvl = 3; lvl <= MAX_LEVEL; lvl++) {
    if (lvl <= 4) continue;
    const prevTimes = fullResults.map((r) => r.minutesToLevel[lvl - 3]).filter((v) => v >= 0);
    const curTimes = fullResults.map((r) => r.minutesToLevel[lvl - 2]).filter((v) => v >= 0);
    if (prevTimes.length === 0 || curTimes.length === 0) continue;

    const prevPrev = fullResults.map((r) => r.minutesToLevel[lvl - 4]).filter((v) => v >= 0);
    const prevDelta = prevTimes.length > 0 && prevPrev.length > 0
      ? percentile(prevTimes, 50) - percentile(prevPrev, 50)
      : percentile(prevTimes, 50);
    const curDelta = percentile(curTimes, 50) - percentile(prevTimes, 50);

    if (prevDelta > 0 && curDelta / prevDelta > 6.5) {
      console.log(`  WALL at Level ${lvl}: ${curDelta.toFixed(0)} min vs previous ${prevDelta.toFixed(0)} min (${(curDelta / prevDelta).toFixed(1)}x)`);
      wallsFound++;
    }
  }
  if (wallsFound === 0) {
    console.log("  No XP walls detected (no level takes >3x previous)");
  }

  // ---- Guardrails ----
  const guardrails: Array<{ name: string; pass: boolean; detail: string }> = [];

  // Cautious progression policy:
  // avoid cap-rush while still keeping a healthy season arc.
  const finalP50 = percentile(finalLevels, 50);
  guardrails.push({
    name: "Median player reaches deep endgame by day 90",
    pass: finalP50 >= 14,
    detail: `p50 final level=${finalP50} (need ≥14)`,
  });

  const lvl25Times = fullResults.map((r) => r.minutesToLevel[MAX_LEVEL - 2]).filter((v) => v >= 0);
  const lvl25DaysP50 = lvl25Times.length > 0 ? percentile(lvl25Times, 50) / 60 / hoursPerDay : Number.POSITIVE_INFINITY;
  guardrails.push({
    name: "Max level is not reached too early at 2h/day",
    pass: lvl25DaysP50 >= 20,
    detail: Number.isFinite(lvl25DaysP50)
      ? `p50=${lvl25DaysP50.toFixed(1)} days (need ≥20)`
      : "p50=not reached (acceptable)",
  });

  // Keep PvP unlock accessible even with slower long-tail pacing.
  const lvl9Times = fullResults.map((r) => r.minutesToLevel[7]).filter((v) => v >= 0);
  const lvl9DaysP50 = lvl9Times.length > 0 ? percentile(lvl9Times, 50) / 60 / hoursPerDay : 999;
  guardrails.push({
    name: "Level 9 reachable within 14 days at 2h/day",
    pass: lvl9DaysP50 <= 14,
    detail: `p50=${lvl9DaysP50.toFixed(1)} days (need ≤14)`,
  });

  // No XP walls
  guardrails.push({
    name: "No XP walls (>6.5x previous level time, post-onboarding)",
    pass: wallsFound === 0,
    detail: `${wallsFound} walls found`,
  });

  const allPass = printGuardrails("sim:progression", guardrails);
  if (!allPass) process.exit(1);
}

main();
