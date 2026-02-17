import {
  ALL_DECISIONS,
  CATCH_UP_BASE,
  DATA_VAULT_BALANCE,
  DATA_VAULT_PROTOCOLS,
  DECISION_BALANCE,
  MUTATION_COST,
  PVP_REWARD_CREDITS_LEVEL_BONUS,
  PVP_REWARD_CREDITS_MAX,
  PVP_REWARD_CREDITS_MIN,
  PVP_REWARD_CREDITS_STEAL_PCT_MAX,
  PVP_REWARD_CREDITS_STEAL_PCT_MIN,
  PVP_REWARD_PROCESSING_POWER_MAX,
  PVP_REWARD_PROCESSING_POWER_MIN,
  SCANNER_BALANCE,
  PROGRESSION_BALANCE,
  getBaseReward,
  getDecisionResourceCap,
  getLevelForXP,
  getRepairCreditCostForHealth,
} from "@singularities/shared";
import { Rng, average, parseCliOptions } from "./lib.js";

interface Archetype {
  id: "cautious_pve" | "mixed" | "aggressive_pvp";
  hacksPerHour: number;
  pvpMatchesPerDay: number;
  winBias: number;
  profitBias: number;
}

interface EconomyState {
  level: number;
  xp: number;
  credits: number;
  data: number;
  processingPower: number;
  reputation: number;
  firstMutationHour: number | null;
  seenDecisions: Set<string>;
  dataVaultActiveUntilMinute: number;
  dataVaultCooldownUntilMinute: number;
  dataVaultUsesToday: number;
}

interface EconomyResult {
  creditsPerHour: number;
  dataPerHour: number;
  processingPowerPerDay: number;
  mutationDay: number | null;
}

interface EconomyProfile {
  name: "baseline" | "current";
  securityBaseMin: number;
  securityStep: number;
  successBaseChance: number;
  successMinChance: number;
  earlyFloorBase: number;
  earlyFloorDropPerLevel: number;
  earlyFloorUntilLevel: number;
}

const ARCHETYPES: Archetype[] = [
  { id: "cautious_pve", hacksPerHour: 6, pvpMatchesPerDay: 0, winBias: 0, profitBias: 0.3 },
  { id: "mixed", hacksPerHour: 5, pvpMatchesPerDay: 6, winBias: 0.05, profitBias: 0.55 },
  { id: "aggressive_pvp", hacksPerHour: 3, pvpMatchesPerDay: 12, winBias: 0.12, profitBias: 0.8 },
];
const DATA_VAULT_RECOMMENDED_PROTOCOL =
  DATA_VAULT_PROTOCOLS.find((p) => p.recommended) ?? DATA_VAULT_PROTOCOLS[0];
const DATA_VAULT_HACK_BONUS = DATA_VAULT_RECOMMENDED_PROTOCOL.buffs.hackPower ?? 0;

function parseCatchUpMode(argv: string[]): "none" | "max" {
  for (const arg of argv) {
    if (arg.startsWith("--catchup=")) {
      const value = arg.slice("--catchup=".length);
      if (value === "none" || value === "max") return value;
    }
  }
  return "none";
}

function parseProfile(argv: string[]): EconomyProfile["name"] {
  for (const arg of argv) {
    if (arg.startsWith("--profile=")) {
      const value = arg.slice("--profile=".length);
      if (value === "baseline" || value === "current") return value;
    }
  }
  return "current";
}

function parseDataVaultMode(argv: string[]): "off" | "on" {
  for (const arg of argv) {
    if (arg.startsWith("--data-vault=")) {
      const value = arg.slice("--data-vault=".length);
      if (value === "off" || value === "on") return value;
    }
  }
  return "off";
}

