/**
 * Inflation Analysis Simulation
 *
 * Tracks a full 90-day season day-by-day for 5 archetypes, focusing on:
 * - Daily income vs spending
 * - Module purchase progression (basic → advanced → elite)
 * - Mutation attempts (once modules reach max level)
 * - Cumulative surplus (running total of unspent credits)
 * - Sink exhaustion timeline (what day each tier completes)
 * - Post-completion net (average daily surplus after all one-time sinks exhausted)
 * - Inflation inflection point (day when remaining sinks can't absorb remaining season income)
 */
import {
  ALL_MODULES,
  SCANNER_BALANCE,
  MINIGAME_BALANCE,
  PASSIVE_CREDITS_PER_HOUR,
  PASSIVE_DATA_PER_HOUR,
  PASSIVE_MAX_HOURS,
  PVP_REWARD_CREDITS_MIN,
  PVP_REWARD_CREDITS_MAX,
  PVP_REWARD_CREDITS_LEVEL_BONUS,
  PVP_REWARD_CREDITS_STEAL_PCT_MIN,
  PVP_REWARD_CREDITS_STEAL_PCT_MAX,
  PVP_BALANCE,
  DATA_VAULT_BALANCE,
  DATA_VAULT_PROTOCOLS,
  MUTATION_COST,
  MUTATION_SUCCESS_RATE,
  MAX_MODULE_LEVEL,
  ICE_BREAKER_BALANCE,
  DECISION_BALANCE,
  ALL_DECISIONS,
  ENERGY_BASE_MAX,
  ENERGY_BASE_REGEN_PER_HOUR,
  ENERGY_REGEN_PER_LEVEL,
  ENERGY_MAX_PER_LEVEL,
  ENERGY_COSTS,
  SCAN_ENERGY_COST,
  PVP_ENERGY_COST,
  PROGRESSION_BALANCE,
  MODULE_PURCHASE_XP,
  getBaseReward,
  getScoreMultiplier,
  getRepairCreditCostForHealth,
  getLevelForXP,
  getDecisionResourceCap,
  TIER_UNLOCK_LEVEL,
  MUTATION_ELIGIBLE_TIERS,
} from "@singularities/shared";
import { Rng, average, parseCliOptions, percentile, printGuardrails } from "./lib.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ArchetypeId = "cautious_pve" | "mixed" | "aggressive_pvp" | "idle_logger" | "marathon_grinder";

interface InflationArchetype {
  id: ArchetypeId;
  hoursPerDay: number;
  hacksPerHour: number;
  pvpPerDay: number;
  icePerDay: number;
  vaultPerDay: number;
  winBias: number;
  profitBias: number;
}

interface ModuleState {
  id: string;
  tier: "basic" | "advanced" | "elite";
  category: string;
  level: number;
  maxLevel: number;
  baseCost: { credits: number; data: number };
  costPerLevel: { credits: number; data: number };
  dependencies: string[];
  mutated: boolean;
}

interface DaySnapshot {
  day: number;
  grossIncome: number;
  recurringSpend: number;
  moduleSpend: number;
  mutationSpend: number;
  netCredits: number;
  cumulativeSurplus: number;
  modulesMaxed: number;
  totalModules: number;
  level: number;
}

interface RunResult {
  dayAllModulesMaxed: number | null;
  inflectionDay: number | null;
  day90Surplus: number;
  day90Data: number;
  hacksPerDay: number;
  pvpPerDay: number;
  grossIncomePerDay: number;
  recurringPerDay: number;
  moduleSpendPerDay: number;
  postCompletionSurplusPerDay: number;
  snapshots: DaySnapshot[];
}

// ---------------------------------------------------------------------------
// Archetype definitions (extended with playtime)
// ---------------------------------------------------------------------------

const ARCHETYPES: InflationArchetype[] = [
  { id: "cautious_pve",    hoursPerDay: 2, hacksPerHour: 6,  pvpPerDay: 0,  icePerDay: 1, vaultPerDay: 1, winBias: 0,    profitBias: 0.3 },
  { id: "mixed",           hoursPerDay: 3, hacksPerHour: 5,  pvpPerDay: 6,  icePerDay: 2, vaultPerDay: 2, winBias: 0.05, profitBias: 0.55 },
  { id: "aggressive_pvp",  hoursPerDay: 3, hacksPerHour: 3,  pvpPerDay: 12, icePerDay: 1, vaultPerDay: 1, winBias: 0.12, profitBias: 0.8 },
  { id: "idle_logger",     hoursPerDay: 1, hacksPerHour: 3,  pvpPerDay: 0,  icePerDay: 0, vaultPerDay: 0, winBias: 0,    profitBias: 0.2 },
  { id: "marathon_grinder", hoursPerDay: 5, hacksPerHour: 10, pvpPerDay: 4,  icePerDay: 3, vaultPerDay: 2, winBias: 0.08, profitBias: 0.6 },
];

