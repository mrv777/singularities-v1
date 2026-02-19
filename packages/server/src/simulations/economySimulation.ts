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
  MINIGAME_BALANCE,
  getBaseReward,
  getDecisionResourceCap,
  getLevelForXP,
  getScoreMultiplier,
  getRepairCreditCostForHealth,
} from "@singularities/shared";
import { Rng, average, parseCliOptions, percentile, printGuardrails } from "./lib.js";

type ArchetypeId = "cautious_pve" | "mixed" | "aggressive_pvp" | "idle_logger" | "marathon_grinder";

interface Archetype {
  id: ArchetypeId;
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
  repairCostPerHour: number;
  netCreditsPerHour: number;
}

interface EconomyProfile {
  name: "baseline" | "current";
  securityBaseMin: number;
  securityStep: number;
  solveBaseChance: number;
  solveMinChance: number;
  solvedScoreMean: number;
  solvedScoreSpread: number;
  failScoreMean: number;
}

const ARCHETYPES: Archetype[] = [
  { id: "cautious_pve", hacksPerHour: 6, pvpMatchesPerDay: 0, winBias: 0, profitBias: 0.3 },
  { id: "mixed", hacksPerHour: 5, pvpMatchesPerDay: 6, winBias: 0.05, profitBias: 0.55 },
  { id: "aggressive_pvp", hacksPerHour: 3, pvpMatchesPerDay: 12, winBias: 0.12, profitBias: 0.8 },
  { id: "idle_logger", hacksPerHour: 3, pvpMatchesPerDay: 0, winBias: 0, profitBias: 0.2 },
  { id: "marathon_grinder", hacksPerHour: 10, pvpMatchesPerDay: 4, winBias: 0.08, profitBias: 0.6 },
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
    solveBaseChance: 76,
    solveMinChance: 60,
    solvedScoreMean: 70,
    solvedScoreSpread: 18,
    failScoreMean: 22,
  },
  current: {
    name: "current",
    securityBaseMin: SCANNER_BALANCE.targetSecurity.baseMin,
    securityStep: SCANNER_BALANCE.targetSecurity.levelStep,
    solveBaseChance: 86,
    solveMinChance: 72,
    solvedScoreMean: 79,
    solvedScoreSpread: 12,
    failScoreMean: 26,
  },
};

function getTierIndex(securityLevel: number): number {
  if (securityLevel >= 75) return 3;
  if (securityLevel >= 55) return 2;
  if (securityLevel >= 30) return 1;
  return 0;
}

function sampleSecurityFromScan(rng: Rng, level: number, profile: EconomyProfile, profitBias: number): number {
  const options: number[] = [];
  for (let i = 0; i < 5; i++) {
    const security = Math.min(
      SCANNER_BALANCE.targetSecurity.max,
      profile.securityBaseMin
      + rng.int(0, SCANNER_BALANCE.targetSecurity.randomRange)
      + level * profile.securityStep
    );
    options.push(security);
  }
  options.sort((a, b) => a - b);
  // Profit-focused players are more likely to pick the highest-security target from the scan.
  return rng.chance(profitBias) ? options[4] : rng.pick(options);
}