const ECONOMY_PROFILES: Record<EconomyProfile["name"], EconomyProfile> = {
  baseline: {
    name: "baseline",
    securityBaseMin: 15,
    securityStep: 4,
    successBaseChance: 58,
    successMinChance: 20,
    earlyFloorBase: 35,
    earlyFloorDropPerLevel: 3,
    earlyFloorUntilLevel: 4,
  },
  current: {
    name: "current",
    securityBaseMin: SCANNER_BALANCE.targetSecurity.baseMin,
    securityStep: SCANNER_BALANCE.targetSecurity.levelStep,
    successBaseChance: SCANNER_BALANCE.hackSuccess.baseChance,
    successMinChance: SCANNER_BALANCE.hackSuccess.minChance,
    earlyFloorBase: SCANNER_BALANCE.hackSuccess.earlyFloorBase,
    earlyFloorDropPerLevel: SCANNER_BALANCE.hackSuccess.earlyFloorDropPerLevel,
    earlyFloorUntilLevel: SCANNER_BALANCE.hackSuccess.earlyFloorUntilLevel,
  },
};

function getEarlyFloor(profile: EconomyProfile, level: number): number {
  if (level > profile.earlyFloorUntilLevel) return profile.successMinChance;
  const floor = profile.earlyFloorBase - (level - 1) * profile.earlyFloorDropPerLevel;
  return Math.max(profile.successMinChance, floor);
}

function normalizeDecisionGrant(
  target: string,
  value: number,
  rarity: "common" | "uncommon" | "rare",
  level: number
): number {
  if (value <= 0) return value;
  const rarityScale = DECISION_BALANCE.rarityResourceScale[rarity] ?? 1;
  const scaled = Math.round(value * rarityScale * (1 + level * DECISION_BALANCE.levelScalePerLevel));
  if (target === "credits") return Math.min(scaled, getDecisionResourceCap("credits", level));
  if (target === "data") return Math.min(scaled, getDecisionResourceCap("data", level));
  if (target === "processingPower") return Math.min(scaled, getDecisionResourceCap("processingPower", level));
  if (target === "reputation") return Math.min(scaled, getDecisionResourceCap("reputation", level));
  return scaled;
}

function scoreDecisionEffects(
  effects: Array<{ type: string; target: string; value: number }>,
  rarity: "common" | "uncommon" | "rare",
  level: number
): number {
  let score = 0;
  for (const e of effects) {
    if (e.type !== "resource_grant") continue;
    const value = normalizeDecisionGrant(e.target, e.value, rarity, level);
    if (e.target === "credits") score += value;
    if (e.target === "data") score += value * 1.8;
    if (e.target === "processingPower") score += value * 4;
    if (e.target === "reputation") score += value * 0.8;
  }
  return score;
}

function applyDecision(
  state: EconomyState,
  rng: Rng,
  archetype: Archetype
): void {
  const eligible = ALL_DECISIONS.filter((d) => d.levelRequirement <= state.level);
  const unseen = eligible.filter((d) => !state.seenDecisions.has(d.id));
  if (unseen.length === 0) return;
  const chosen = rng.pick(unseen);
  const yesScore = scoreDecisionEffects(chosen.yesEffects, chosen.rarity, state.level);
  const noScore = scoreDecisionEffects(chosen.noEffects, chosen.rarity, state.level);
  const chooseYes = archetype.profitBias > rng.next()
    ? yesScore >= noScore
    : yesScore < noScore;
  const effects = chooseYes ? chosen.yesEffects : chosen.noEffects;

  for (const effect of effects) {
    if (effect.type !== "resource_grant") continue;
    const value = normalizeDecisionGrant(effect.target, effect.value, chosen.rarity, state.level);
    if (effect.target === "credits") state.credits += value;
    if (effect.target === "data") state.data += value;
    if (effect.target === "processingPower") state.processingPower += value;
    if (effect.target === "reputation") state.reputation += value;
  }
  state.seenDecisions.add(chosen.id);
}

