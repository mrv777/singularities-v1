import {
  ALL_MODULES,
  ENERGY_BASE_MAX,
  ENERGY_BASE_REGEN_PER_HOUR,
  ENERGY_MAX_PER_LEVEL,
  ENERGY_REGEN_PER_LEVEL,
  PROGRESSION_BALANCE,
  SCAN_ENERGY_COST,
  SCANNER_BALANCE,
  getBaseReward,
  getEarlyHackSuccessFloor,
  getHackEnergyCost,
  getLevelForXP,
} from "@singularities/shared";
import { Rng, average, parseCliOptions, percentile } from "./lib.js";

interface SimState {
  minutes: number;
  level: number;
  xp: number;
  credits: number;
  data: number;
  energy: number;
  energyMax: number;
  hackPower: number;
  modules: Record<string, number>;
  hacks: number;
  successes: number;
  firstTwentyHacks: number;
  firstTwentySuccesses: number;
  targetsBuffered: number;
}

interface SimResult {
  minutesToLevel4: number;
  minutesToLevel10: number;
  first20SuccessRate: number;
}

const HACK_MODULES = ALL_MODULES.filter((m) => (m.effects.hackPower ?? 0) > 0);
const MODULE_LEVEL_CAP_FOR_SIM = 3;

function regenPerMinute(level: number): number {
  return (ENERGY_BASE_REGEN_PER_HOUR + (level - 1) * ENERGY_REGEN_PER_LEVEL) / 60;
}

function runSingle(seed: number): SimResult {
  const rng = new Rng(seed);
  const state: SimState = {
    minutes: 0,
    level: 1,
    xp: 0,
    credits: 100,
    data: 50,
    energy: ENERGY_BASE_MAX,
    energyMax: ENERGY_BASE_MAX,
    hackPower: 0,
    modules: {},
    hacks: 0,
    successes: 0,
    firstTwentyHacks: 0,
    firstTwentySuccesses: 0,
    targetsBuffered: 0,
  };

  let level4At = -1;
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
      state.energy = Math.min(state.energyMax, state.energy);
      if (state.level >= 4 && level4At < 0) level4At = state.minutes;
      if (state.level >= 10 && level10At < 0) level10At = state.minutes;
    }
  };

  const buyBestModuleUpgrade = (): boolean => {
    if (state.level < PROGRESSION_BALANCE.unlockLevels.tech_tree) return false;

    const candidates = HACK_MODULES
      .map((m) => {
        const current = state.modules[m.id] ?? 0;
        if (current >= MODULE_LEVEL_CAP_FOR_SIM) return null;
        const cost = current === 0
          ? m.baseCost
          : {
            credits: m.baseCost.credits + m.costPerLevel.credits * current,
            data: m.baseCost.data + m.costPerLevel.data * current,
          };
        const deltaHackPower = m.effects.hackPower ?? 0;
        return { id: m.id, cost, deltaHackPower };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .filter((c) => c.cost.credits <= state.credits && c.cost.data <= state.data);

    if (candidates.length === 0) return false;

    candidates.sort((a, b) => {
      const scoreA = a.deltaHackPower / (a.cost.credits + a.cost.data * 2);
      const scoreB = b.deltaHackPower / (b.cost.credits + b.cost.data * 2);
      return scoreB - scoreA;
    });

    const chosen = candidates[0];
    state.credits -= chosen.cost.credits;
    state.data -= chosen.cost.data;
    state.modules[chosen.id] = (state.modules[chosen.id] ?? 0) + 1;
    state.hackPower += chosen.deltaHackPower;
    return true;
  };

  while (state.minutes < 720 && state.level < 10) {
    while (buyBestModuleUpgrade()) {
      // Keep buying while upgrades are affordable.
    }

    if (state.targetsBuffered <= 0) {
      waitForEnergy(SCAN_ENERGY_COST);
      if (state.minutes >= 720) break;
      state.energy -= SCAN_ENERGY_COST;
      state.minutes += 0.1;
      state.energy = Math.min(state.energyMax, state.energy + regenPerMinute(state.level) * 0.1);
      state.targetsBuffered = 5;
    }

    const security = Math.min(
      SCANNER_BALANCE.targetSecurity.max,
      SCANNER_BALANCE.targetSecurity.baseMin
      + rng.int(0, SCANNER_BALANCE.targetSecurity.randomRange)
      + state.level * SCANNER_BALANCE.targetSecurity.levelStep
    );
    const hackCost = getHackEnergyCost(security);
    waitForEnergy(hackCost);
    if (state.minutes >= 720) break;

    // Simulate hack execution time.
    state.energy -= hackCost;
    state.minutes += 0.2;
    state.energy = Math.min(state.energyMax, state.energy + regenPerMinute(state.level) * 0.2);
    state.targetsBuffered -= 1;

    state.hacks += 1;
    if (state.firstTwentyHacks < 20) {
      state.firstTwentyHacks += 1;
    }
    const baseChance = SCANNER_BALANCE.hackSuccess.baseChance + (state.hackPower - security);
    const chance = Math.max(
      getEarlyHackSuccessFloor(state.level),
      Math.min(SCANNER_BALANCE.hackSuccess.maxChance, baseChance)
    );
    const success = rng.int(1, 100) <= chance;

    if (success) {
      state.successes += 1;
      if (state.hacks <= 20) {
        state.firstTwentySuccesses += 1;
      }
      const reward = getBaseReward(security);
      state.credits += reward.credits;
      state.data += reward.data;
      state.xp += reward.xp;
      applyLeveling();
    }
  }

  return {
    minutesToLevel4: level4At,
    minutesToLevel10: level10At,
    first20SuccessRate: state.firstTwentyHacks > 0
      ? state.firstTwentySuccesses / state.firstTwentyHacks
      : 0,
  };
}

function main() {
  const opts = parseCliOptions(process.argv.slice(2));
  const results: SimResult[] = [];
  for (let i = 0; i < opts.runs; i++) {
    results.push(runSingle(opts.seed + i));
  }

  const level4Times = results.map((r) => r.minutesToLevel4).filter((v) => v >= 0);
  const level10Times = results.map((r) => r.minutesToLevel10).filter((v) => v >= 0);
  const successRates = results.map((r) => r.first20SuccessRate * 100);

  console.log("=== Progression Simulation ===");
  console.log(`runs=${opts.runs} seed=${opts.seed}`);
  console.log(`Reached level 4: ${level4Times.length}/${opts.runs}`);
  console.log(`Reached level 10: ${level10Times.length}/${opts.runs}`);
  console.log(
    `Level 4 minutes (p50/p75/p90): ${percentile(level4Times, 50).toFixed(1)} / ${percentile(level4Times, 75).toFixed(1)} / ${percentile(level4Times, 90).toFixed(1)}`
  );
  console.log(
    `Level 10 minutes (p50/p75/p90): ${percentile(level10Times, 50).toFixed(1)} / ${percentile(level10Times, 75).toFixed(1)} / ${percentile(level10Times, 90).toFixed(1)}`
  );
  console.log(`First-20 hack success rate avg: ${average(successRates).toFixed(1)}%`);
}

main();
