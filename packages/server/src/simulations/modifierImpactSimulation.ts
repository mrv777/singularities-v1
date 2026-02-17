/**
 * Daily Modifier Impact Simulation
 *
 * Tests each modifier in isolation vs baseline, worst/best day ratio,
 * and verifies trade-offs exist for all modifiers.
 */
import {
  MODIFIER_POOL,
  type ModifierDefinition,
  type ModifierEffect,
  SCANNER_BALANCE,
  DEGRADATION_RATE_PER_HOUR,
  getBaseReward,
  getHackEnergyCost,
  getEarlyHackSuccessFloor,
  getRepairCreditCostForHealth,
  PASSIVE_CREDITS_PER_HOUR,
  PASSIVE_DATA_PER_HOUR,
  ENERGY_COSTS,
} from "@singularities/shared";
import {
  Rng,
  parseCliOptions,
  average,
  PlayerState,
  tickDegradation,
  tickCascade,
  simulateRepair,
  checkDeath,
  printGuardrails,
} from "./lib.js";

interface DayResult {
  netCredits: number;
  netData: number;
  xpGained: number;
  repairCost: number;
  avgHealth: number;
  died: boolean;
}

function simulateDay(
  seed: number,
  level: number,
  effects: ModifierEffect
): DayResult {
  const rng = new Rng(seed);
  const state = new PlayerState(level);
  state.credits = 2000; // Start with buffer

  const degradMult = effects.degradationRateMultiplier ?? 1;
  const hackRewardMult = effects.hackRewardMultiplier ?? 1;
  const xpMult = effects.xpGainMultiplier ?? 1;
  const repairCostMult = effects.repairCostMultiplier ?? 1;
  const passiveMult = effects.passiveIncomeMultiplier ?? 1;
  const energyCostMult = effects.energyCostMultiplier ?? 1;

  let totalRepairCost = 0;
  let totalXp = 0;
  const startCredits = state.credits;
  const startData = state.data;

  // 4 hours of active play
  for (let hour = 0; hour < 4; hour++) {
    tickDegradation(state, 1, degradMult);
    tickCascade(state);
    tickCascade(state);

    // 6 hacks per hour
    for (let h = 0; h < 6; h++) {
      state.energy = Math.min(state.energyMax, state.energy + state.regenPerMinute() * 10);

      const security = Math.min(
        SCANNER_BALANCE.targetSecurity.max,
        SCANNER_BALANCE.targetSecurity.baseMin
        + rng.int(0, SCANNER_BALANCE.targetSecurity.randomRange)
        + state.level * SCANNER_BALANCE.targetSecurity.levelStep
      );
      const hackCost = Math.ceil(getHackEnergyCost(security) * energyCostMult);
      if (state.energy < hackCost) continue;

      state.energy -= hackCost;
      const chance = Math.max(
        getEarlyHackSuccessFloor(state.level),
        Math.min(SCANNER_BALANCE.hackSuccess.maxChance, SCANNER_BALANCE.hackSuccess.baseChance + (6 + state.level * 2 - security))
      );
      if (rng.int(1, 100) <= chance) {
        const reward = getBaseReward(security);
        state.credits += Math.floor(reward.credits * hackRewardMult);
        state.data += Math.floor(reward.data * hackRewardMult);
        totalXp += Math.floor(reward.xp * xpMult);
      }
    }

    // Repair worst system each hour
    for (let r = 0; r < 2; r++) {
      const worst = state.lowestSystemIndex();
      if (state.systems[worst] < 70) {
        state.energy = Math.min(state.energyMax, state.energy + 20);
        const cost = simulateRepair(state, worst, repairCostMult);
        if (cost >= 0) totalRepairCost += cost;
      }
    }

    if (checkDeath(state)) {
      return { netCredits: state.credits - startCredits, netData: state.data - startData, xpGained: totalXp, repairCost: totalRepairCost, avgHealth: 0, died: true };
    }
  }

  // 20 hours offline
  tickDegradation(state, 20, degradMult);
  for (let t = 0; t < 40; t++) tickCascade(state);

  // Passive income
  state.credits += Math.floor(PASSIVE_CREDITS_PER_HOUR * 24 * passiveMult);
  state.data += Math.floor(PASSIVE_DATA_PER_HOUR * 24 * passiveMult);

  return {
    netCredits: state.credits - startCredits,
    netData: state.data - startData,
    xpGained: totalXp,
    repairCost: totalRepairCost,
    avgHealth: state.avgHealth(),
    died: checkDeath(state),
  };
}