function runSingle(
  archetype: Archetype,
  days: number,
  seed: number,
  catchUpMode: "none" | "max",
  profile: EconomyProfile,
  dataVaultEnabled: boolean
): EconomyResult {
  const rng = new Rng(seed);
  const state: EconomyState = {
    level: 1,
    xp: 0,
    credits: 100,
    data: 50,
    processingPower: 0,
    reputation: 0,
    firstMutationHour: null,
    seenDecisions: new Set<string>(),
    dataVaultActiveUntilMinute: -1,
    dataVaultCooldownUntilMinute: -1,
    dataVaultUsesToday: 0,
  };

  const seasonCatchUpResourceMultiplier = catchUpMode === "max"
    ? 1 + CATCH_UP_BASE.maxXpMultiplier * CATCH_UP_BASE.resourceBoostFactor
    : 1;
  const totalHours = days * 24;
  const startCredits = state.credits;
  const startData = state.data;
  const startPP = state.processingPower;

  for (let hour = 0; hour < totalHours; hour++) {
    if (hour % 24 === 0) {
      state.dataVaultUsesToday = 0;
    }

    const hourStartMinute = hour * 60;
    if (
      dataVaultEnabled
      && state.level >= PROGRESSION_BALANCE.unlockLevels.data_vault
      && state.dataVaultUsesToday < DATA_VAULT_BALANCE.dailyUseCap
      && hourStartMinute >= state.dataVaultCooldownUntilMinute
      && hourStartMinute >= state.dataVaultActiveUntilMinute
      && state.credits >= DATA_VAULT_RECOMMENDED_PROTOCOL.costs.credits
      && state.data >= DATA_VAULT_RECOMMENDED_PROTOCOL.costs.data
    ) {
      state.credits -= DATA_VAULT_RECOMMENDED_PROTOCOL.costs.credits;
      state.data -= DATA_VAULT_RECOMMENDED_PROTOCOL.costs.data;
      state.dataVaultUsesToday += 1;
      state.dataVaultActiveUntilMinute = hourStartMinute + DATA_VAULT_RECOMMENDED_PROTOCOL.durationSeconds / 60;
      state.dataVaultCooldownUntilMinute = hourStartMinute
        + (DATA_VAULT_RECOMMENDED_PROTOCOL.durationSeconds + DATA_VAULT_BALANCE.cooldownSeconds) / 60;
    }

    let repairEvents = 0;
    const hacksThisHour = archetype.hacksPerHour + (rng.chance(0.25) ? 1 : 0);
    for (let i = 0; i < hacksThisHour; i++) {
      const hackMinute = hourStartMinute + (i + 1) * (60 / Math.max(1, hacksThisHour));
      const security = Math.min(
        SCANNER_BALANCE.targetSecurity.max,
        profile.securityBaseMin
        + rng.int(0, SCANNER_BALANCE.targetSecurity.randomRange)
        + state.level * profile.securityStep
      );
      const dataVaultHackBonus = dataVaultEnabled && hackMinute < state.dataVaultActiveUntilMinute
        ? DATA_VAULT_HACK_BONUS
        : 0;
      const effectiveHackPower = 6 + state.level * 2 + Math.floor(archetype.profitBias * 4) + dataVaultHackBonus;
      const chance = Math.max(
        getEarlyFloor(profile, state.level),
        Math.min(SCANNER_BALANCE.hackSuccess.maxChance, profile.successBaseChance + effectiveHackPower - security)
      );
      const success = rng.int(1, 100) <= chance;

      if (success) {
        const rewards = getBaseReward(security);
        state.credits += Math.floor(rewards.credits * seasonCatchUpResourceMultiplier);
        state.data += Math.floor(rewards.data * seasonCatchUpResourceMultiplier);
        state.reputation += rewards.reputation;
        state.xp += rewards.xp;
        if (security >= SCANNER_BALANCE.highRiskProcessingPower.securityThreshold) {
          state.processingPower += rng.int(
            SCANNER_BALANCE.highRiskProcessingPower.min,
            SCANNER_BALANCE.highRiskProcessingPower.max
          );
        }
      } else {
        const detected = rng.int(1, 100) <= Math.min(95, Math.max(5, security * 0.55));
        if (detected) repairEvents += 1;
      }

      // Decision trigger chance mirrors afterHack default.
      if (rng.chance(0.1)) applyDecision(state, rng, archetype);
    }

    const pvpMatchesThisHour = rng.chance(archetype.pvpMatchesPerDay / 24) ? 1 : 0;
    for (let i = 0; i < pvpMatchesThisHour; i++) {
      const winChance = Math.min(0.85, Math.max(0.2, 0.5 + archetype.winBias));
      const win = rng.chance(winChance);
      if (win) {
        const defenderLevel = Math.max(1, state.level + rng.int(-3, 3));
        const defenderCredits = rng.int(200, 2400);
        const baseCredits = rng.int(PVP_REWARD_CREDITS_MIN, PVP_REWARD_CREDITS_MAX)
          + defenderLevel * PVP_REWARD_CREDITS_LEVEL_BONUS;
        const transferPct = rng.int(
          Math.round(PVP_REWARD_CREDITS_STEAL_PCT_MIN * 100),
          Math.round(PVP_REWARD_CREDITS_STEAL_PCT_MAX * 100)
        ) / 100;
        const transferCredits = Math.floor(defenderCredits * transferPct);
        const credits = Math.max(20, Math.min(defenderCredits, baseCredits + transferCredits));
        state.credits += Math.floor(credits * seasonCatchUpResourceMultiplier);
        state.processingPower += Math.floor(
          rng.int(PVP_REWARD_PROCESSING_POWER_MIN, PVP_REWARD_PROCESSING_POWER_MAX)
          * seasonCatchUpResourceMultiplier
        );
        state.reputation += rng.int(20, 30);
        state.xp += 50;
      } else {
        repairEvents += 1;
      }
    }

    // Base maintenance pressure + detected failures.
    const totalRepairs = repairEvents + (rng.chance(0.35) ? 1 : 0);
    for (let i = 0; i < totalRepairs; i++) {
      const health = rng.int(35, 85);
      state.credits -= getRepairCreditCostForHealth(health);
    }

    state.level = getLevelForXP(state.xp);

    if (
      state.firstMutationHour === null
      && state.credits >= MUTATION_COST.credits
      && state.data >= MUTATION_COST.data
      && state.processingPower >= MUTATION_COST.processingPower
    ) {
      state.firstMutationHour = hour;
    }
  }

  return {
    creditsPerHour: (state.credits - startCredits) / totalHours,
    dataPerHour: (state.data - startData) / totalHours,
    processingPowerPerDay: (state.processingPower - startPP) / Math.max(1, days),
    mutationDay: state.firstMutationHour === null ? null : state.firstMutationHour / 24,
  };
}

