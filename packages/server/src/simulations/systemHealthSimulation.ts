/**
 * System Health Sustainability Simulation
 *
 * Tests degradation rates, maintenance costs, cascade chains,
 * and PvP damage compounding.
 */
import {
  DEGRADATION_RATE_PER_HOUR,
  CASCADE_THRESHOLD,
  REPAIR_COOLDOWN_SECONDS,
  REPAIR_HEALTH_AMOUNT,
  ENERGY_COSTS,
  MODIFIER_POOL,
  PASSIVE_CREDITS_PER_HOUR,
  getRepairCreditCostForHealth,
} from "@singularities/shared";
import {
  Rng,
  parseCliOptions,
  percentile,
  average,
  PlayerState,
  tickDegradation,
  tickCascade,
  checkDeath,
  simulateRepair,
  applyPassiveIncome,
  printGuardrails,
} from "./lib.js";

// -- Scenario results --

interface DecayResult {
  hoursToFirstCritical: number;
  hoursToFirstCorrupted: number;
  hoursToDeath: number;
}

interface MaintenanceResult {
  avgHealth: number;
  repairsPerDay: number;
  dailyCreditCost: number;
  dailyEnergyCost: number;
  sustainable: boolean;
}

interface CascadeResult {
  spiralledToThreePlus: boolean;
  hoursToSpiral: number;
}

// -- Scenarios --

function runPureDecay(seed: number, degradationMult: number): DecayResult {
  const state = new PlayerState(10);
  let firstCritical = -1;
  let firstCorrupted = -1;
  let death = -1;

  for (let hour = 0; hour < 240; hour++) {
    tickDegradation(state, 1, degradationMult);
    // Cascade every 30 min tick (2 per hour)
    tickCascade(state);
    tickCascade(state);

    if (firstCritical < 0 && state.systems.some((hp) => hp > 0 && hp < CASCADE_THRESHOLD)) {
      firstCritical = hour;
    }
    if (firstCorrupted < 0 && state.systems.some((hp) => hp <= 0)) {
      firstCorrupted = hour;
    }
    if (death < 0 && checkDeath(state)) {
      death = hour;
      break;
    }
  }
  return {
    hoursToFirstCritical: firstCritical < 0 ? 240 : firstCritical,
    hoursToFirstCorrupted: firstCorrupted < 0 ? 240 : firstCorrupted,
    hoursToDeath: death < 0 ? 240 : death,
  };
}

function runActiveMaintenance(
  seed: number,
  repairIntervalMinutes: number,
  degradationMult: number,
  repairCostMult: number,
  pvpAttacksPerDay: number,
  rng: Rng
): MaintenanceResult {
  const state = new PlayerState(10);
  let totalRepairCost = 0;
  let totalRepairs = 0;
  let totalEnergySpent = 0;
  const days = 7;
  const totalHours = days * 24;

  // Give enough starting credits to survive
  state.credits = 10000;

  for (let hour = 0; hour < totalHours; hour++) {
    tickDegradation(state, 1, degradationMult);
    tickCascade(state);
    tickCascade(state);

    // PvP damage
    const pvpThisHour = rng.chance(pvpAttacksPerDay / 24) ? 1 : 0;
    for (let a = 0; a < pvpThisHour; a++) {
      const idx = rng.int(0, 5);
      const dmg = rng.int(10, 20);
      state.systems[idx] = Math.max(0, state.systems[idx] - dmg);
    }

    // Repair at interval
    const repairsThisHour = Math.floor(60 / repairIntervalMinutes);
    for (let r = 0; r < repairsThisHour; r++) {
      // Repair the worst system
      const worst = state.lowestSystemIndex();
      if (state.systems[worst] >= 100) continue;
      state.energy = state.energyMax; // Assume energy isn't the bottleneck for this test
      const cost = simulateRepair(state, worst, repairCostMult);
      if (cost >= 0) {
        totalRepairCost += cost;
        totalRepairs++;
        totalEnergySpent += ENERGY_COSTS.repair;
      }
    }

    // Passive income
    applyPassiveIncome(state, 1);
  }

  return {
    avgHealth: state.avgHealth(),
    repairsPerDay: totalRepairs / days,
    dailyCreditCost: totalRepairCost / days,
    dailyEnergyCost: totalEnergySpent / days,
    sustainable: state.avgHealth() > 50,
  };
}

function runCascadeSpiral(seed: number, rng: Rng): CascadeResult {
  const state = new PlayerState(10);
  // Set one system to critical to seed cascade
  state.systems[0] = 20;
  state.systems[1] = 40;

  let spiralHours = -1;
  for (let hour = 0; hour < 48; hour++) {
    tickDegradation(state, 1);
    tickCascade(state);
    tickCascade(state);

    const criticalCount = state.systems.filter(
      (hp) => hp > 0 && hp < CASCADE_THRESHOLD
    ).length + state.corruptedCount();
    if (criticalCount >= 3 && spiralHours < 0) {
      spiralHours = hour;
    }
  }

  return {
    spiralledToThreePlus: spiralHours >= 0,
    hoursToSpiral: spiralHours < 0 ? 48 : spiralHours,
  };
}

// -- Main --

