import {
  ALL_MODULES,
  DATA_VAULT_BALANCE,
  DATA_VAULT_PROTOCOLS,
  ENERGY_BASE_MAX,
  ENERGY_BASE_REGEN_PER_HOUR,
  ENERGY_MAX_PER_LEVEL,
  ENERGY_REGEN_PER_LEVEL,
  MINIGAME_BALANCE,
  PROGRESSION_BALANCE,
  SCAN_ENERGY_COST,
  SCANNER_BALANCE,
  TIER_UNLOCK_REQUIREMENT,
  getBaseReward,
  getEnergyAfterLevelUp,
  getLevelForXP,
  getScoreMultiplier,
  type ModuleDefinition,
  type ModuleTier,
} from "@singularities/shared";
import { Rng, parseCliOptions, percentile } from "./lib.js";

interface BalanceProfile {
  name: string;
  modulePurchaseXp: number;
  unlockSystemMaintenance: number;
  unlockScriptManager: number;
  unlockDataVault: number;
  dataVaultEnabled: boolean;
  securityBaseMin: number;
  securityStep: number;
  solveBaseChance: number;
  solveMinChance: number;
  solvedScoreMean: number;
  solvedScoreSpread: number;
  failScoreMean: number;
}

interface ProfileResult {
  level30: number;
  level60: number;
  credits30: number;
  credits60: number;
  data30: number;
  data60: number;
  minutesToLevel5: number;
  minutesToLevel6: number;
  minutesToLevel7: number;
  minutesToLevel9: number;
  first20SuccessRate: number;
  unlockedMaintenanceBy60: boolean;
  unlockedScriptsBy60: boolean;
  unlockedDataVaultBy60: boolean;
  dataVaultActivatedBy60: boolean;
  dataVaultActivations: number;
}

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
  firstTwentyHacks: number;
  firstTwentySuccesses: number;
  levelAt30: number;
  levelAt60: number;
  creditsAt30: number;
  creditsAt60: number;
  dataAt30: number;
  dataAt60: number;
  dataVaultActiveUntil: number;
  dataVaultCooldownUntil: number;
  dataVaultUsesToday: number;
  dataVaultActivatedBy60: boolean;
}

const HACK_MODULES = ALL_MODULES.filter((m) => (m.effects.hackPower ?? 0) > 0);
const MODULE_LEVEL_CAP_FOR_SIM = 3;
const DATA_VAULT_RECOMMENDED_PROTOCOL =
  DATA_VAULT_PROTOCOLS.find((p) => p.recommended) ?? DATA_VAULT_PROTOCOLS[0];
const DATA_VAULT_HACK_BONUS = DATA_VAULT_RECOMMENDED_PROTOCOL.buffs.hackPower ?? 0;

const BASELINE_PROFILE: BalanceProfile = {
  // Snapshot of pre-tune values for direct before/after comparison.
  name: "baseline_pre_tune",
  modulePurchaseXp: 20,
  unlockSystemMaintenance: 5,
  unlockScriptManager: 7,
  unlockDataVault: 999,
  dataVaultEnabled: false,
  securityBaseMin: 15,
  securityStep: 4,
  solveBaseChance: 76,
  solveMinChance: 60,
  solvedScoreMean: 70,
  solvedScoreSpread: 18,
  failScoreMean: 22,
};

const TUNED_PROFILE_NO_VAULT: BalanceProfile = {
  name: "tuned_current_no_vault",
  modulePurchaseXp: PROGRESSION_BALANCE.modulePurchaseXp,
  unlockSystemMaintenance: PROGRESSION_BALANCE.unlockLevels.system_maintenance,
  unlockScriptManager: PROGRESSION_BALANCE.unlockLevels.script_manager,
  unlockDataVault: PROGRESSION_BALANCE.unlockLevels.data_vault,
  dataVaultEnabled: false,
  securityBaseMin: SCANNER_BALANCE.targetSecurity.baseMin,
  securityStep: SCANNER_BALANCE.targetSecurity.levelStep,
  solveBaseChance: 86,
  solveMinChance: 72,
  solvedScoreMean: 79,
  solvedScoreSpread: 12,
  failScoreMean: 26,
};

const TUNED_PROFILE_WITH_VAULT: BalanceProfile = {
  ...TUNED_PROFILE_NO_VAULT,
  name: "tuned_current_with_data_vault",
  dataVaultEnabled: true,
};

function regenPerMinute(level: number): number {
  return (ENERGY_BASE_REGEN_PER_HOUR + (level - 1) * ENERGY_REGEN_PER_LEVEL) / 60;
}

