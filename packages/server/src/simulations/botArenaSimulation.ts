import {
  PVP_LOSER_DAMAGE_MAX_PCT,
  PVP_LOSER_DAMAGE_MIN_PCT,
  PVP_LOSER_SYSTEMS_MAX,
  PVP_LOSER_SYSTEMS_MIN,
  PVP_REWARD_CREDITS_LEVEL_BONUS,
  PVP_REWARD_CREDITS_MAX,
  PVP_REWARD_CREDITS_MIN,
  PVP_REWARD_CREDITS_STEAL_PCT_MAX,
  PVP_REWARD_CREDITS_STEAL_PCT_MIN,
  PVP_REWARD_PROCESSING_POWER_MAX,
  PVP_REWARD_PROCESSING_POWER_MIN,
  PVP_REWARD_XP,
  PVP_WIN_CHANCE_MAX,
  PVP_WIN_CHANCE_MIN,
  PVP_WIN_CHANCE_SCALE,
  PVP_ENERGY_COST,
  SCAN_ENERGY_COST,
  getBaseReward,
} from "@singularities/shared";
import { BOT_MAX_ATTACKS_PER_DAY, buildBotPool } from "../services/arenaBots.js";
import { Rng, parseCliOptions, average, printGuardrails } from "./lib.js";

interface Summary {
  winRate: number;
  creditsPerAttack: number;
  xpPerAttack: number;
  processingPowerPerAttack: number;
  damagePerAttack: number;
  creditsVsHumanRatio: number;
}

