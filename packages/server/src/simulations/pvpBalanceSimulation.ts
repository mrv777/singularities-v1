/**
 * PvP Combat Balance Simulation
 *
 * Tests mirror matches, level advantage sweep, loadout matchups,
 * stat compression, and risk/reward analysis.
 */
import {
  PVP_WIN_CHANCE_MIN,
  PVP_WIN_CHANCE_MAX,
  PVP_WIN_CHANCE_SCALE,
  PVP_REWARD_CREDITS_MIN,
  PVP_REWARD_CREDITS_MAX,
  PVP_REWARD_CREDITS_LEVEL_BONUS,
  PVP_REWARD_XP,
  PVP_LOSER_DAMAGE_MIN_PCT,
  PVP_LOSER_DAMAGE_MAX_PCT,
  PVP_LOSER_SYSTEMS_MIN,
  PVP_LOSER_SYSTEMS_MAX,
  PVP_ENERGY_COST,
  getRepairCreditCostForHealth,
} from "@singularities/shared";
import { Rng, parseCliOptions, average, printGuardrails } from "./lib.js";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function getWinChance(attack: number, defense: number): number {
  const raw = 50 + (attack - defense) / PVP_WIN_CHANCE_SCALE * 100;
  return clamp(raw, PVP_WIN_CHANCE_MIN, PVP_WIN_CHANCE_MAX);
}

function baseAttackPower(level: number): number {
  return 8 + level * 2;
}

function baseDefensePower(level: number): number {
  return 5 + level * 2;
}

interface MatchResult {
  attackerWon: boolean;
  creditsGained: number;
  repairCost: number;
}

function simulateMatch(
  attackLevel: number,
  defendLevel: number,
  attackBonus: number,
  defenseBonus: number,
  rng: Rng
): MatchResult {
  const atk = baseAttackPower(attackLevel) + attackBonus + rng.int(-2, 3);
  const def = baseDefensePower(defendLevel) + defenseBonus + rng.int(-2, 3);
  const winChance = getWinChance(atk, def);
  const won = rng.next() <= winChance / 100;

  if (won) {
    const c = rng.int(PVP_REWARD_CREDITS_MIN, PVP_REWARD_CREDITS_MAX)
      + defendLevel * PVP_REWARD_CREDITS_LEVEL_BONUS;
    return { attackerWon: true, creditsGained: c, repairCost: 0 };
  }

  // Calculate expected repair cost from damage taken using real formula
  let repairCost = 0;
  const systemsHit = rng.int(PVP_LOSER_SYSTEMS_MIN, PVP_LOSER_SYSTEMS_MAX);
  for (let s = 0; s < systemsHit; s++) {
    const dmg = rng.int(PVP_LOSER_DAMAGE_MIN_PCT, PVP_LOSER_DAMAGE_MAX_PCT);
    const approxHealth = Math.max(0, 85 - dmg);
    repairCost += getRepairCreditCostForHealth(approxHealth, attackLevel);
  }
  return { attackerWon: false, creditsGained: 0, repairCost };
}

