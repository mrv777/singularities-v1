/**
 * Endgame Content Analysis
 *
 * Examines level 25 daily loop, resource sink adequacy,
 * full module completion timeline, and post-max XP waste.
 */
import {
  ALL_MODULES,
  XP_THRESHOLDS,
  MAX_LEVEL,
  SCANNER_BALANCE,
  PASSIVE_CREDITS_PER_HOUR,
  PASSIVE_DATA_PER_HOUR,
  PVP_REWARD_CREDITS_MIN,
  PVP_REWARD_CREDITS_MAX,
  PVP_REWARD_CREDITS_LEVEL_BONUS,
  PVP_REWARD_XP,
  MUTATION_COST,
  MUTATION_SUCCESS_RATE,
  DATA_VAULT_PROTOCOLS,
  getBaseReward,
  getEarlyHackSuccessFloor,
} from "@singularities/shared";
import { Rng, parseCliOptions, average, printGuardrails } from "./lib.js";

function computeModuleCostToMax(mod: typeof ALL_MODULES[number]): { credits: number; data: number } {
  let credits = 0;
  let data = 0;
  for (let lvl = 0; lvl < mod.maxLevel; lvl++) {
    if (lvl === 0) {
      credits += mod.baseCost.credits;
      data += mod.baseCost.data;
    } else {
      credits += mod.baseCost.credits + mod.costPerLevel.credits * lvl;
      data += mod.baseCost.data + mod.costPerLevel.data * lvl;
    }
  }
  return { credits, data };
}

interface EndgameDayResult {
  creditsEarned: number;
  creditsSpent: number;
  netCredits: number;
  dataEarned: number;
  xpWasted: number; // XP earned at max level (no use)
  activities: string[];
}

function simulateEndgameDay(seed: number): EndgameDayResult {
  const rng = new Rng(seed);
  const level = MAX_LEVEL;
  let creditsEarned = 0;
  let creditsSpent = 0;
  let dataEarned = 0;
  let xpWasted = 0;
  const activities = new Set<string>();

  // Active play: 2 hours
  // Hacking (6/hr × 2h = 12 hacks)
  activities.add("hacking");
  for (let h = 0; h < 12; h++) {
    const security = Math.min(
      SCANNER_BALANCE.targetSecurity.max,
      SCANNER_BALANCE.targetSecurity.baseMin
      + rng.int(0, SCANNER_BALANCE.targetSecurity.randomRange)
      + (level - 1) * SCANNER_BALANCE.targetSecurity.levelStep
    );
    const hackPower = 6 + level * 2;
    const chance = Math.max(
      getEarlyHackSuccessFloor(level),
      Math.min(SCANNER_BALANCE.hackSuccess.maxChance, SCANNER_BALANCE.hackSuccess.baseChance + (hackPower - security))
    );
    if (rng.int(1, 100) <= chance) {
      const reward = getBaseReward(security);
      creditsEarned += reward.credits;
      dataEarned += reward.data;
      xpWasted += reward.xp;
    }
  }

  // PvP (3 matches)
  activities.add("pvp");
  for (let p = 0; p < 3; p++) {
    if (rng.chance(0.5)) {
      creditsEarned += rng.int(PVP_REWARD_CREDITS_MIN, PVP_REWARD_CREDITS_MAX)
        + level * PVP_REWARD_CREDITS_LEVEL_BONUS;
      xpWasted += PVP_REWARD_XP;
    }
  }

  // Bot arena (5 attacks)
  activities.add("bot_arena");
  for (let b = 0; b < 5; b++) {
    if (rng.chance(0.5)) {
      creditsEarned += rng.int(10, 30); // Reduced bot rewards
    }
  }

  // System maintenance
  activities.add("maintenance");
  creditsSpent += 6 * 35;

  // Module upgrades (if affordable)
  activities.add("module_upgrade");
  creditsSpent += rng.chance(0.5) ? 300 : 0;

  // Mutation attempt
  if (rng.chance(0.2)) {
    activities.add("mutation");
    creditsSpent += MUTATION_COST.credits;
  }

  // Passive income
  creditsEarned += PASSIVE_CREDITS_PER_HOUR * 24;
  dataEarned += PASSIVE_DATA_PER_HOUR * 24;

  return {
    creditsEarned,
    creditsSpent,
    netCredits: creditsEarned - creditsSpent,
    dataEarned,
    xpWasted,
    activities: [...activities],
  };
}