function main() {
  const argv = process.argv.slice(2);
  const opts = parseCliOptions(argv);
  const catchUpMode = parseCatchUpMode(argv);
  const profile = ECONOMY_PROFILES[parseProfile(argv)];
  const dataVaultMode = parseDataVaultMode(argv);
  const dataVaultEnabled = dataVaultMode === "on";
  console.log("=== Economy Simulation ===");
  console.log(`runs=${opts.runs} days=${opts.days} seed=${opts.seed} catchup=${catchUpMode} profile=${profile.name} data_vault=${dataVaultMode}`);

  for (const archetype of ARCHETYPES) {
    const results: EconomyResult[] = [];
    for (let i = 0; i < opts.runs; i++) {
      results.push(
        runSingle(archetype, opts.days, opts.seed + i * 17, catchUpMode, profile, dataVaultEnabled)
      );
    }

    const mutationDays = results.map((r) => r.mutationDay).filter((v): v is number => v !== null);
    console.log(`\n[${archetype.id}]`);
    console.log(`credits/hour avg: ${average(results.map((r) => r.creditsPerHour)).toFixed(2)}`);
    console.log(`data/hour avg: ${average(results.map((r) => r.dataPerHour)).toFixed(2)}`);
    console.log(`processing power/day avg: ${average(results.map((r) => r.processingPowerPerDay)).toFixed(2)}`);
    if (mutationDays.length === 0) {
      console.log("mutation readiness: not reached in simulation window");
    } else {
      console.log(`mutation readiness avg day: ${average(mutationDays).toFixed(2)}`);
    }
  }
}

main();
