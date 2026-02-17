import {
  ALL_DECISIONS,
  CATCH_UP_BASE,
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
  getBaseReward,
  getDecisionResourceCap,
  getEarlyHackSuccessFloor,
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
}

interface EconomyResult {
  creditsPerHour: number;
  dataPerHour: number;
  processingPowerPerDay: number;
  mutationDay: number | null;
}

const ARCHETYPES: Archetype[] = [
  { id: "cautious_pve", hacksPerHour: 6, pvpMatchesPerDay: 0, winBias: 0, profitBias: 0.3 },
  { id: "mixed", hacksPerHour: 5, pvpMatchesPerDay: 6, winBias: 0.05, profitBias: 0.55 },
  { id: "aggressive_pvp", hacksPerHour: 3, pvpMatchesPerDay: 12, winBias: 0.12, profitBias: 0.8 },
];

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

function runSingle(archetype: Archetype, days: number, seed: number): EconomyResult {
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
  };

  const seasonCatchUpResourceMultiplier = 1 + CATCH_UP_BASE.maxXpMultiplier * CATCH_UP_BASE.resourceBoostFactor;
  const totalHours = days * 24;
  const startCredits = state.credits;
  const startData = state.data;
  const startPP = state.processingPower;

  for (let hour = 0; hour < totalHours; hour++) {
    let repairEvents = 0;
    const hacksThisHour = archetype.hacksPerHour + (rng.chance(0.25) ? 1 : 0);
    for (let i = 0; i < hacksThisHour; i++) {
      const security = Math.min(
        SCANNER_BALANCE.targetSecurity.max,
        SCANNER_BALANCE.targetSecurity.baseMin
        + rng.int(0, SCANNER_BALANCE.targetSecurity.randomRange)
        + state.level * SCANNER_BALANCE.targetSecurity.levelStep
      );
      const effectiveHackPower = 6 + state.level * 2 + Math.floor(archetype.profitBias * 4);
      const chance = Math.max(
        getEarlyHackSuccessFloor(state.level),
        Math.min(SCANNER_BALANCE.hackSuccess.maxChance, SCANNER_BALANCE.hackSuccess.baseChance + effectiveHackPower - security)
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
  const opts = parseCliOptions(process.argv.slice(2));
  console.log("=== Economy Simulation ===");
  console.log(`runs=${opts.runs} days=${opts.days} seed=${opts.seed}`);

  for (const archetype of ARCHETYPES) {
    const results: EconomyResult[] = [];
    for (let i = 0; i < opts.runs; i++) {
      results.push(runSingle(archetype, opts.days, opts.seed + i * 17));
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