function sampleSolveAndScore(
  rng: Rng,
  level: number,
  security: number,
  effectiveHackPower: number,
  profile: EconomyProfile,
  profitBias: number,
): { solved: boolean; score: number } {
  const levelPenalty = Math.max(0, level - 5) * 0.85;
  const solveChance = Math.min(
    98,
    Math.max(
      profile.solveMinChance,
      profile.solveBaseChance
      + level * 0.45
      + effectiveHackPower * 0.65
      - Math.max(0, security - 28) * 0.60
      - levelPenalty
    )
  );
  const solved = rng.int(1, 100) <= solveChance;
  const solvedScoreMean = profile.solvedScoreMean - Math.max(0, level - 6) * 0.55 + profitBias * 2;
  const solvedScore = solvedScoreMean + rng.int(-profile.solvedScoreSpread, profile.solvedScoreSpread);
  const failScore = profile.failScoreMean + rng.int(-8, 8);
  const score = solved
    ? Math.max(50, Math.min(100, solvedScore))
    : Math.max(1, Math.min(49, failScore));
  return { solved, score };
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
  let totalRepairCost = 0;

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
      const security = sampleSecurityFromScan(rng, state.level, profile, archetype.profitBias);
      const dataVaultHackBonus = dataVaultEnabled && hackMinute < state.dataVaultActiveUntilMinute
        ? DATA_VAULT_HACK_BONUS
        : 0;
      const effectiveHackPower = 8 + state.level * 2.2 + Math.floor(archetype.profitBias * 5) + dataVaultHackBonus;
      const { solved, score } = sampleSolveAndScore(
        rng, state.level, security, effectiveHackPower, profile, archetype.profitBias
      );
      const rewards = getBaseReward(security);
      const economicMult = MINIGAME_BALANCE.economicMultiplierByTier[getTierIndex(security)];
      const scoreMult = getScoreMultiplier(score);

      state.credits += Math.floor(
        rewards.credits * economicMult * scoreMult * seasonCatchUpResourceMultiplier
        * MINIGAME_BALANCE.globalRewardMultiplier
      );
      state.data += Math.floor(
        rewards.data * economicMult * scoreMult * seasonCatchUpResourceMultiplier
        * MINIGAME_BALANCE.globalRewardMultiplier
      );
      state.reputation += Math.floor(rewards.reputation * MINIGAME_BALANCE.rewardMultiplier * scoreMult);
      state.xp += Math.floor(
        rewards.xp * MINIGAME_BALANCE.rewardMultiplier * scoreMult * MINIGAME_BALANCE.globalRewardMultiplier
      );

      if (score >= MINIGAME_BALANCE.processingPowerScoreThreshold
        && security >= MINIGAME_BALANCE.processingPowerSecurityThreshold) {
        state.processingPower += rng.int(
          SCANNER_BALANCE.highRiskProcessingPower.min,
          SCANNER_BALANCE.highRiskProcessingPower.max
        );
      }

      // Minigame detection model (score-aware): poor score risks active detection,
      // high score can still suffer residual detection on high-security targets.
      let detected = false;
      if (score < 50) {
        const detectionMult = score >= 25 ? 0.5 : 1.0;
        const activeDetectChance = Math.max(5, Math.min(95, security * 0.6 * detectionMult));
        detected = rng.int(1, 100) <= activeDetectChance;
      } else {
        const stealthProxy = 6 + Math.floor(archetype.profitBias * 6) + Math.floor(state.level / 5);
        const residual = Math.max(0,
          (security - SCANNER_BALANCE.residualDetection.securityThreshold)
          * SCANNER_BALANCE.residualDetection.securityScale
          - stealthProxy / SCANNER_BALANCE.residualDetection.stealthDivisor
        );
        detected = residual > 0 && rng.int(1, 100) <= residual;
      }
      if (detected || !solved) repairEvents += 1;

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
      const cost = getRepairCreditCostForHealth(health);
      state.credits -= cost;
      totalRepairCost += cost;
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

  const grossCreditsPerHour = (state.credits - startCredits + totalRepairCost) / totalHours;
  const repairCostPerHour = totalRepairCost / totalHours;

  return {
    creditsPerHour: grossCreditsPerHour,
    dataPerHour: (state.data - startData) / totalHours,
    processingPowerPerDay: (state.processingPower - startPP) / Math.max(1, days),
    mutationDay: state.firstMutationHour === null ? null : state.firstMutationHour / 24,
    repairCostPerHour,
    netCreditsPerHour: grossCreditsPerHour - repairCostPerHour,
  };
}

function parseLevelBand(argv: string[]): [number, number] | null {
  for (const arg of argv) {
    if (arg.startsWith("--level-band=")) {
      const parts = arg.slice("--level-band=".length).split("-").map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return [parts[0], parts[1]];
      }
    }
  }
  return null;
}