function getEffectiveHackPower(modules: Record<string, number>): number {
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

function sampleMinigameTarget(
  rng: Rng,
  level: number,
  profile: BalanceProfile,
): { security: number; rewards: { credits: number; data: number; xp: number } } {
  let bestSecurity = 0;
  for (let i = 0; i < 5; i++) {
    const security = Math.min(
      SCANNER_BALANCE.targetSecurity.max,
      profile.securityBaseMin + rng.int(0, SCANNER_BALANCE.targetSecurity.randomRange)
      + level * profile.securityStep
    );
    if (security > bestSecurity) bestSecurity = security;
  }

  const base = getBaseReward(bestSecurity);
  const economicMult = MINIGAME_BALANCE.economicMultiplierByTier[getTierIndex(bestSecurity)];
  return {
    security: bestSecurity,
    rewards: {
      credits: Math.floor(base.credits * economicMult * MINIGAME_BALANCE.globalRewardMultiplier),
      data: Math.floor(base.data * economicMult * MINIGAME_BALANCE.globalRewardMultiplier),
      xp: Math.floor(base.xp * MINIGAME_BALANCE.rewardMultiplier * MINIGAME_BALANCE.globalRewardMultiplier),
    },
  };
}

function runSingle(seed: number, profile: BalanceProfile): ProfileResult {
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
    firstTwentyHacks: 0,
    firstTwentySuccesses: 0,
    levelAt30: 1,
    levelAt60: 1,
    creditsAt30: 100,
    creditsAt60: 100,
    dataAt30: 50,
    dataAt60: 50,
    dataVaultActiveUntil: -1,
    dataVaultCooldownUntil: -1,
    dataVaultUsesToday: 0,
    dataVaultActivatedBy60: false,
  };

  let level5At = -1;
  let level6At = -1;
  let level7At = -1;
  let level9At = -1;
  let captured30 = false;
  let captured60 = false;

  const checkpointLevels = () => {
    if (!captured30 && state.minutes >= 30) {
      captured30 = true;
      state.levelAt30 = state.level;
      state.creditsAt30 = state.credits;
      state.dataAt30 = state.data;
    }
    if (!captured60 && state.minutes >= 60) {
      captured60 = true;
      state.levelAt60 = state.level;
      state.creditsAt60 = state.credits;
      state.dataAt60 = state.data;
    }
  };

  const waitForEnergy = (requiredEnergy: number) => {
    while (state.energy < requiredEnergy && state.minutes < 360) {
      state.minutes += 0.25;
      state.energy = Math.min(state.energyMax, state.energy + regenPerMinute(state.level) * 0.25);
      checkpointLevels();
    }
  };

  const applyLeveling = () => {
    const nextLevel = getLevelForXP(state.xp);
    if (nextLevel > state.level) {
      state.level = nextLevel;
      state.energyMax = ENERGY_BASE_MAX + (state.level - 1) * ENERGY_MAX_PER_LEVEL;
      state.energy = getEnergyAfterLevelUp(state.energy, state.energyMax);
      if (state.level >= 5 && level5At < 0) level5At = state.minutes;
      if (state.level >= 6 && level6At < 0) level6At = state.minutes;
      if (state.level >= 7 && level7At < 0) level7At = state.minutes;
      if (state.level >= 9 && level9At < 0) level9At = state.minutes;
    }
  };

  const maybeActivateDataVault = () => {
    if (!profile.dataVaultEnabled) return;
    if (state.level < profile.unlockDataVault) return;
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
    if (state.minutes <= 60) {
      state.dataVaultActivatedBy60 = true;
    }
  };

  const buyBestModuleUpgrade = (): boolean => {
    if (state.level < PROGRESSION_BALANCE.unlockLevels.tech_tree) return false;

    const currentEffective = getEffectiveHackPower(state.modules);
    const candidates = HACK_MODULES
      .map((m) => {
        const current = state.modules[m.id] ?? 0;
        if (current >= MODULE_LEVEL_CAP_FOR_SIM) return null;
        if (current === 0 && !canUnlockModule(m, state.modules)) return null;
        const cost = costForNextLevel(m, current);
        if (cost.credits > state.credits || cost.data > state.data) return null;

        const nextModules = { ...state.modules, [m.id]: current + 1 };
        const nextEffective = getEffectiveHackPower(nextModules);
        const deltaEffective = nextEffective - currentEffective;
        const rawDelta = m.effects.hackPower ?? 0;
        const score = (deltaEffective > 0 ? deltaEffective : rawDelta * 0.2)
          / (cost.credits + cost.data * 2);
        return { id: m.id, cost, score };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 0 || candidates[0].score <= 0) return false;

    const chosen = candidates[0];
    state.credits -= chosen.cost.credits;
    state.data -= chosen.cost.data;
    state.modules[chosen.id] = (state.modules[chosen.id] ?? 0) + 1;
    state.xp += profile.modulePurchaseXp;
    applyLeveling();
    return true;
  };

  while (state.minutes < 360 && state.level < 10) {
    while (buyBestModuleUpgrade()) {
      // Keep buying while upgrades are affordable.
    }

    maybeActivateDataVault();

    // Live loop: scan -> choose one target -> play one minigame -> resolve -> repeat.
    waitForEnergy(SCAN_ENERGY_COST);
    if (state.minutes >= 360) break;
    state.energy -= SCAN_ENERGY_COST;
    state.minutes += 0.1; // scan request + target selection overhead
    state.energy = Math.min(state.energyMax, state.energy + regenPerMinute(state.level) * 0.1);
    checkpointLevels();

    const target = sampleMinigameTarget(rng, state.level, profile);
    state.hacks += 1;
    if (state.firstTwentyHacks < 20) state.firstTwentyHacks += 1;

    const dataVaultHackBonus = state.minutes < state.dataVaultActiveUntil
      ? DATA_VAULT_HACK_BONUS
      : 0;
    const effectiveHackPower = getEffectiveHackPower(state.modules) + dataVaultHackBonus;

    const levelPenalty = Math.max(0, state.level - 5) * 0.85;
    const solveChance = Math.min(
      98,
      Math.max(
        profile.solveMinChance,
        profile.solveBaseChance
          + state.level * 0.45
          + effectiveHackPower * 0.65
          - Math.max(0, target.security - 28) * 0.60
          - levelPenalty
      )
    );
    const solved = rng.int(1, 100) <= solveChance;
    const solvedScoreMean = profile.solvedScoreMean - Math.max(0, state.level - 6) * 0.55;
    const solvedScore = solvedScoreMean + rng.int(-profile.solvedScoreSpread, profile.solvedScoreSpread);
    const failScore = profile.failScoreMean + rng.int(-8, 8);
    const score = solved
      ? Math.max(50, Math.min(100, solvedScore))
      : Math.max(1, Math.min(49, failScore));
    const scoreMult = getScoreMultiplier(score);

    if (solved && state.hacks <= 20) state.firstTwentySuccesses += 1;
    state.credits += Math.floor(target.rewards.credits * scoreMult);
    state.data += Math.floor(target.rewards.data * scoreMult);
    state.xp += Math.floor(target.rewards.xp * scoreMult);
    applyLeveling();

    const playMinutes = solved
      ? 1.2 + rng.next() * 1.2
      : 1.5 + rng.next() * 1.5;
    state.minutes += playMinutes;
    state.energy = Math.min(state.energyMax, state.energy + regenPerMinute(state.level) * playMinutes);

    checkpointLevels();
  }

  if (!captured30) {
    state.levelAt30 = state.level;
    state.creditsAt30 = state.credits;
    state.dataAt30 = state.data;
  }
  if (!captured60) {
    state.levelAt60 = state.level;
    state.creditsAt60 = state.credits;
    state.dataAt60 = state.data;
  }

  return {
    level30: state.levelAt30,
    level60: state.levelAt60,
    credits30: state.creditsAt30,
    credits60: state.creditsAt60,
    data30: state.dataAt30,
    data60: state.dataAt60,
    minutesToLevel5: level5At,
    minutesToLevel6: level6At,
    minutesToLevel7: level7At,
    minutesToLevel9: level9At,
    first20SuccessRate: state.firstTwentyHacks > 0
      ? state.firstTwentySuccesses / state.firstTwentyHacks
      : 0,
    unlockedMaintenanceBy60: state.levelAt60 >= profile.unlockSystemMaintenance,
    unlockedScriptsBy60: state.levelAt60 >= profile.unlockScriptManager,
    unlockedDataVaultBy60: state.levelAt60 >= profile.unlockDataVault,
    dataVaultActivatedBy60: state.dataVaultActivatedBy60,
    dataVaultActivations: state.dataVaultUsesToday,
  };
}

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function summarizeProfile(name: string, rows: ProfileResult[]): void {
  const level30 = rows.map((r) => r.level30);
  const level60 = rows.map((r) => r.level60);
  const credits30 = rows.map((r) => r.credits30);
  const credits60 = rows.map((r) => r.credits60);
  const data30 = rows.map((r) => r.data30);
  const data60 = rows.map((r) => r.data60);
  const l5 = rows.map((r) => r.minutesToLevel5).filter((v) => v >= 0);
  const l6 = rows.map((r) => r.minutesToLevel6).filter((v) => v >= 0);
  const l7 = rows.map((r) => r.minutesToLevel7).filter((v) => v >= 0);
  const l9 = rows.map((r) => r.minutesToLevel9).filter((v) => v >= 0);
  const first20 = rows.map((r) => r.first20SuccessRate);
  const maintenanceBy60 = rows.filter((r) => r.unlockedMaintenanceBy60).length / rows.length;
  const scriptsBy60 = rows.filter((r) => r.unlockedScriptsBy60).length / rows.length;
  const dataVaultBy60 = rows.filter((r) => r.unlockedDataVaultBy60).length / rows.length;
  const dataVaultActivatedBy60 = rows.filter((r) => r.dataVaultActivatedBy60).length / rows.length;
  const dataVaultActivations = rows.map((r) => r.dataVaultActivations);

  console.log(`\n[${name}]`);
  console.log(
    `Level at 30m (p50/p75/p90): ${percentile(level30, 50)} / ${percentile(level30, 75)} / ${percentile(level30, 90)}`
  );
  console.log(
    `Level at 60m (p50/p75/p90): ${percentile(level60, 50)} / ${percentile(level60, 75)} / ${percentile(level60, 90)}`
  );
  console.log(
    `Credits at 30m (p50/p75/p90): ${percentile(credits30, 50)} / ${percentile(credits30, 75)} / ${percentile(credits30, 90)}`
  );
  console.log(
    `Credits at 60m (p50/p75/p90): ${percentile(credits60, 50)} / ${percentile(credits60, 75)} / ${percentile(credits60, 90)}`
  );
  console.log(
    `Data at 30m (p50/p75/p90): ${percentile(data30, 50)} / ${percentile(data30, 75)} / ${percentile(data30, 90)}`
  );
  console.log(
    `Data at 60m (p50/p75/p90): ${percentile(data60, 50)} / ${percentile(data60, 75)} / ${percentile(data60, 90)}`
  );
  console.log(
    `Level 5 minutes (p50/p75/p90): ${percentile(l5, 50).toFixed(1)} / ${percentile(l5, 75).toFixed(1)} / ${percentile(l5, 90).toFixed(1)}`
  );
  console.log(
    `Level 6 minutes (p50/p75/p90): ${percentile(l6, 50).toFixed(1)} / ${percentile(l6, 75).toFixed(1)} / ${percentile(l6, 90).toFixed(1)}`
  );
  console.log(
    `Level 7 minutes (p50/p75/p90): ${percentile(l7, 50).toFixed(1)} / ${percentile(l7, 75).toFixed(1)} / ${percentile(l7, 90).toFixed(1)}`
  );
  console.log(
    `Level 9 minutes (p50/p75/p90): ${percentile(l9, 50).toFixed(1)} / ${percentile(l9, 75).toFixed(1)} / ${percentile(l9, 90).toFixed(1)}`
  );
  const first20Avg = first20.reduce((sum, v) => sum + v, 0) / first20.length;
  const avgVaultActivations = dataVaultActivations.reduce((sum, v) => sum + v, 0) / dataVaultActivations.length;
  console.log(`First-20 success avg: ${fmtPct(first20Avg)}`);
  console.log(`Maintenance unlocked by 60m: ${fmtPct(maintenanceBy60)}`);
  console.log(`Scripts unlocked by 60m: ${fmtPct(scriptsBy60)}`);
  console.log(`Data Vault unlocked by 60m: ${fmtPct(dataVaultBy60)}`);
  console.log(`Data Vault activated by 60m: ${fmtPct(dataVaultActivatedBy60)}`);
  console.log(`Data Vault activations avg (session): ${avgVaultActivations.toFixed(2)}`);
}

function main() {
  const opts = parseCliOptions(process.argv.slice(2));
  const profiles: BalanceProfile[] = [
    BASELINE_PROFILE,
    TUNED_PROFILE_NO_VAULT,
    TUNED_PROFILE_WITH_VAULT,
  ];

  const resultsByProfile: Record<string, ProfileResult[]> = Object.fromEntries(
    profiles.map((profile) => [profile.name, [] as ProfileResult[]])
  );

  for (let i = 0; i < opts.runs; i++) {
    const seed = opts.seed + i * 97;
    for (const profile of profiles) {
      resultsByProfile[profile.name].push(runSingle(seed, profile));
    }
  }

  console.log("=== Day 1 Hook Simulation ===");
  console.log(`runs=${opts.runs} seed=${opts.seed}`);
  for (const profile of profiles) {
    summarizeProfile(profile.name, resultsByProfile[profile.name]);
  }
}

main();