// ---------------------------------------------------------------------------
// Economy profile (reused from economySimulation pattern)
// ---------------------------------------------------------------------------

const ECONOMY_PROFILE = {
  securityBaseMin: SCANNER_BALANCE.targetSecurity.baseMin,
  securityStep: SCANNER_BALANCE.targetSecurity.levelStep,
  solveBaseChance: 86,
  solveMinChance: 72,
  solvedScoreMean: 79,
  solvedScoreSpread: 12,
  failScoreMean: 26,
};

const DATA_VAULT_RECOMMENDED =
  DATA_VAULT_PROTOCOLS.find((p) => p.recommended) ?? DATA_VAULT_PROTOCOLS[0];

// ---------------------------------------------------------------------------
// Module sink computation
// ---------------------------------------------------------------------------

function computeModuleCostToMax(mod: typeof ALL_MODULES[number]): { credits: number; data: number } {
  let credits = 0;
  let data = 0;
  for (let lvl = 0; lvl < mod.maxLevel; lvl++) {
    if (lvl === 0) {
      credits += mod.baseCost.credits;
      data += mod.baseCost.data;
    } else {
      credits += mod.baseCost.credits + mod.costPerLevel.credits * lvl;
      data += mod.baseCost.data + mod.costPerLevel.data * lvl;
    }
  }
  return { credits, data };
}

function computeUpgradeCost(mod: ModuleState): { credits: number; data: number } | null {
  if (mod.level >= mod.maxLevel) return null;
  const lvl = mod.level;
  if (lvl === 0) return { credits: mod.baseCost.credits, data: mod.baseCost.data };
  return {
    credits: mod.baseCost.credits + mod.costPerLevel.credits * lvl,
    data: mod.baseCost.data + mod.costPerLevel.data * lvl,
  };
}

function depsUnlocked(mod: ModuleState, modules: ModuleState[]): boolean {
  if (mod.dependencies.length === 0) return true;
  // Need 2 of 3 dependencies at TIER_UNLOCK_LEVEL (max level)
  let unlocked = 0;
  for (const depId of mod.dependencies) {
    const dep = modules.find((m) => m.id === depId);
    if (dep && dep.level >= TIER_UNLOCK_LEVEL) unlocked++;
  }
  return unlocked >= 2;
}

// Total module sink pool
const TOTAL_MODULE_SINK = ALL_MODULES.reduce((sum, m) => sum + computeModuleCostToMax(m).credits, 0);

// Total mutation sink pool (advanced+ modules only × cost per attempt, expected ~1.54 attempts per module at 65%)
const EXPECTED_MUTATION_ATTEMPTS_PER_MODULE = 1 / MUTATION_SUCCESS_RATE;
const MUTATION_ELIGIBLE_MODULES = ALL_MODULES.filter(
  (m) => MUTATION_ELIGIBLE_TIERS.includes(m.tier as "advanced" | "elite")
);
const TOTAL_MUTATION_SINK = MUTATION_ELIGIBLE_MODULES.length * MUTATION_COST.credits * EXPECTED_MUTATION_ATTEMPTS_PER_MODULE;

// ---------------------------------------------------------------------------
// Hack income simulation (from economySimulation pattern)
// ---------------------------------------------------------------------------

function getTierIndex(securityLevel: number): number {
  if (securityLevel >= 75) return 3;
  if (securityLevel >= 55) return 2;
  if (securityLevel >= 30) return 1;
  return 0;
}

function sampleSecurityFromScan(rng: Rng, level: number, profitBias: number): number {
  const options: number[] = [];
  for (let i = 0; i < 5; i++) {
    const security = Math.min(
      SCANNER_BALANCE.targetSecurity.max,
      ECONOMY_PROFILE.securityBaseMin
      + rng.int(0, SCANNER_BALANCE.targetSecurity.randomRange)
      + (level - 1) * ECONOMY_PROFILE.securityStep
    );
    options.push(security);
  }
  options.sort((a, b) => a - b);
  return rng.chance(profitBias) ? options[4] : rng.pick(options);
}

function sampleSolveAndScore(
  rng: Rng,
  level: number,
  security: number,
  effectiveHackPower: number,
  profitBias: number,
): { solved: boolean; score: number } {
  const levelPenalty = Math.max(0, level - 5) * 0.85;
  const solveChance = Math.min(
    98,
    Math.max(
      ECONOMY_PROFILE.solveMinChance,
      ECONOMY_PROFILE.solveBaseChance
      + level * 0.45
      + effectiveHackPower * 0.65
      - Math.max(0, security - 28) * 0.60
      - levelPenalty
    )
  );
  const solved = rng.int(1, 100) <= solveChance;
  const solvedScoreMean = ECONOMY_PROFILE.solvedScoreMean - Math.max(0, level - 6) * 0.55 + profitBias * 2;
  const solvedScore = solvedScoreMean + rng.int(-ECONOMY_PROFILE.solvedScoreSpread, ECONOMY_PROFILE.solvedScoreSpread);
  const failScore = ECONOMY_PROFILE.failScoreMean + rng.int(-8, 8);
  const score = solved
    ? Math.max(50, Math.min(100, solvedScore))
    : Math.max(1, Math.min(49, failScore));
  return { solved, score };
}