function main() {
  const opts = parseCliOptions(process.argv.slice(2));
  console.log("=== Endgame Content Analysis ===");
  console.log(`runs=${opts.runs} seed=${opts.seed}`);

  const guardrails: Array<{ name: string; pass: boolean; detail: string }> = [];

  // -- Module completion timeline --
  let totalAllCredits = 0;
  let totalAllData = 0;
  for (const mod of ALL_MODULES) {
    const cost = computeModuleCostToMax(mod);
    totalAllCredits += cost.credits;
    totalAllData += cost.data;
  }

  // Conservative baseline used across balance sims.
  const activeCreditsPerHourAssumption = 60;
  const creditsPerDay = activeCreditsPerHourAssumption * 2 + PASSIVE_CREDITS_PER_HOUR * 24;
  const daysToCompleteAllModules = totalAllCredits / creditsPerDay;

  console.log(`\n[Module Completion Timeline]`);
  console.log(`All ${ALL_MODULES.length} modules to max: ${totalAllCredits}c + ${totalAllData}d`);
  console.log(`At ~${creditsPerDay}c/day (2h active): ${daysToCompleteAllModules.toFixed(0)} days`);

  guardrails.push({
    name: "Module completion >60 days at 2h/day",
    pass: daysToCompleteAllModules > 60,
    detail: `${daysToCompleteAllModules.toFixed(0)} days (need >60)`,
  });

  // -- Endgame daily loop --
  console.log("\n[Endgame Daily Loop at Level 25]");
  const results: EndgameDayResult[] = [];
  for (let i = 0; i < opts.runs; i++) {
    results.push(simulateEndgameDay(opts.seed + i));
  }

  const avgEarned = average(results.map((r) => r.creditsEarned));
  const avgSpent = average(results.map((r) => r.creditsSpent));
  const avgNet = average(results.map((r) => r.netCredits));
  const avgXpWasted = average(results.map((r) => r.xpWasted));

  console.log(`Credits earned/day: ${avgEarned.toFixed(0)}`);
  console.log(`Credits spent/day: ${avgSpent.toFixed(0)}`);
  console.log(`Net credits/day: ${avgNet.toFixed(0)}`);
  console.log(`XP wasted/day (post-max): ${avgXpWasted.toFixed(0)}`);

  // Check credit accumulation over 30 days
  const creditAccumulation30Days = avgNet * 30;
  console.log(`Credit accumulation over 30 days: ${creditAccumulation30Days.toFixed(0)}`);

  guardrails.push({
    name: "Credit accumulation at max level (30 days)",
    pass: creditAccumulation30Days <= 7000,
    detail: `${creditAccumulation30Days.toFixed(0)}c (need ≤7,000)`,
  });

  // -- Distinct daily activities --
  const allActivities = new Set<string>();
  for (const r of results) {
    for (const a of r.activities) allActivities.add(a);
  }
  const avgActivities = average(results.map((r) => r.activities.length));
  console.log(`\nDistinct daily activities: ${allActivities.size}`);
  console.log(`Avg activities per day: ${avgActivities.toFixed(1)}`);

  if (allActivities.size < 3) {
    console.log("[sim:endgame] WARN: <3 distinct daily activities at max level");
  }

  // -- Resource sinks at max level --
  console.log("\n[Resource Sinks Available at Level 25]");
  const recommendedVaultProtocol =
    DATA_VAULT_PROTOCOLS.find((p) => p.recommended) ?? DATA_VAULT_PROTOCOLS[0];
  const mutationSuccessPct = Math.round(MUTATION_SUCCESS_RATE * 100);
  console.log("  - Module upgrades (36 modules, 5 levels each)");
  console.log(
    `  - Mutations (${MUTATION_COST.credits}c + ${MUTATION_COST.data}d + ${MUTATION_COST.processingPower}pp per attempt, ${mutationSuccessPct}% success)`
  );
  console.log("  - System repairs (ongoing)");
  console.log("  - PvP (energy cost)");
  console.log(
    `  - Data Vault (${recommendedVaultProtocol.costs.credits}c + ${recommendedVaultProtocol.costs.data}d per activation)`
  );

  const allPass = printGuardrails("sim:endgame", guardrails);
  if (!allPass) process.exit(1);
}

main();