function main() {
  const opts = parseCliOptions(process.argv.slice(2));
  console.log("=== System Health Sustainability Simulation ===");
  console.log(`runs=${opts.runs} seed=${opts.seed}`);

  // Scenario 1: Pure decay (no repairs)
  const decayResults: DecayResult[] = [];
  for (let i = 0; i < opts.runs; i++) {
    decayResults.push(runPureDecay(opts.seed + i, 1));
  }

  const criticalTimes = decayResults.map((r) => r.hoursToFirstCritical);
  const corruptedTimes = decayResults.map((r) => r.hoursToFirstCorrupted);
  const deathTimes = decayResults.map((r) => r.hoursToDeath);

  console.log("\n[Pure Decay - No Repairs]");
  console.log(`Hours to first CRITICAL (p50/p75/p90): ${percentile(criticalTimes, 50)} / ${percentile(criticalTimes, 75)} / ${percentile(criticalTimes, 90)}`);
  console.log(`Hours to first CORRUPTED (p50/p75/p90): ${percentile(corruptedTimes, 50)} / ${percentile(corruptedTimes, 75)} / ${percentile(corruptedTimes, 90)}`);
  console.log(`Hours to death (p50/p75/p90): ${percentile(deathTimes, 50)} / ${percentile(deathTimes, 75)} / ${percentile(deathTimes, 90)}`);

  // Scenario 2: Pure decay with System Overload (2x degradation)
  const overloadResults: DecayResult[] = [];
  for (let i = 0; i < opts.runs; i++) {
    overloadResults.push(runPureDecay(opts.seed + i, 2));
  }
  const overloadDeathTimes = overloadResults.map((r) => r.hoursToDeath);
  console.log("\n[Pure Decay - System Overload (2x)]");
  console.log(`Hours to death (p50/p75/p90): ${percentile(overloadDeathTimes, 50)} / ${percentile(overloadDeathTimes, 75)} / ${percentile(overloadDeathTimes, 90)}`);

  // Scenario 3: Active maintenance (repair every cooldown = 5 min)
  const activeResults: MaintenanceResult[] = [];
  for (let i = 0; i < opts.runs; i++) {
    const rng = new Rng(opts.seed + i);
    activeResults.push(runActiveMaintenance(opts.seed + i, REPAIR_COOLDOWN_SECONDS / 60, 1, 1, 0, rng));
  }
  console.log("\n[Active Maintenance - Every 5 min]");
  console.log(`Avg health: ${average(activeResults.map((r) => r.avgHealth)).toFixed(1)}`);
  console.log(`Repairs/day: ${average(activeResults.map((r) => r.repairsPerDay)).toFixed(1)}`);
  console.log(`Credits/day: ${average(activeResults.map((r) => r.dailyCreditCost)).toFixed(0)}`);
  console.log(`Energy/day: ${average(activeResults.map((r) => r.dailyEnergyCost)).toFixed(0)}`);

  // Scenario 4: Sparse maintenance (repair every 60 min)
  const sparseResults: MaintenanceResult[] = [];
  for (let i = 0; i < opts.runs; i++) {
    const rng = new Rng(opts.seed + i + 10000);
    sparseResults.push(runActiveMaintenance(opts.seed + i, 60, 1, 1, 0, rng));
  }
  console.log("\n[Sparse Maintenance - Every 60 min]");
  console.log(`Avg health: ${average(sparseResults.map((r) => r.avgHealth)).toFixed(1)}`);
  console.log(`Repairs/day: ${average(sparseResults.map((r) => r.repairsPerDay)).toFixed(1)}`);
  console.log(`Credits/day: ${average(sparseResults.map((r) => r.dailyCreditCost)).toFixed(0)}`);

  // Scenario 5: PvP compounding (3 attacks/day)
  const pvpResults: MaintenanceResult[] = [];
  for (let i = 0; i < opts.runs; i++) {
    const rng = new Rng(opts.seed + i + 20000);
    pvpResults.push(runActiveMaintenance(opts.seed + i, 30, 1, 1, 3, rng));
  }
  console.log("\n[Active Maintenance + 3 PvP attacks/day]");
  console.log(`Avg health: ${average(pvpResults.map((r) => r.avgHealth)).toFixed(1)}`);
  console.log(`Credits/day: ${average(pvpResults.map((r) => r.dailyCreditCost)).toFixed(0)}`);

  // Scenario 6: Cascade chain
  const cascadeResults: CascadeResult[] = [];
  for (let i = 0; i < opts.runs; i++) {
    const rng = new Rng(opts.seed + i + 30000);
    cascadeResults.push(runCascadeSpiral(opts.seed + i, rng));
  }
  const spiralRate = cascadeResults.filter((r) => r.spiralledToThreePlus && r.hoursToSpiral < 6).length / opts.runs;
  console.log("\n[Cascade Spiral Test]");
  console.log(`Spiral rate (3+ systems in <6h): ${(spiralRate * 100).toFixed(1)}%`);

  // -- Guardrails --
  const p50Corrupted = percentile(corruptedTimes, 50);
  const p50Death = percentile(deathTimes, 50);
  const realisticMaintenanceCost = average(sparseResults.map((r) => r.dailyCreditCost));
  const dailyPassiveIncome = PASSIVE_CREDITS_PER_HOUR * 24;

  const allPass = printGuardrails("sim:health", [
    {
      name: "Hours to first CORRUPTED (no repairs)",
      pass: p50Corrupted >= 48,
      detail: `p50=${p50Corrupted}h (need ≥48h)`,
    },
    {
      name: "Hours to death (no repairs)",
      pass: p50Death >= 60,
      detail: `p50=${p50Death}h (need ≥60h)`,
    },
    {
      name: "Sparse maintenance cost < 2x passive income",
      pass: realisticMaintenanceCost < dailyPassiveIncome * 2,
      detail: `${realisticMaintenanceCost.toFixed(0)}c/day vs ${dailyPassiveIncome}c/day passive`,
    },
    {
      name: "Cascade spiral rate <10%",
      pass: spiralRate < 0.10,
      detail: `${(spiralRate * 100).toFixed(1)}%`,
    },
  ]);

  if (!allPass) process.exit(1);
}

main();