function simulateHackIncome(
  rng: Rng,
  level: number,
  profitBias: number,
  dataVaultActive: boolean,
): { credits: number; data: number; xp: number; repairEvents: number } {
  const security = sampleSecurityFromScan(rng, level, profitBias);
  const dataVaultHackBonus = dataVaultActive ? (DATA_VAULT_RECOMMENDED.buffs.hackPower ?? 0) : 0;
  const effectiveHackPower = 8 + level * 2.2 + Math.floor(profitBias * 5) + dataVaultHackBonus;
  const { solved, score } = sampleSolveAndScore(rng, level, security, effectiveHackPower, profitBias);

  const rewards = getBaseReward(security);
  const economicMult = MINIGAME_BALANCE.economicMultiplierByTier[getTierIndex(security)];
  const scoreMult = getScoreMultiplier(score);

  const credits = Math.floor(
    rewards.credits * economicMult * scoreMult * MINIGAME_BALANCE.globalRewardMultiplier
  );
  const data = Math.floor(
    rewards.data * economicMult * scoreMult * MINIGAME_BALANCE.globalRewardMultiplier
  );
  const xp = Math.floor(
    rewards.xp * MINIGAME_BALANCE.rewardMultiplier * scoreMult * MINIGAME_BALANCE.globalRewardMultiplier
  );

  // Detection → repair event
  let repairEvents = 0;
  if (score < 50) {
    const detectionMult = score >= 25 ? 0.5 : 1.0;
    const activeDetectChance = Math.max(5, Math.min(95, security * 0.6 * detectionMult));
    if (rng.int(1, 100) <= activeDetectChance) repairEvents++;
  } else {
    const stealthProxy = 6 + Math.floor(profitBias * 6) + Math.floor(level / 5);
    const residual = Math.max(0,
      (security - SCANNER_BALANCE.residualDetection.securityThreshold)
      * SCANNER_BALANCE.residualDetection.securityScale
      - stealthProxy / SCANNER_BALANCE.residualDetection.stealthDivisor
    );
    if (residual > 0 && rng.int(1, 100) <= residual) repairEvents++;
  }
  if (!solved) repairEvents++;

  return { credits, data, xp, repairEvents };
}

// ---------------------------------------------------------------------------
// PvP income simulation (from economySimulation pattern)
// ---------------------------------------------------------------------------

function simulatePvPMatch(
  rng: Rng,
  level: number,
  winBias: number,
): { credits: number; data: number; xp: number; repairEvents: number } {
  const winChance = Math.min(0.85, Math.max(0.2, 0.5 + winBias));
  if (!rng.chance(winChance)) {
    return { credits: 0, data: 0, xp: 0, repairEvents: 1 };
  }
  const defenderLevel = Math.max(1, level + rng.int(-3, 3));
  const defenderCredits = rng.int(200, 2400);
  const baseCredits = rng.int(PVP_REWARD_CREDITS_MIN, PVP_REWARD_CREDITS_MAX)
    + defenderLevel * PVP_REWARD_CREDITS_LEVEL_BONUS;
  const transferPct = rng.int(
    Math.round(PVP_REWARD_CREDITS_STEAL_PCT_MIN * 100),
    Math.round(PVP_REWARD_CREDITS_STEAL_PCT_MAX * 100)
  ) / 100;
  const transferCredits = Math.floor(defenderCredits * transferPct);
  const credits = Math.max(20, Math.min(defenderCredits, baseCredits + transferCredits));
  const dataReward = rng.int(PVP_BALANCE.rewardData.baseMin, PVP_BALANCE.rewardData.baseMax)
    + defenderLevel * PVP_BALANCE.rewardData.levelBonusPerLevel;
  return { credits, data: dataReward, xp: 50, repairEvents: 0 };
}

// ---------------------------------------------------------------------------
// ICE Breaker income simulation
// ---------------------------------------------------------------------------

function simulateIceBreaker(
  rng: Rng,
  level: number,
): { credits: number; data: number; xp: number } {
  const layerCount = ICE_BREAKER_BALANCE.layerCount(level);
  let totalCredits = 0;
  let totalData = 0;
  let totalXp = 0;

  // Simulate layer-by-layer with ~70% per-layer pass rate at mid-game
  for (let depth = 0; depth < layerCount; depth++) {
    const passChance = Math.max(0.4, Math.min(0.85, 0.75 - depth * 0.08 + level * 0.01));
    if (!rng.chance(passChance)) {
      // Failed — retain 50% of accumulated
      totalCredits = Math.floor(totalCredits * ICE_BREAKER_BALANCE.failRetentionPct);
      totalData = Math.floor(totalData * ICE_BREAKER_BALANCE.failRetentionPct);
      totalXp = Math.floor(totalXp * ICE_BREAKER_BALANCE.failRetentionPct);
      break;
    }
    const reward = ICE_BREAKER_BALANCE.rewards[Math.min(depth, ICE_BREAKER_BALANCE.rewards.length - 1)];
    totalCredits += reward.credits;
    totalData += reward.data;
    totalXp += reward.xp;
  }
  return { credits: totalCredits, data: totalData, xp: totalXp };
}