function main() {
  const opts = parseCliOptions(process.argv.slice(2));
  console.log("=== PvP Combat Balance Simulation ===");
  console.log(`runs=${opts.runs} seed=${opts.seed}`);

  const guardrails: Array<{ name: string; pass: boolean; detail: string }> = [];

  // -- Scenario 1: Mirror match --
  console.log("\n[Mirror Match - Same Level, Same Loadout]");
  for (const level of [9, 15, 20, 25]) {
    const results: MatchResult[] = [];
    for (let i = 0; i < opts.runs; i++) {
      const rng = new Rng(opts.seed + i + level * 1000);
      results.push(simulateMatch(level, level, 0, 0, rng));
    }
    const winRate = results.filter((r) => r.attackerWon).length / opts.runs;
    console.log(`Level ${level}: ${(winRate * 100).toFixed(1)}% win rate`);

    guardrails.push({
      name: `Mirror match L${level} win rate`,
      pass: winRate >= 0.45 && winRate <= 0.55,
      detail: `${(winRate * 100).toFixed(1)}% (need 45-55%)`,
    });
  }

  // -- Scenario 2: Level advantage sweep --
  console.log("\n[Level Advantage Sweep]");
  const levelPairs = [
    [9, 10], [9, 11], [9, 12], [9, 14],
    [15, 16], [15, 17], [15, 18], [15, 20],
    [20, 21], [20, 22], [20, 23], [20, 25],
  ];
  for (const [atkLvl, defLvl] of levelPairs) {
    const results: MatchResult[] = [];
    for (let i = 0; i < opts.runs; i++) {
      const rng = new Rng(opts.seed + i + atkLvl * 100 + defLvl);
      results.push(simulateMatch(atkLvl, defLvl, 0, 0, rng));
    }
    const winRate = results.filter((r) => r.attackerWon).length / opts.runs;
    const diff = defLvl - atkLvl;
    console.log(`L${atkLvl} vs L${defLvl} (${diff > 0 ? "+" : ""}${diff}): ${(winRate * 100).toFixed(1)}%`);

    // Check per-level advantage isn't too steep
    const advantagePerLevel = Math.abs(winRate - 0.5) / diff;
    if (diff <= 5) {
      guardrails.push({
        name: `Level advantage L${atkLvl} vs L${defLvl}`,
        pass: advantagePerLevel <= 0.05,
        detail: `${(advantagePerLevel * 100).toFixed(1)}% per level (need ≤5%)`,
      });
    }
  }

  // -- Scenario 3: Loadout category matchups --
  console.log("\n[Loadout Matchups at Level 15]");
  const loadouts = [
    { name: "offense", atkBonus: 20, defBonus: 0 },
    { name: "defense", atkBonus: 0, defBonus: 20 },
    { name: "stealth", atkBonus: 10, defBonus: 5 },
    { name: "balanced", atkBonus: 10, defBonus: 10 },
  ];

  const matchupWinRates: Record<string, Record<string, number>> = {};
  for (const attacker of loadouts) {
    matchupWinRates[attacker.name] = {};
    for (const defender of loadouts) {
      const results: MatchResult[] = [];
      for (let i = 0; i < opts.runs; i++) {
        const rng = new Rng(opts.seed + i + loadouts.indexOf(attacker) * 1000 + loadouts.indexOf(defender));
        results.push(simulateMatch(15, 15, attacker.atkBonus, defender.defBonus, rng));
      }
      const wr = results.filter((r) => r.attackerWon).length / opts.runs;
      matchupWinRates[attacker.name][defender.name] = wr;
    }
  }

  for (const attacker of loadouts) {
    const rates = loadouts.map(
      (d) => `vs ${d.name}: ${(matchupWinRates[attacker.name][d.name] * 100).toFixed(0)}%`
    );
    console.log(`${attacker.name}: ${rates.join(", ")}`);

    // Check no loadout dominates
    const avgWinRate = average(loadouts.map((d) => matchupWinRates[attacker.name][d.name]));
    guardrails.push({
      name: `${attacker.name} avg win rate vs all`,
      pass: avgWinRate <= 0.65,
      detail: `${(avgWinRate * 100).toFixed(1)}% (need ≤65%)`,
    });
  }

  // -- Scenario 4: Risk/reward at 50% win rate --
  console.log("\n[Risk/Reward Analysis]");
  for (const level of [9, 15, 20, 25]) {
    const results: MatchResult[] = [];
    for (let i = 0; i < opts.runs; i++) {
      const rng = new Rng(opts.seed + i + level * 2000);
      results.push(simulateMatch(level, level, 0, 0, rng));
    }
    const avgGain = average(results.filter((r) => r.attackerWon).map((r) => r.creditsGained));
    const avgRepairCost = average(results.filter((r) => !r.attackerWon).map((r) => r.repairCost));
    const winRate = results.filter((r) => r.attackerWon).length / opts.runs;
    const ev = avgGain * winRate - avgRepairCost * (1 - winRate);
    console.log(`Level ${level}: EV=${ev.toFixed(1)} (gain=${avgGain.toFixed(0)}, repair=${avgRepairCost.toFixed(0)})`);

    guardrails.push({
      name: `PvP EV at Level ${level}`,
      pass: ev >= 5,
      detail: `EV=${ev.toFixed(1)} (need ≥5)`,
    });
  }

  const allPass = printGuardrails("sim:pvp", guardrails);
  if (!allPass) process.exit(1);
}

main();