function main() {
  const argv = process.argv.slice(2);
  const opts = parseCliOptions(argv);
  const catchUpMode = parseCatchUpMode(argv);
  const profile = ECONOMY_PROFILES[parseProfile(argv)];
  const dataVaultMode = parseDataVaultMode(argv);
  const dataVaultEnabled = dataVaultMode === "on";
  const levelBand = parseLevelBand(argv);
  console.log("=== Economy Simulation ===");
  console.log(`runs=${opts.runs} days=${opts.days} seed=${opts.seed} catchup=${catchUpMode} profile=${profile.name} data_vault=${dataVaultMode}`);

  const guardrails: Array<{ name: string; pass: boolean; detail: string }> = [];
  let anyNegativeNet = false;
  let maxNetCreditsPerHour = 0;

  for (const archetype of ARCHETYPES) {
    const results: EconomyResult[] = [];
    for (let i = 0; i < opts.runs; i++) {
      results.push(
        runSingle(archetype, opts.days, opts.seed + i * 17, catchUpMode, profile, dataVaultEnabled)
      );
    }

    const mutationDays = results.map((r) => r.mutationDay).filter((v): v is number => v !== null);
    const avgNet = average(results.map((r) => r.netCreditsPerHour));
    const avgGross = average(results.map((r) => r.creditsPerHour));
    const avgRepair = average(results.map((r) => r.repairCostPerHour));
    const repairRatio = avgGross > 0 ? avgRepair / avgGross : 0;

    console.log(`\n[${archetype.id}]`);
    console.log(`gross credits/hour avg: ${avgGross.toFixed(2)}`);
    console.log(`repair cost/hour avg: ${avgRepair.toFixed(2)}`);
    console.log(`net credits/hour avg: ${avgNet.toFixed(2)}`);
    console.log(`repair/income ratio: ${(repairRatio * 100).toFixed(1)}%`);
    console.log(`data/hour avg: ${average(results.map((r) => r.dataPerHour)).toFixed(2)}`);
    console.log(`processing power/day avg: ${average(results.map((r) => r.processingPowerPerDay)).toFixed(2)}`);
    if (mutationDays.length === 0) {
      console.log("mutation readiness: not reached in simulation window");
    } else {
      console.log(`mutation readiness avg day: ${average(mutationDays).toFixed(2)}`);
    }

    if (avgNet < 0) anyNegativeNet = true;
    maxNetCreditsPerHour = Math.max(maxNetCreditsPerHour, avgNet);

    const maxRepairRatio = archetype.id === "idle_logger" ? 0.55 : 0.5;
    guardrails.push({
      name: `${archetype.id} repair costs <= ${(maxRepairRatio * 100).toFixed(0)}% of income`,
      pass: repairRatio <= maxRepairRatio,
      detail: `${(repairRatio * 100).toFixed(1)}%`,
    });

    // Mutation reachable within 14 days for cautious_pve
    if (archetype.id === "cautious_pve" && opts.days >= 14) {
      const reachedMutation = mutationDays.length > 0 && average(mutationDays) <= 14;
      guardrails.push({
        name: "Mutation reachable within 14 days (cautious_pve)",
        pass: reachedMutation,
        detail: mutationDays.length > 0
          ? `avg day ${average(mutationDays).toFixed(1)}`
          : "not reached",
      });
    }
  }

  guardrails.push({
    name: "Net income positive for all archetypes",
    pass: !anyNegativeNet,
    detail: anyNegativeNet ? "some archetypes have negative net income" : "all positive",
  });

  if (opts.days >= 30) {
    guardrails.push({
      name: "No archetype exceeds conservative inflation ceiling",
      pass: maxNetCreditsPerHour <= 165,
      detail: `max net=${maxNetCreditsPerHour.toFixed(1)} c/hr (need ≤165 c/hr)`,
    });
  }

  const allPass = printGuardrails("sim:economy", guardrails);
  if (!allPass) process.exit(1);
}

main();
