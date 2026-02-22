export interface CliOptions {
  runs: number;
  days: number;
  seed: number;
}

export function parseCliOptions(argv: string[]): CliOptions {
  const opts: CliOptions = {
    runs: 400,
    days: 7,
    seed: 1337,
  };
  for (const arg of argv) {
    if (arg.startsWith("--runs=")) opts.runs = Number(arg.slice("--runs=".length)) || opts.runs;
    if (arg.startsWith("--days=")) opts.days = Number(arg.slice("--days=".length)) || opts.days;
    if (arg.startsWith("--seed=")) opts.seed = Number(arg.slice("--seed=".length)) || opts.seed;
  }
  return opts;
}

export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// ---------------------------------------------------------------------------
// Shared PlayerState for multi-simulation reuse
// ---------------------------------------------------------------------------

import {
  DEGRADATION_RATE_PER_HOUR,
  CASCADE_DAMAGE_PER_TICK,
  CASCADE_THRESHOLD,
  DEATH_CORRUPTED_COUNT,
  SYSTEM_TYPES,
  SYSTEM_ADJACENCY,
  ENERGY_BASE_MAX,
  ENERGY_MAX_PER_LEVEL,
  ENERGY_BASE_REGEN_PER_HOUR,
  ENERGY_REGEN_PER_LEVEL,
  ENERGY_COSTS,
  REPAIR_HEALTH_AMOUNT,
  SCANNER_BALANCE,
  PVP_WIN_CHANCE_MIN,
  PVP_WIN_CHANCE_MAX,
  PVP_WIN_CHANCE_SCALE,
  PVP_ENERGY_COST,
  PVP_LOSER_DAMAGE_MIN_PCT,
  PVP_LOSER_DAMAGE_MAX_PCT,
  PVP_LOSER_SYSTEMS_MIN,
  PVP_LOSER_SYSTEMS_MAX,
  PVP_REWARD_CREDITS_MIN,
  PVP_REWARD_CREDITS_MAX,
  PVP_REWARD_CREDITS_LEVEL_BONUS,
  PVP_REWARD_XP,
  PVP_REWARD_DATA_MIN,
  PVP_REWARD_DATA_MAX,
  PVP_REWARD_DATA_LEVEL_BONUS,
  PASSIVE_CREDITS_PER_HOUR,
  PASSIVE_DATA_PER_HOUR,
  PASSIVE_MAX_HOURS,
  SCAN_ENERGY_COST,
  XP_THRESHOLDS,
  getLevelForXP,
  getEnergyAfterLevelUp,
  getBaseReward,
  getEarlyHackSuccessFloor,
  getRepairCreditCostForHealth,
  type SystemType,
  type ModifierEffect,
} from "@singularities/shared";

export interface PlayerModule {
  id: string;
  level: number;
  mutation: string | null;
}

export class PlayerState {
  level = 1;
  xp = 0;
  credits = 100;
  data = 50;
  processingPower = 0;
  reputation = 0;
  energy: number;
  energyMax: number;
  systems: number[]; // 6-element HP array, index maps to SYSTEM_TYPES
  modules: PlayerModule[] = [];
  alignment = 0;
  traits: string[] = [];
  seenDecisions = new Set<string>();
  heat = 0;

  constructor(level = 1) {
    this.level = level;
    this.xp = level > 1 ? XP_THRESHOLDS[level - 1] : 0;
    this.energyMax = ENERGY_BASE_MAX + (level - 1) * ENERGY_MAX_PER_LEVEL;
    this.energy = this.energyMax;
    this.systems = Array(6).fill(100);
  }

  regenPerMinute(): number {
    return (ENERGY_BASE_REGEN_PER_HOUR + (this.level - 1) * ENERGY_REGEN_PER_LEVEL) / 60;
  }

  applyLeveling(): boolean {
    const next = getLevelForXP(this.xp);
    if (next > this.level) {
      this.level = next;
      this.energyMax = ENERGY_BASE_MAX + (this.level - 1) * ENERGY_MAX_PER_LEVEL;
      this.energy = getEnergyAfterLevelUp(this.energy, this.energyMax);
      return true;
    }
    return false;
  }