interface TierSummary {
  tier: string;
  winRate: number;
  creditsPerAttack: number;
  repairCostPerAttack: number;
  evPerAttack: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function simulatedFinalAttack(level: number, rng: Rng): number {
  return Math.max(8, 8 + level * 2 + rng.int(-2, 3));
}

function getWinChance(finalAttack: number, finalDefense: number): number {
  const raw = 50 + (finalAttack - finalDefense) / PVP_WIN_CHANCE_SCALE * 100;
  return clamp(raw, PVP_WIN_CHANCE_MIN, PVP_WIN_CHANCE_MAX);
}

function runSimulation(runs: number, days: number, seed: number): Summary {
  const rng = new Rng(seed);
  const attacksPerRun = Math.max(1, days * BOT_MAX_ATTACKS_PER_DAY);
  const assumedHumanDefenderCredits = 900;
  let wins = 0;
  let credits = 0;
  let xp = 0;
  let processingPower = 0;
  let damage = 0;
  let humanCreditsPerAttackTotal = 0;

  for (let run = 0; run < runs; run++) {
    const level = rng.int(9, 30);
    const dateKey = "2026-02-17";
    const bots = buildBotPool(`sim-player-${run}`, level, dateKey);

    for (let i = 0; i < attacksPerRun; i++) {
      const bot = bots[i % bots.length];
      const finalAttack = simulatedFinalAttack(level, rng);
      const winChance = getWinChance(finalAttack, bot.defensePower);
      const attackerWon = rng.next() <= winChance / 100;
      const humanBaseMid = (PVP_REWARD_CREDITS_MIN + PVP_REWARD_CREDITS_MAX) / 2
        + level * PVP_REWARD_CREDITS_LEVEL_BONUS;
      const humanTransferMid = assumedHumanDefenderCredits
        * (PVP_REWARD_CREDITS_STEAL_PCT_MIN + PVP_REWARD_CREDITS_STEAL_PCT_MAX) / 2;
      humanCreditsPerAttackTotal += 0.5 * (humanBaseMid + humanTransferMid);

      if (attackerWon) {
        wins++;
        const baseCredits = rng.int(PVP_REWARD_CREDITS_MIN, PVP_REWARD_CREDITS_MAX)
          + bot.level * PVP_REWARD_CREDITS_LEVEL_BONUS;
        credits += Math.max(8, Math.floor(baseCredits * bot.rewardMultiplier));
        xp += Math.max(10, Math.floor(PVP_REWARD_XP * bot.rewardMultiplier));
        const ppChance = Math.min(0.85, 0.25 + bot.rewardMultiplier);
        if (rng.next() < ppChance) {
          processingPower += rng.int(PVP_REWARD_PROCESSING_POWER_MIN, PVP_REWARD_PROCESSING_POWER_MAX);
        }
      } else {
        const systemsHit = rng.int(PVP_LOSER_SYSTEMS_MIN, PVP_LOSER_SYSTEMS_MAX);
        for (let s = 0; s < systemsHit; s++) {
          damage += rng.int(PVP_LOSER_DAMAGE_MIN_PCT, PVP_LOSER_DAMAGE_MAX_PCT);
        }
      }
    }
  }

  const totalAttacks = runs * attacksPerRun;
  return {
    winRate: wins / totalAttacks,
    creditsPerAttack: credits / totalAttacks,
    xpPerAttack: xp / totalAttacks,
    processingPowerPerAttack: processingPower / totalAttacks,
    damagePerAttack: damage / totalAttacks,
    creditsVsHumanRatio: (credits / totalAttacks) / (humanCreditsPerAttackTotal / totalAttacks),
  };
}

function runPerTierAnalysis(runs: number, seed: number): TierSummary[] {
  const tiers = ["novice", "adaptive", "elite"];
  const results: TierSummary[] = [];

  for (const tier of tiers) {
    const rng = new Rng(seed + tiers.indexOf(tier) * 10000);
    let wins = 0;
    let totalCredits = 0;
    let totalRepairCost = 0;
    let total = 0;

    for (let run = 0; run < runs; run++) {
      const level = rng.int(9, 25);
      const dateKey = "2026-02-17";
      const bots = buildBotPool(`sim-tier-${run}`, level, dateKey);

      // Filter bots by tier
      const tierBots = bots.filter((b) => b.tier === tier);
      if (tierBots.length === 0) continue;

      for (const bot of tierBots) {
        total++;
        const finalAttack = simulatedFinalAttack(level, rng);
        const winChance = getWinChance(finalAttack, bot.defensePower);
        const won = rng.next() <= winChance / 100;

        if (won) {
          wins++;
          const baseCredits = rng.int(PVP_REWARD_CREDITS_MIN, PVP_REWARD_CREDITS_MAX)
            + bot.level * PVP_REWARD_CREDITS_LEVEL_BONUS;
          totalCredits += Math.max(8, Math.floor(baseCredits * bot.rewardMultiplier));
        } else {
          // Repair cost estimate
          const systemsHit = rng.int(PVP_LOSER_SYSTEMS_MIN, PVP_LOSER_SYSTEMS_MAX);
          for (let s = 0; s < systemsHit; s++) {
            const dmg = rng.int(PVP_LOSER_DAMAGE_MIN_PCT, PVP_LOSER_DAMAGE_MAX_PCT);
            totalRepairCost += Math.round(dmg * 0.7 + 8);
          }
        }
      }
    }

    if (total === 0) {
      results.push({ tier, winRate: 0, creditsPerAttack: 0, repairCostPerAttack: 0, evPerAttack: 0 });
      continue;
    }

    const wr = wins / total;
    const cpa = totalCredits / total;
    const rpa = totalRepairCost / total;
    const ev = cpa - rpa;
    results.push({ tier, winRate: wr, creditsPerAttack: cpa, repairCostPerAttack: rpa, evPerAttack: ev });
  }

  return results;
}

function main() {
  const { runs, days, seed } = parseCliOptions(process.argv.slice(2));
  const summary = runSimulation(runs, days, seed);

  console.log("=== Bot Arena Simulation ===");
  const lines = [
    `runs=${runs} days=${days} seed=${seed}`,
    `winRate=${(summary.winRate * 100).toFixed(1)}%`,
    `avgCredits/attack=${summary.creditsPerAttack.toFixed(2)}`,
    `avgXP/attack=${summary.xpPerAttack.toFixed(2)}`,
    `avgPP/attack=${summary.processingPowerPerAttack.toFixed(3)}`,
    `avgDamageTaken/attack=${summary.damagePerAttack.toFixed(2)} HP`,
    `botCreditsVsHumanExpected=${(summary.creditsVsHumanRatio * 100).toFixed(1)}%`,
  ];
  console.log(lines.join("\n"));

  // Per-tier analysis
  console.log("\n--- Per-Tier Breakdown ---");
  const tierResults = runPerTierAnalysis(runs, seed);
  for (const t of tierResults) {
    console.log(`[${t.tier}] winRate=${(t.winRate * 100).toFixed(1)}%, credits/atk=${t.creditsPerAttack.toFixed(1)}, repairCost/atk=${t.repairCostPerAttack.toFixed(1)}, EV=${t.evPerAttack.toFixed(1)}`);
  }

  // Hacking efficiency comparison using a representative mid-risk target.
  // Bots: credits/energy = creditsPerAttack / PVP_ENERGY_COST
  const referenceSecurity = 30;
  const hackRewardCredits = getBaseReward(referenceSecurity).credits;
  const hackEnergyCost = SCAN_ENERGY_COST;
  const botCredPerEnergy = summary.creditsPerAttack / PVP_ENERGY_COST;
  const hackCredPerEnergy = hackRewardCredits / hackEnergyCost;
  const botVsHackRatio = botCredPerEnergy / hackCredPerEnergy;
  console.log(`\nBot credits/energy: ${botCredPerEnergy.toFixed(2)} vs Hacking: ${hackCredPerEnergy.toFixed(2)}`);
  console.log(`Bot/hacking efficiency: ${(botVsHackRatio * 100).toFixed(0)}%`);

  // Guardrails
  const novice = tierResults.find((t) => t.tier === "novice");
  const elite = tierResults.find((t) => t.tier === "elite");

  const guardrails = [
    {
      name: "Overall win rate in range",
      pass: summary.winRate >= 0.35 && summary.winRate <= 0.75,
      detail: `${(summary.winRate * 100).toFixed(1)}% (need 35-75%)`,
    },
    {
      name: "Bot credits vs human ratio",
      pass: summary.creditsVsHumanRatio <= 0.4,
      detail: `${(summary.creditsVsHumanRatio * 100).toFixed(1)}% (need ≤40%)`,
    },
    {
      name: "Novice bots win rate >65%",
      pass: (novice?.winRate ?? 0) > 0.65,
      detail: `${((novice?.winRate ?? 0) * 100).toFixed(1)}%`,
    },
    {
      name: "Elite bots win rate 40-60%",
      pass: (elite?.winRate ?? 0) >= 0.40 && (elite?.winRate ?? 0) <= 0.60,
      detail: `${((elite?.winRate ?? 0) * 100).toFixed(1)}%`,
    },
    {
      name: "Elite bot EV (incl repair) not negative",
      pass: (elite?.evPerAttack ?? 0) >= 0,
      detail: `EV=${(elite?.evPerAttack ?? 0).toFixed(1)}`,
    },
    {
      name: "Bot credits-per-energy 18-65% of hacking",
      pass: botVsHackRatio >= 0.18 && botVsHackRatio <= 0.65,
      detail: `${(botVsHackRatio * 100).toFixed(0)}%`,
    },
  ];

  const allPass = printGuardrails("sim:bots", guardrails);
  if (!allPass) process.exit(1);
}

main();
