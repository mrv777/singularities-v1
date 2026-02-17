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
} from "@singularities/shared";
import { BOT_MAX_ATTACKS_PER_DAY, buildBotPool } from "../services/arenaBots.js";
import { Rng, parseCliOptions } from "./lib.js";

interface Summary {
  winRate: number;
  creditsPerAttack: number;
  xpPerAttack: number;
  processingPowerPerAttack: number;
  damagePerAttack: number;
  creditsVsHumanRatio: number;
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

const { runs, days, seed } = parseCliOptions(process.argv.slice(2));
const summary = runSimulation(runs, days, seed);

const lines = [
  `[sim:bots] runs=${runs} days=${days} seed=${seed}`,
  `[sim:bots] winRate=${(summary.winRate * 100).toFixed(1)}%`,
  `[sim:bots] avgCredits/attack=${summary.creditsPerAttack.toFixed(2)}`,
  `[sim:bots] avgXP/attack=${summary.xpPerAttack.toFixed(2)}`,
  `[sim:bots] avgPP/attack=${summary.processingPowerPerAttack.toFixed(3)}`,
  `[sim:bots] avgDamageTaken/attack=${summary.damagePerAttack.toFixed(2)} HP`,
  `[sim:bots] botCreditsVsHumanExpected=${(summary.creditsVsHumanRatio * 100).toFixed(1)}%`,
];
console.log(lines.join("\n"));

const guardrailPass =
  summary.creditsVsHumanRatio <= 0.4
  && summary.winRate >= 0.35
  && summary.winRate <= 0.75;

if (!guardrailPass) {
  console.error("[sim:bots] guardrail failed (credits ratio or win-rate out of range)");
  process.exit(1);
}

console.log("[sim:bots] guardrail passed");
