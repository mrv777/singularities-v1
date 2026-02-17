/**
 * Death/Rebirth Cycle Simulation
 *
 * Tests death frequency, module recovery value, trait combos,
 * recovery time, and death spiral detection.
 */
import {
  XP_THRESHOLDS,
  ALL_TRAITS,
  REBIRTH_TRAIT_COUNT_MIN,
  REBIRTH_TRAIT_COUNT_MAX,
  ALL_MODULES,
  DEGRADATION_RATE_PER_HOUR,
  DEATH_MODULE_RECOVERY_CHANCE,
  getLevelForXP,
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
  simulateHack,
  applyPassiveIncome,
  printGuardrails,
} from "./lib.js";

interface DeathFreqResult {
  daysToDeath: number;
  died: boolean;
}

interface RecoveryResult {
  daysToRecover: number; // Days to reach previous level
  recoveredModuleValue: number;
  originalModuleValue: number;
  recoveryPct: number;
}

interface TraitComboResult {
  traitIds: string[];
  netScore: number;
  isNetNegative: boolean;
}

interface DeathSpiralResult {
  reDeathWithin48h: boolean;
  hoursToDeath: number;
}

function simulateActiveDay(state: PlayerState, rng: Rng, repairInterval: number): void {
  for (let hour = 0; hour < 4; hour++) { // 4 hours of active play
    // Degradation
    tickDegradation(state, 1);
    tickCascade(state);
    tickCascade(state);

    // Hacking
    for (let h = 0; h < 6; h++) {
      state.energy = Math.min(state.energyMax, state.energy + state.regenPerMinute() * 10);
      if (state.energy >= 8) {
        simulateHack(state, rng);
      }
    }

    // Repair at interval
    if (hour % repairInterval === 0) {
      for (let i = 0; i < 6; i++) {
        if (state.systems[i] < 70) {
          state.energy = Math.min(state.energyMax, state.energy + 20);
          simulateRepair(state, i);
        }
      }
    }

    // PvP (random attacks received)
    if (rng.chance(0.15)) {
      const idx = rng.int(0, 5);
      state.systems[idx] = Math.max(0, state.systems[idx] - rng.int(10, 20));
    }
  }

  // 20 hours offline: degradation only
  tickDegradation(state, 20);
  // 40 cascade ticks in 20 hours
  for (let t = 0; t < 40; t++) {
    tickCascade(state);
  }

  // Passive income
  applyPassiveIncome(state, 24);
  state.energy = state.energyMax;
}

function runDeathFrequency(seed: number, archetype: "active" | "casual"): DeathFreqResult {
  const rng = new Rng(seed);
  const state = new PlayerState(10);
  state.credits = 500;
  const repairInterval = archetype === "active" ? 1 : 2;
  const maxDays = 60;

  for (let day = 0; day < maxDays; day++) {
    simulateActiveDay(state, rng, repairInterval);
    if (checkDeath(state)) {
      return { daysToDeath: day + 1, died: true };
    }
  }
  return { daysToDeath: maxDays, died: false };
}

function computeModuleCost(modId: string, level: number): number {
  const mod = ALL_MODULES.find((m) => m.id === modId);
  if (!mod) return 0;
  let total = 0;
  for (let l = 0; l < level; l++) {
    if (l === 0) total += mod.baseCost.credits + mod.baseCost.data * 1.5;
    else total += (mod.baseCost.credits + mod.costPerLevel.credits * l) + (mod.baseCost.data + mod.costPerLevel.data * l) * 1.5;
  }
  return total;
}

function runModuleRecovery(seed: number): RecoveryResult {
  const rng = new Rng(seed);
  // Simulate a player with 5 modules at various levels
  const ownedModules = ALL_MODULES.slice(0, 5).map((m, i) => ({
    id: m.id,
    level: Math.min(m.maxLevel, 2 + rng.int(0, 2)),
  }));

  // Sort by level descending (highest guaranteed)
  ownedModules.sort((a, b) => b.level - a.level);
  const original = ownedModules.reduce((s, m) => s + computeModuleCost(m.id, m.level), 0);

  // Guaranteed: highest level module (preserves level on rebirth)
  let recovered = computeModuleCost(ownedModules[0].id, ownedModules[0].level);
  // Match live server carryover probability
  for (let i = 1; i < ownedModules.length; i++) {
    if (rng.chance(DEATH_MODULE_RECOVERY_CHANCE)) {
      recovered += computeModuleCost(ownedModules[i].id, ownedModules[i].level);
    }
  }

  return {
    daysToRecover: 0, // Computed separately
    recoveredModuleValue: recovered,
    originalModuleValue: original,
    recoveryPct: original > 0 ? recovered / original : 0,
  };
}