  systemStatus(idx: number): "OPTIMAL" | "DEGRADED" | "CRITICAL" | "CORRUPTED" {
    const hp = this.systems[idx];
    if (hp <= 0) return "CORRUPTED";
    if (hp < CASCADE_THRESHOLD) return "CRITICAL";
    if (hp < 75) return "DEGRADED";
    return "OPTIMAL";
  }

  corruptedCount(): number {
    return this.systems.filter((hp) => hp <= 0).length;
  }

  avgHealth(): number {
    return this.systems.reduce((s, h) => s + h, 0) / this.systems.length;
  }

  lowestSystemIndex(): number {
    let min = 0;
    for (let i = 1; i < this.systems.length; i++) {
      if (this.systems[i] < this.systems[min]) min = i;
    }
    return min;
  }
}

/** Apply passive degradation over `hours` to all systems. */
export function tickDegradation(
  state: PlayerState,
  hours: number,
  degradationMultiplier = 1
): void {
  const dmg = DEGRADATION_RATE_PER_HOUR * hours * degradationMultiplier;
  for (let i = 0; i < state.systems.length; i++) {
    state.systems[i] = Math.max(0, state.systems[i] - dmg);
  }
}

/** Apply cascade damage: systems below CASCADE_THRESHOLD hurt neighbors. */
export function tickCascade(state: PlayerState): void {
  const cascadeDmg: number[] = Array(6).fill(0);
  for (let i = 0; i < state.systems.length; i++) {
    if (state.systems[i] > 0 && state.systems[i] < CASCADE_THRESHOLD) {
      const sysType = SYSTEM_TYPES[i];
      const neighbors = SYSTEM_ADJACENCY[sysType];
      for (const nType of neighbors) {
        const nIdx = SYSTEM_TYPES.indexOf(nType);
        if (nIdx >= 0) cascadeDmg[nIdx] += CASCADE_DAMAGE_PER_TICK;
      }
    }
  }
  for (let i = 0; i < state.systems.length; i++) {
    state.systems[i] = Math.max(0, state.systems[i] - cascadeDmg[i]);
  }
}

/** Simulate one hack attempt. Returns { success, rewards }. */
export function simulateHack(
  state: PlayerState,
  rng: Rng,
  modifiers: { hackRewardMultiplier?: number; xpGainMultiplier?: number } = {}
): { success: boolean; credits: number; data: number; xp: number } {
  const security = Math.min(
    SCANNER_BALANCE.targetSecurity.max,
    SCANNER_BALANCE.targetSecurity.baseMin
    + rng.int(0, SCANNER_BALANCE.targetSecurity.randomRange)
    + (state.level - 1) * SCANNER_BALANCE.targetSecurity.levelStep
  );

  state.energy -= SCAN_ENERGY_COST;

  const effectiveHackPower = 6 + state.level * 2;
  const baseChance = SCANNER_BALANCE.hackSuccess.baseChance + (effectiveHackPower - security);
  const chance = Math.max(
    getEarlyHackSuccessFloor(state.level),
    Math.min(SCANNER_BALANCE.hackSuccess.maxChance, baseChance)
  );
  const success = rng.int(1, 100) <= chance;

  if (success) {
    const reward = getBaseReward(security);
    const hackMult = modifiers.hackRewardMultiplier ?? 1;
    const xpMult = modifiers.xpGainMultiplier ?? 1;
    const c = Math.floor(reward.credits * hackMult);
    const d = Math.floor(reward.data * hackMult);
    const x = Math.floor(reward.xp * xpMult);
    state.credits += c;
    state.data += d;
    state.xp += x;
    state.reputation += reward.reputation;
    state.applyLeveling();
    return { success: true, credits: c, data: d, xp: x };
  }
  return { success: false, credits: 0, data: 0, xp: 0 };
}