// ---------------------------------------------------------------------------
// Decision simulation (simplified from economySimulation)
// ---------------------------------------------------------------------------

function applyDecision(
  rng: Rng,
  level: number,
  profitBias: number,
  seenDecisions: Set<string>,
): { credits: number; data: number } {
  const eligible = ALL_DECISIONS.filter((d) => d.levelRequirement <= level);
  const unseen = eligible.filter((d) => !seenDecisions.has(d.id));
  if (unseen.length === 0) return { credits: 0, data: 0 };

  const chosen = rng.pick(unseen);
  seenDecisions.add(chosen.id);

  // Score yes vs no, pick based on profitBias
  const scoreEffects = (effects: Array<{ type: string; target: string; value: number }>) => {
    let score = 0;
    for (const e of effects) {
      if (e.type !== "resource_grant") continue;
      const rarityScale = DECISION_BALANCE.rarityResourceScale[chosen.rarity] ?? 1;
      const scaled = Math.round(e.value * rarityScale * (1 + level * DECISION_BALANCE.levelScalePerLevel));
      if (e.target === "credits") score += Math.min(scaled, getDecisionResourceCap("credits", level));
      if (e.target === "data") score += Math.min(scaled, getDecisionResourceCap("data", level)) * 1.8;
    }
    return score;
  };

  const yesScore = scoreEffects(chosen.yesEffects);
  const noScore = scoreEffects(chosen.noEffects);
  const chooseYes = profitBias > rng.next() ? yesScore >= noScore : yesScore < noScore;
  const effects = chooseYes ? chosen.yesEffects : chosen.noEffects;

  let credits = 0;
  let data = 0;
  for (const effect of effects) {
    if (effect.type !== "resource_grant") continue;
    const rarityScale = DECISION_BALANCE.rarityResourceScale[chosen.rarity] ?? 1;
    const scaled = Math.round(effect.value * rarityScale * (1 + level * DECISION_BALANCE.levelScalePerLevel));
    if (effect.target === "credits") credits += Math.min(scaled, getDecisionResourceCap("credits", level));
    if (effect.target === "data") data += Math.min(scaled, getDecisionResourceCap("data", level));
  }
  return { credits, data };
}

// ---------------------------------------------------------------------------
// Core simulation: one full-season run for one archetype
// ---------------------------------------------------------------------------