function main() {
  const opts = parseCliOptions(process.argv.slice(2));
  console.log("=== Daily Modifier Impact Simulation ===");
  console.log(`runs=${opts.runs} seed=${opts.seed}`);

  const level = 10;
  const guardrails: Array<{ name: string; pass: boolean; detail: string }> = [];

  // Baseline (no modifier)
  const baselineResults: DayResult[] = [];
  for (let i = 0; i < opts.runs; i++) {
    baselineResults.push(simulateDay(opts.seed + i, level, {}));
  }
  const baselineNet = average(baselineResults.map((r) => r.netCredits));
  const baselineXp = average(baselineResults.map((r) => r.xpGained));
  console.log(`\n[Baseline] net credits: ${baselineNet.toFixed(0)}, XP: ${baselineXp.toFixed(0)}`);

  // Each modifier
  const modifierNets: Record<string, number> = {};
  let worstNet = Infinity;
  let bestNet = -Infinity;
  let worstModName = "";
  let bestModName = "";

  for (const mod of MODIFIER_POOL) {
    const results: DayResult[] = [];
    for (let i = 0; i < opts.runs; i++) {
      results.push(simulateDay(opts.seed + i, level, mod.effects));
    }
    const netCred = average(results.map((r) => r.netCredits));
    const netXp = average(results.map((r) => r.xpGained));
    const deathRate = results.filter((r) => r.died).length / opts.runs;
    const avgHealth = average(results.filter((r) => !r.died).map((r) => r.avgHealth));
    const pctChange = baselineNet !== 0 ? ((netCred - baselineNet) / Math.abs(baselineNet)) * 100 : 0;

    modifierNets[mod.id] = netCred;
    if (netCred < worstNet) { worstNet = netCred; worstModName = mod.name; }
    if (netCred > bestNet) { bestNet = netCred; bestModName = mod.name; }

    console.log(`\n[${mod.name} (${mod.severity})]`);
    console.log(`  net credits: ${netCred.toFixed(0)} (${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(0)}% vs baseline)`);
    console.log(`  XP: ${netXp.toFixed(0)}, health: ${avgHealth.toFixed(1)}, death rate: ${(deathRate * 100).toFixed(1)}%`);

    // Per-modifier guardrail: impact within -25% to +35%
    const relativeImpact = baselineNet !== 0 ? (netCred - baselineNet) / Math.abs(baselineNet) : 0;
    guardrails.push({
      name: `${mod.name} impact range`,
      pass: relativeImpact >= -0.25 && relativeImpact <= 0.35,
      detail: `${(relativeImpact * 100).toFixed(0)}% (need -25% to +35%)`,
    });

    // System Overload death rate
    if (mod.id === "system_overload") {
      guardrails.push({
        name: "System Overload death rate for active players",
        pass: deathRate <= 0.05,
        detail: `${(deathRate * 100).toFixed(1)}% (need ≤5%)`,
      });
    }

    // Check for strictly positive/negative modifiers
    const hasPositive = Object.values(mod.effects).some((v) => (v ?? 1) > 1 || (v ?? 1) < 1);
    const keys = Object.keys(mod.effects) as (keyof ModifierEffect)[];
    const positiveEffects = keys.filter((k) => {
      const v = mod.effects[k];
      if (v === undefined) return false;
      // These are "positive" for the player
      if (k === "hackRewardMultiplier" || k === "passiveIncomeMultiplier" || k === "xpGainMultiplier" || k === "heatDecayMultiplier") return v > 1;
      if (k === "energyCostMultiplier" || k === "degradationRateMultiplier" || k === "repairCostMultiplier" || k === "detectionChanceMultiplier") return v < 1;
      return false;
    });
    const negativeEffects = keys.filter((k) => {
      const v = mod.effects[k];
      if (v === undefined) return false;
      if (k === "hackRewardMultiplier" || k === "passiveIncomeMultiplier" || k === "xpGainMultiplier" || k === "heatDecayMultiplier") return v < 1;
      if (k === "energyCostMultiplier" || k === "degradationRateMultiplier" || k === "repairCostMultiplier" || k === "detectionChanceMultiplier") return v > 1;
      return false;
    });
    const isStrictlyPositive = positiveEffects.length > 0 && negativeEffects.length === 0;
    const isStrictlyNegative = negativeEffects.length > 0 && positiveEffects.length === 0;
    if (isStrictlyPositive) {
      console.log(`  WARN: ${mod.name} is strictly positive (no trade-off)`);
    }
    if (isStrictlyNegative) {
      console.log(`  WARN: ${mod.name} is strictly negative (no trade-off)`);
    }
  }

  // Worst/best ratio
  const worstBestRatio = bestNet !== 0 && worstNet !== 0
    ? Math.abs(bestNet) / Math.abs(worstNet)
    : 0;
  console.log(`\n[Summary] Worst: ${worstModName} (${worstNet.toFixed(0)}c), Best: ${bestModName} (${bestNet.toFixed(0)}c)`);
  console.log(`Worst/best ratio: ${worstBestRatio.toFixed(2)}`);

  guardrails.push({
    name: "Worst/best day ratio",
    pass: worstBestRatio <= 2.5,
    detail: `${worstBestRatio.toFixed(2)} (need ≤2.5)`,
  });

  const allPass = printGuardrails("sim:modifiers", guardrails);
  if (!allPass) process.exit(1);
}

main();