/** Repair one system. Returns credit cost, or -1 if not repairable. */
export function simulateRepair(
  state: PlayerState,
  systemIndex: number,
  repairCostMultiplier = 1
): number {
  const hp = state.systems[systemIndex];
  if (hp >= 100) return -1;

  const creditCost = Math.round(getRepairCreditCostForHealth(hp, state.level) * repairCostMultiplier);
  const energyCost = ENERGY_COSTS.repair;

  if (state.credits < creditCost || state.energy < energyCost) return -1;

  state.credits -= creditCost;
  state.energy -= energyCost;
  state.systems[systemIndex] = Math.min(100, hp + REPAIR_HEALTH_AMOUNT);
  return creditCost;
}

/** Simulate PvP attack. Returns { won, creditsGained, xpGained, damageDealt }. */
export function simulatePvPAttack(
  state: PlayerState,
  defenderLevel: number,
  defenderDefense: number,
  rng: Rng
): { won: boolean; creditsGained: number; xpGained: number; damageTaken: number } {
  const healthMult = Math.max(0.1, state.avgHealth() / 100);
  const attackPower = Math.round((8 + state.level * 2 + rng.int(-2, 3)) * healthMult);
  const rawWin = 50 + (attackPower - defenderDefense) / PVP_WIN_CHANCE_SCALE * 100;
  const winChance = Math.max(PVP_WIN_CHANCE_MIN, Math.min(PVP_WIN_CHANCE_MAX, rawWin));

  state.energy -= PVP_ENERGY_COST;

  if (rng.next() <= winChance / 100) {
    const c = rng.int(PVP_REWARD_CREDITS_MIN, PVP_REWARD_CREDITS_MAX)
      + defenderLevel * PVP_REWARD_CREDITS_LEVEL_BONUS;
    const d = rng.int(PVP_REWARD_DATA_MIN, PVP_REWARD_DATA_MAX) + defenderLevel * PVP_REWARD_DATA_LEVEL_BONUS;
    state.credits += c;
    state.data += d;
    state.xp += PVP_REWARD_XP;
    state.applyLeveling();
    return { won: true, creditsGained: c, xpGained: PVP_REWARD_XP, damageTaken: 0 };
  }

  // Loss: take damage
  let totalDmg = 0;
  const systemsHit = rng.int(PVP_LOSER_SYSTEMS_MIN, PVP_LOSER_SYSTEMS_MAX);
  for (let s = 0; s < systemsHit; s++) {
    const idx = rng.int(0, 5);
    const dmg = rng.int(PVP_LOSER_DAMAGE_MIN_PCT, PVP_LOSER_DAMAGE_MAX_PCT);
    state.systems[idx] = Math.max(0, state.systems[idx] - dmg);
    totalDmg += dmg;
  }
  return { won: false, creditsGained: 0, xpGained: 0, damageTaken: totalDmg };
}

/** Returns true if 3+ systems at 0 HP (death condition). */
export function checkDeath(state: PlayerState): boolean {
  return state.corruptedCount() >= DEATH_CORRUPTED_COUNT;
}

/** Apply passive income for `hours`, capped at PASSIVE_MAX_HOURS. */
export function applyPassiveIncome(
  state: PlayerState,
  hours: number,
  passiveIncomeMultiplier = 1
): void {
  const h = Math.min(hours, PASSIVE_MAX_HOURS);
  state.credits += Math.floor(PASSIVE_CREDITS_PER_HOUR * h * passiveIncomeMultiplier);
  state.data += Math.floor(PASSIVE_DATA_PER_HOUR * h * passiveIncomeMultiplier);
}

/** Print guardrail results. Returns true if all passed. */
export function printGuardrails(
  label: string,
  checks: Array<{ name: string; pass: boolean; detail: string }>
): boolean {
  let allPass = true;
  for (const check of checks) {
    const status = check.pass ? "PASS" : "FAIL";
    if (!check.pass) allPass = false;
    console.log(`[${label}] ${status}: ${check.name} — ${check.detail}`);
  }
  return allPass;
}