function runSingle(
  archetype: InflationArchetype,
  days: number,
  seed: number,
): RunResult {
  const rng = new Rng(seed);

  // Player state
  let level = 1;
  let xp = 0;
  let credits = 100;
  let data = 50;
  let processingPower = 0;
  const seenDecisions = new Set<string>();

  // Energy state
  let energyMax = ENERGY_BASE_MAX + (level - 1) * ENERGY_MAX_PER_LEVEL;
  let energy = energyMax;

  // Module state — sorted by tier cost (cheapest first)
  const modules: ModuleState[] = ALL_MODULES
    .map((m) => ({
      id: m.id,
      tier: m.tier,
      category: m.category,
      level: 0,
      maxLevel: m.maxLevel,
      baseCost: { ...m.baseCost },
      costPerLevel: { ...m.costPerLevel },
      dependencies: [...m.dependencies],
      mutated: false,
    }))
    .sort((a, b) => {
      const tierOrder = { basic: 0, advanced: 1, elite: 2 };
      const tierDiff = tierOrder[a.tier] - tierOrder[b.tier];
      if (tierDiff !== 0) return tierDiff;
      return a.baseCost.credits - b.baseCost.credits;
    });

  const snapshots: DaySnapshot[] = [];
  let cumulativeSurplus = 0;
  let totalGrossIncome = 0;
  let totalRecurringSpend = 0;
  let totalModuleSpend = 0;
  let totalMutationSpend = 0;
  let dayAllModulesMaxed: number | null = null;
  let inflectionDay: number | null = null;
  let postCompletionDays = 0;
  let postCompletionSurplus = 0;
  let totalHacksDone = 0;
  let totalPvPDone = 0;

  for (let day = 0; day < days; day++) {
    let dayGross = 0;
    let dayRecurring = 0;
    let dayModuleSpend = 0;
    let dayMutationSpend = 0;
    let repairEvents = 0;

    // --- Energy: offline regen (24h - active hours) ---
    const activeHours = archetype.hoursPerDay;
    const offlineHours = 24 - activeHours;
    const regenPerHour = ENERGY_BASE_REGEN_PER_HOUR + (level - 1) * ENERGY_REGEN_PER_LEVEL;
    energyMax = ENERGY_BASE_MAX + (level - 1) * ENERGY_MAX_PER_LEVEL;
    energy = Math.min(energyMax, energy + Math.floor(offlineHours * regenPerHour));

    // --- Passive income (24h/day) ---
    const passiveCredits = Math.floor(PASSIVE_CREDITS_PER_HOUR * Math.min(24, PASSIVE_MAX_HOURS));
    const passiveData = Math.floor(PASSIVE_DATA_PER_HOUR * Math.min(24, PASSIVE_MAX_HOURS));
    credits += passiveCredits;
    data += passiveData;
    dayGross += passiveCredits;

    // --- Data Vault activation (pre-session buff, no energy cost) ---
    const dataVaultActive = archetype.vaultPerDay > 0 && level >= 5;
    const vaultUses = Math.min(archetype.vaultPerDay, DATA_VAULT_BALANCE.dailyUseCap);
    for (let v = 0; v < vaultUses; v++) {
      if (level < 5) break;
      if (credits >= DATA_VAULT_RECOMMENDED.costs.credits && data >= DATA_VAULT_RECOMMENDED.costs.data) {
        credits -= DATA_VAULT_RECOMMENDED.costs.credits;
        data -= DATA_VAULT_RECOMMENDED.costs.data;
        dayRecurring += DATA_VAULT_RECOMMENDED.costs.credits;
      }
    }

    // --- Energy-gated active session ---
    // Simulate active play minute-by-minute. Each minute: regen energy, then
    // attempt one activity based on archetype priorities and available energy.
    const HACK_ENERGY = SCAN_ENERGY_COST;
    const ICE_ENERGY = ICE_BREAKER_BALANCE.energyCost;
    const REPAIR_ENERGY = ENERGY_COSTS.repair;

    const totalMinutes = activeHours * 60;
    const regenPerMinute = regenPerHour / 60;
    let hacksDone = 0;
    let pvpDone = 0;
    let iceDone = 0;
    let repairsDone = 0;

    // Desired counts from archetype (caps for the session)
    const desiredHacks = Math.floor(archetype.hacksPerHour * activeHours) + (rng.chance(0.25) ? 1 : 0);
    const desiredPvP = level >= PROGRESSION_BALANCE.unlockLevels.pvp_arena ? archetype.pvpPerDay : 0;
    const desiredIce = level >= PROGRESSION_BALANCE.unlockLevels.ice_breaker ? Math.min(archetype.icePerDay, ICE_BREAKER_BALANCE.dailyLimit) : 0;

    // Spread activities across the session using intervals
    const hackInterval = desiredHacks > 0 ? totalMinutes / desiredHacks : Infinity;
    const pvpInterval = desiredPvP > 0 ? totalMinutes / desiredPvP : Infinity;
    const iceInterval = desiredIce > 0 ? totalMinutes / desiredIce : Infinity;

    let nextHackAt = hackInterval > 0 ? hackInterval / 2 : Infinity;
    let nextPvPAt = pvpInterval > 0 ? pvpInterval / 3 : Infinity;
    let nextIceAt = iceInterval > 0 ? iceInterval / 4 : Infinity;

    for (let minute = 0; minute < totalMinutes; minute++) {
      energy = Math.min(energyMax, energy + regenPerMinute);

      // Hack attempt
      if (minute >= nextHackAt && hacksDone < desiredHacks && energy >= HACK_ENERGY) {
        energy -= HACK_ENERGY;
        const hack = simulateHackIncome(rng, level, archetype.profitBias, dataVaultActive);
        credits += hack.credits;
        data += hack.data;
        xp += hack.xp;
        dayGross += hack.credits;
        repairEvents += hack.repairEvents;
        hacksDone++;
        nextHackAt += hackInterval;

        // Decision chance per hack (~10%)
        if (rng.chance(0.1)) {
          const dec = applyDecision(rng, level, archetype.profitBias, seenDecisions);
          credits += dec.credits;
          data += dec.data;
          dayGross += dec.credits;
        }
        continue;
      }

      // PvP attempt
      if (minute >= nextPvPAt && pvpDone < desiredPvP && energy >= PVP_ENERGY_COST) {
        energy -= PVP_ENERGY_COST;
        const pvp = simulatePvPMatch(rng, level, archetype.winBias);
        credits += pvp.credits;
        data += pvp.data;
        xp += pvp.xp;
        dayGross += pvp.credits;
        repairEvents += pvp.repairEvents;
        pvpDone++;
        nextPvPAt += pvpInterval;
        continue;
      }

      // ICE Breaker attempt
      if (minute >= nextIceAt && iceDone < desiredIce && energy >= ICE_ENERGY) {
        energy -= ICE_ENERGY;
        const ice = simulateIceBreaker(rng, level);
        credits += ice.credits;
        data += ice.data;
        xp += ice.xp;
        dayGross += ice.credits;
        iceDone++;
        nextIceAt += iceInterval;
        continue;
      }
    }

    const totalHacks = hacksDone;
    totalHacksDone += hacksDone;
    totalPvPDone += pvpDone;

    // --- Repairs (recurring sink) ---
    // Base maintenance pressure + detection-triggered repairs
    const totalRepairs = repairEvents + (rng.chance(0.35) ? 1 : 0);
    for (let r = 0; r < totalRepairs; r++) {
      const health = rng.int(35, 85);
      const cost = getRepairCreditCostForHealth(health, level);
      if (credits >= cost && energy >= REPAIR_ENERGY) {
        credits -= cost;
        energy -= REPAIR_ENERGY;
        dayRecurring += cost;
      }
    }

    // --- Level up ---
    const prevLevel = level;
    level = getLevelForXP(xp);
    if (level > prevLevel) {
      energyMax = ENERGY_BASE_MAX + (level - 1) * ENERGY_MAX_PER_LEVEL;
      // Level-up gives a partial energy refill (floor at 50% of new max)
      energy = Math.max(energy, Math.floor(energyMax * 0.5));
    }

    // --- Module purchases (one-time sink) ---
    // Buy/upgrade modules, prioritizing cheapest available
    let purchasedThisTick = true;
    while (purchasedThisTick) {
      purchasedThisTick = false;
      for (const mod of modules) {
        if (mod.level >= mod.maxLevel) continue;
        if (!depsUnlocked(mod, modules)) continue;
        const cost = computeUpgradeCost(mod);
        if (!cost) continue;
        if (credits >= cost.credits && data >= cost.data) {
          credits -= cost.credits;
          data -= cost.data;
          mod.level++;
          dayModuleSpend += cost.credits;
          xp += MODULE_PURCHASE_XP;
          purchasedThisTick = true;
          break; // Re-evaluate from cheapest after each purchase
        }
      }
    }

    // --- Mutation attempts (one-time sink, advanced+ only) ---
    for (const mod of modules) {
      if (mod.mutated) continue;
      if (mod.level < MAX_MODULE_LEVEL) continue;
      if (!MUTATION_ELIGIBLE_TIERS.includes(mod.tier as "advanced" | "elite")) continue;
      if (
        credits >= MUTATION_COST.credits
        && data >= MUTATION_COST.data
        && processingPower >= MUTATION_COST.processingPower
      ) {
        credits -= MUTATION_COST.credits;
        data -= MUTATION_COST.data;
        processingPower -= MUTATION_COST.processingPower;
        dayMutationSpend += MUTATION_COST.credits;

        if (rng.chance(MUTATION_SUCCESS_RATE)) {
          mod.mutated = true;
        }
        // Failed attempts still consume resources — may retry next day
      }
    }

    // Processing power from high-score/high-security hacks (approximate)
    // ~15% of hacks qualify for PP, awarding 1-2 each
    const ppQualifyingHacks = Math.floor(totalHacks * 0.15);
    processingPower += ppQualifyingHacks * rng.int(1, 2);

    // --- Track metrics ---
    const modulesMaxed = modules.filter((m) => m.level >= m.maxLevel).length;
    const allMaxed = modulesMaxed === modules.length;

    totalGrossIncome += dayGross;
    totalRecurringSpend += dayRecurring;
    totalModuleSpend += dayModuleSpend;
    totalMutationSpend += dayMutationSpend;

    const dayNet = dayGross - dayRecurring - dayModuleSpend - dayMutationSpend;
    cumulativeSurplus += dayNet;

    if (allMaxed && dayAllModulesMaxed === null) {
      dayAllModulesMaxed = day + 1; // 1-indexed
    }

    // Inflection point: remaining one-time sinks < remaining season income
    if (inflectionDay === null) {
      const remainingDays = days - day - 1;
      const avgDailyGross = totalGrossIncome / (day + 1);
      const remainingIncome = avgDailyGross * remainingDays;
      const avgDailyRecurring = totalRecurringSpend / (day + 1);
      const remainingRecurringSinks = avgDailyRecurring * remainingDays;

      // Remaining one-time sinks
      let remainingModuleSink = 0;
      for (const mod of modules) {
        if (mod.level >= mod.maxLevel) continue;
        for (let lvl = mod.level; lvl < mod.maxLevel; lvl++) {
          if (lvl === 0) remainingModuleSink += mod.baseCost.credits;
          else remainingModuleSink += mod.baseCost.credits + mod.costPerLevel.credits * lvl;
        }
      }
      const unmutatedModules = modules.filter(
        (m) => !m.mutated && m.level >= MAX_MODULE_LEVEL && MUTATION_ELIGIBLE_TIERS.includes(m.tier as "advanced" | "elite")
      ).length;
      const remainingMutationSink = unmutatedModules * MUTATION_COST.credits * EXPECTED_MUTATION_ATTEMPTS_PER_MODULE;
      const totalRemainingSinks = remainingModuleSink + remainingMutationSink + remainingRecurringSinks;

      if (remainingIncome > totalRemainingSinks && day > 10) {
        inflectionDay = day + 1;
      }
    }

    // Post-completion tracking
    if (allMaxed) {
      postCompletionDays++;
      postCompletionSurplus += dayGross - dayRecurring;
    }

    snapshots.push({
      day: day + 1,
      grossIncome: dayGross,
      recurringSpend: dayRecurring,
      moduleSpend: dayModuleSpend,
      mutationSpend: dayMutationSpend,
      netCredits: dayNet,
      cumulativeSurplus,
      modulesMaxed,
      totalModules: modules.length,
      level,
    });
  }

  return {
    dayAllModulesMaxed,
    inflectionDay,
    day90Surplus: cumulativeSurplus,
    day90Data: data,
    hacksPerDay: totalHacksDone / days,
    pvpPerDay: totalPvPDone / days,
    grossIncomePerDay: totalGrossIncome / days,
    recurringPerDay: totalRecurringSpend / days,
    moduleSpendPerDay: totalModuleSpend / days,
    postCompletionSurplusPerDay: postCompletionDays > 0 ? postCompletionSurplus / postCompletionDays : 0,
    snapshots,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  const opts = parseCliOptions(argv);
  const days = opts.days || 90;

  console.log("=== Inflation Analysis ===");
  console.log(`runs=${opts.runs} days=${days} seed=${opts.seed}`);

  // Compute total sink pools
  let totalModuleCredits = 0;
  let totalModuleData = 0;
  for (const mod of ALL_MODULES) {
    const cost = computeModuleCostToMax(mod);
    totalModuleCredits += cost.credits;
    totalModuleData += cost.data;
  }
  console.log(`\n[Sink Pool]`);
  console.log(`Total modules: ${ALL_MODULES.length} (${totalModuleCredits}c + ${totalModuleData}d to max all)`);
  console.log(`Mutation cost per attempt: ${MUTATION_COST.credits}c + ${MUTATION_COST.data}d + ${MUTATION_COST.processingPower}pp (${Math.round(MUTATION_SUCCESS_RATE * 100)}% success)`);
  console.log(`Expected mutation sink: ~${Math.round(TOTAL_MUTATION_SINK)}c (${MUTATION_ELIGIBLE_MODULES.length} advanced+ modules × ~${EXPECTED_MUTATION_ATTEMPTS_PER_MODULE.toFixed(1)} attempts)`);
  console.log(`Total one-time sink pool: ~${Math.round(totalModuleCredits + TOTAL_MUTATION_SINK)}c`);

  const guardrails: Array<{ name: string; pass: boolean; detail: string }> = [];
  const summaryRows: Record<ArchetypeId, {
    allMaxedP50: number | null;
    inflectionP50: number | null;
    day90SurplusP50: number;
  }> = {} as any;

  for (const archetype of ARCHETYPES) {
    const results: RunResult[] = [];
    for (let i = 0; i < opts.runs; i++) {
      results.push(runSingle(archetype, days, opts.seed + i * 17));
    }

    const maxedDays = results.map((r) => r.dayAllModulesMaxed).filter((v): v is number => v !== null);
    const inflectionDays = results.map((r) => r.inflectionDay).filter((v): v is number => v !== null);
    const surpluses = results.map((r) => r.day90Surplus);
    const postCompSurplus = results.map((r) => r.postCompletionSurplusPerDay).filter((v) => v > 0);

    const maxedP50 = maxedDays.length > 0 ? percentile(maxedDays, 50) : null;
    const inflectionP50 = inflectionDays.length > 0 ? percentile(inflectionDays, 50) : null;
    const surplusP50 = percentile(surpluses, 50);

    summaryRows[archetype.id] = {
      allMaxedP50: maxedP50,
      inflectionP50,
      day90SurplusP50: surplusP50,
    };

    console.log(`\n[${archetype.id}] (${archetype.hoursPerDay}h/day)`);
    console.log(`  Actual hacks/day avg: ${average(results.map((r) => r.hacksPerDay)).toFixed(1)} (desired: ${Math.floor(archetype.hacksPerHour * archetype.hoursPerDay)})`);
    console.log(`  Actual PvP/day avg: ${average(results.map((r) => r.pvpPerDay)).toFixed(1)} (desired: ${archetype.pvpPerDay})`);
    console.log(`  Gross income/day avg: ${average(results.map((r) => r.grossIncomePerDay)).toFixed(0)}c`);
    console.log(`  Recurring sinks/day: ${average(results.map((r) => r.recurringPerDay)).toFixed(0)}c (repairs + vault)`);
    console.log(`  Module spend/day avg: ${average(results.map((r) => r.moduleSpendPerDay)).toFixed(0)}c`);
    console.log(`  Day ${days} held data (p50): ${percentile(results.map((r) => r.day90Data), 50).toFixed(0)}d`);
    if (maxedDays.length > 0) {
      console.log(`  Day all modules maxed (p50): ${maxedP50}`);
      console.log(`  Day all modules maxed (p25-p75): ${percentile(maxedDays, 25)}-${percentile(maxedDays, 75)}`);
    } else {
      console.log(`  Day all modules maxed: not reached in ${days} days (${maxedDays.length}/${opts.runs} runs completed)`);
    }
    if (postCompSurplus.length > 0) {
      console.log(`  Post-completion surplus/day: ${average(postCompSurplus).toFixed(0)}c`);
    }
    if (inflectionDays.length > 0) {
      console.log(`  Inflection point (p50): Day ${inflectionP50}`);
    } else {
      console.log(`  Inflection point: not reached`);
    }
    console.log(`  Day ${days} cumulative surplus (p50): ${surplusP50.toFixed(0)}c`);
    console.log(`  Day ${days} cumulative surplus (p90): ${percentile(surpluses, 90).toFixed(0)}c`);
  }

  // --- Summary table ---
  console.log("\n=== Summary Table ===");
  const ids: ArchetypeId[] = ["cautious_pve", "mixed", "aggressive_pvp", "idle_logger", "marathon_grinder"];
  const labels = ["casual", "mixed", "pvp", "idle", "marathon"];

  const pad = (s: string, n: number) => s.padStart(n);
  console.log(`${"".padStart(22)}${labels.map((l) => pad(l, 10)).join("")}`);
  console.log(
    `${"All modules maxed:".padStart(22)}${ids.map((id) => {
      const v = summaryRows[id].allMaxedP50;
      return pad(v !== null ? `Day ${v}` : "N/A", 10);
    }).join("")}`
  );
  console.log(
    `${"Inflection point:".padStart(22)}${ids.map((id) => {
      const v = summaryRows[id].inflectionP50;
      return pad(v !== null ? `Day ${v}` : "N/A", 10);
    }).join("")}`
  );
  console.log(
    `${"Day 90 surplus:".padStart(22)}${ids.map((id) => {
      return pad(`${summaryRows[id].day90SurplusP50.toFixed(0)}c`, 10);
    }).join("")}`
  );

  // --- Guardrails ---
  const marathonMaxed = summaryRows.marathon_grinder.allMaxedP50;
  guardrails.push({
    name: "Marathon grinder should not max all modules before day 55",
    pass: marathonMaxed === null || marathonMaxed >= 55,
    detail: marathonMaxed !== null ? `Day ${marathonMaxed}` : "not reached",
  });

  const casualMaxed = summaryRows.cautious_pve.allMaxedP50;
  guardrails.push({
    name: "Casual (2h/day) should not finish all modules within 90 days",
    pass: casualMaxed === null || casualMaxed > 90,
    detail: casualMaxed !== null ? `Day ${casualMaxed}` : "not reached within window",
  });

  // Post-completion daily surplus ≤ 400c/day for any archetype
  let maxPostCompSurplus = 0;
  let maxPostCompArch = "";
  for (const archetype of ARCHETYPES) {
    const results: RunResult[] = [];
    for (let i = 0; i < Math.min(opts.runs, 100); i++) {
      results.push(runSingle(archetype, days, opts.seed + i * 17));
    }
    const postComp = results.map((r) => r.postCompletionSurplusPerDay).filter((v) => v > 0);
    if (postComp.length > 0) {
      const avg = average(postComp);
      if (avg > maxPostCompSurplus) {
        maxPostCompSurplus = avg;
        maxPostCompArch = archetype.id;
      }
    }
  }
  guardrails.push({
    name: "Post-completion daily surplus ≤ 400c/day for any archetype",
    pass: maxPostCompSurplus <= 400,
    detail: `${maxPostCompArch}: ${maxPostCompSurplus.toFixed(0)}c/day`,
  });

  // Mixed player day-90 surplus ≤ 15,000c
  const mixedSurplus = summaryRows.mixed.day90SurplusP50;
  guardrails.push({
    name: "Mixed player day-90 surplus ≤ 15,000c",
    pass: mixedSurplus <= 15000,
    detail: `${mixedSurplus.toFixed(0)}c`,
  });

  // Non-marathon inflection point after day 60
  let earliestNonMarathonInflection = Infinity;
  let earliestNonMarathonArch = "";
  for (const id of ["cautious_pve", "mixed", "aggressive_pvp", "idle_logger"] as ArchetypeId[]) {
    const v = summaryRows[id].inflectionP50;
    if (v !== null && v < earliestNonMarathonInflection) {
      earliestNonMarathonInflection = v;
      earliestNonMarathonArch = id;
    }
  }
  guardrails.push({
    name: "Non-marathon inflection point after day 60",
    pass: earliestNonMarathonInflection > 60 || earliestNonMarathonInflection === Infinity,
    detail: earliestNonMarathonInflection !== Infinity
      ? `${earliestNonMarathonArch}: Day ${earliestNonMarathonInflection}`
      : "no inflection reached",
  });

  const allPass = printGuardrails("sim:inflation", guardrails);
  if (!allPass) process.exit(1);
}

main();