function runTraitCombos(): TraitComboResult[] {
  const results: TraitComboResult[] = [];
  // Test all 2-trait combos
  for (let i = 0; i < ALL_TRAITS.length; i++) {
    for (let j = i + 1; j < ALL_TRAITS.length; j++) {
      const t1 = ALL_TRAITS[i];
      const t2 = ALL_TRAITS[j];
      // Score: sum positive modifiers * weight - sum negative modifiers * weight
      const positiveScore = t1.positive.modifier + t2.positive.modifier;
      const negativeScore = Math.abs(t1.negative.modifier) + Math.abs(t2.negative.modifier);
      const netScore = positiveScore - negativeScore;
      results.push({
        traitIds: [t1.id, t2.id],
        netScore,
        isNetNegative: netScore < 0,
      });
    }
  }
  return results;
}

function runDeathSpiral(seed: number): DeathSpiralResult {
  const rng = new Rng(seed);
  // Post-death state: level 1, starting resources, maybe some modules at level 1
  const state = new PlayerState(1);
  state.credits = 100;
  state.data = 50;
  // Simulate with moderate degradation active from start
  for (let hour = 0; hour < 48; hour++) {
    tickDegradation(state, 1);
    if (hour % 2 === 0) {
      tickCascade(state);
    }
    // New player trying to hack
    if (state.energy >= 8) {
      simulateHack(state, rng);
    }
    state.energy = Math.min(state.energyMax, state.energy + state.regenPerMinute() * 60);

    // Try repairs
    if (hour % 4 === 0) {
      const worst = state.lowestSystemIndex();
      if (state.systems[worst] < 60) {
        simulateRepair(state, worst);
      }
    }

    if (checkDeath(state)) {
      return { reDeathWithin48h: true, hoursToDeath: hour };
    }
  }
  return { reDeathWithin48h: false, hoursToDeath: 48 };
}

function main() {
  const opts = parseCliOptions(process.argv.slice(2));
  console.log("=== Death/Rebirth Cycle Simulation ===");
  console.log(`runs=${opts.runs} seed=${opts.seed}`);

  const guardrails: Array<{ name: string; pass: boolean; detail: string }> = [];

  // -- Death frequency for active players --
  console.log("\n[Death Frequency - Active Player]");
  const activeDeaths: DeathFreqResult[] = [];
  for (let i = 0; i < opts.runs; i++) {
    activeDeaths.push(runDeathFrequency(opts.seed + i, "active"));
  }
  const activeDied = activeDeaths.filter((r) => r.died);
  const activeDeathDays = activeDied.map((r) => r.daysToDeath);
  console.log(`Death rate (60 days): ${(activeDied.length / opts.runs * 100).toFixed(1)}%`);
  if (activeDeathDays.length > 0) {
    console.log(`Days to death (p25/p50/p75): ${percentile(activeDeathDays, 25)} / ${percentile(activeDeathDays, 50)} / ${percentile(activeDeathDays, 75)}`);
  }

  const medianDeathDays = activeDeathDays.length > 0 ? percentile(activeDeathDays, 50) : 60;
  guardrails.push({
    name: "Death interval for active players",
    pass: medianDeathDays >= 5,
    detail: `p50=${medianDeathDays} days (need ≥5)`,
  });

  // -- Module recovery --
  console.log("\n[Module Recovery Value]");
  const recoveryResults: RecoveryResult[] = [];
  for (let i = 0; i < opts.runs; i++) {
    recoveryResults.push(runModuleRecovery(opts.seed + i + 10000));
  }
  const avgRecoveryPct = average(recoveryResults.map((r) => r.recoveryPct));
  console.log(`Avg recovery %: ${(avgRecoveryPct * 100).toFixed(1)}%`);

  guardrails.push({
    name: "Module recovery ≥25% of investment",
    pass: avgRecoveryPct >= 0.25,
    detail: `${(avgRecoveryPct * 100).toFixed(1)}% (need ≥25%)`,
  });

  // -- Trait combos --
  console.log("\n[Trait Combo Analysis]");
  const traitResults = runTraitCombos();
  const netNegativeCount = traitResults.filter((r) => r.isNetNegative).length;
  const netNegativeRate = netNegativeCount / traitResults.length;
  console.log(`Total 2-trait combos: ${traitResults.length}`);
  console.log(`Net-negative combos: ${netNegativeCount} (${(netNegativeRate * 100).toFixed(1)}%)`);

  guardrails.push({
    name: "Net-negative trait combos ≤25%",
    pass: netNegativeRate <= 0.25,
    detail: `${(netNegativeRate * 100).toFixed(1)}% (need ≤25%)`,
  });

  // -- Death spiral test --
  console.log("\n[Death Spiral Test]");
  const spiralResults: DeathSpiralResult[] = [];
  for (let i = 0; i < opts.runs; i++) {
    spiralResults.push(runDeathSpiral(opts.seed + i + 20000));
  }
  const spiralRate = spiralResults.filter((r) => r.reDeathWithin48h).length / opts.runs;
  console.log(`Re-death within 48h rate: ${(spiralRate * 100).toFixed(1)}%`);

  guardrails.push({
    name: "Death spiral rate (<48h re-death) ≤8%",
    pass: spiralRate <= 0.08,
    detail: `${(spiralRate * 100).toFixed(1)}% (need ≤8%)`,
  });

  const allPass = printGuardrails("sim:death", guardrails);
  if (!allPass) process.exit(1);
}

main();
