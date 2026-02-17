/**
 * Decision Balance Simulation
 *
 * Tests value parity of yes/no choices, alignment trajectory,
 * encounter rates, and content exhaustion.
 */
import {
  ALL_DECISIONS,
  DECISION_TRIGGER_CHANCES,
  DECISION_BALANCE,
  getDecisionResourceCap,
} from "@singularities/shared";
import { Rng, parseCliOptions, percentile, average, printGuardrails } from "./lib.js";

function normalizeGrant(
  target: string,
  value: number,
  rarity: "common" | "uncommon" | "rare",
  level: number
): number {
  if (value <= 0) return value;
  const rarityScale = DECISION_BALANCE.rarityResourceScale[rarity] ?? 1;
  const scaled = Math.round(value * rarityScale * (1 + level * DECISION_BALANCE.levelScalePerLevel));
  if (target === "credits") return Math.min(scaled, getDecisionResourceCap("credits", level));
  if (target === "data") return Math.min(scaled, getDecisionResourceCap("data", level));
  if (target === "processingPower") return Math.min(scaled, getDecisionResourceCap("processingPower", level));
  if (target === "reputation") return Math.min(scaled, getDecisionResourceCap("reputation", level));
  return scaled;
}

function scoreEffects(
  effects: Array<{ type: string; target: string; value: number }>,
  rarity: "common" | "uncommon" | "rare",
  level: number
): number {
  let score = 0;
  for (const e of effects) {
    if (e.type === "resource_grant") {
      const value = normalizeGrant(e.target, e.value, rarity, level);
      if (e.target === "credits") score += value;
      else if (e.target === "data") score += value * 1.5;
      else if (e.target === "processingPower") score += value * 4;
      else if (e.target === "reputation") score += value * 0.8;
    } else if (e.type === "stat_modifier") {
      // Temp buffs: value * duration weight
      score += Math.abs(e.value) * 2;
    } else if (e.type === "system_health") {
      score += e.value * 1.5; // Health value ~= repair credit cost
    }
  }
  return score;
}

interface DecisionValueResult {
  id: string;
  yesValue: number;
  noValue: number;
  ratio: number; // max/min
}

interface AlignmentResult {
  strategy: string;
  finalAlignment: number;
  daysToExtreme: number; // Days to reach |0.8|
}

interface EncounterResult {
  decisionsPerDay: number;
  daysToSeeAll: number;
  allSeen: boolean;
}

function main() {
  const opts = parseCliOptions(process.argv.slice(2));
  console.log("=== Decision Balance Simulation ===");
  console.log(`runs=${opts.runs} seed=${opts.seed}`);

  const guardrails: Array<{ name: string; pass: boolean; detail: string }> = [];

  // -- Value parity per decision --
  console.log("\n[Decision Value Parity at Level 10]");
  const valueResults: DecisionValueResult[] = [];
  for (const dec of ALL_DECISIONS) {
    if (dec.levelRequirement > 10) continue;
    const yesVal = scoreEffects(dec.yesEffects, dec.rarity, 10);
    const noVal = scoreEffects(dec.noEffects, dec.rarity, 10);
    const maxVal = Math.max(yesVal, noVal);
    const minVal = Math.min(yesVal, noVal);
    const ratio = minVal > 0 ? maxVal / minVal : maxVal > 0 ? 10 : 1;
    valueResults.push({ id: dec.id, yesValue: yesVal, noValue: noVal, ratio });
    console.log(`  ${dec.id}: yes=${yesVal.toFixed(0)}, no=${noVal.toFixed(0)}, ratio=${ratio.toFixed(1)}`);
  }

  const worstRatio = Math.max(...valueResults.map((r) => r.ratio));
  guardrails.push({
    name: "Yes/no value ratio per decision",
    pass: worstRatio <= 2.5,
    detail: `worst ratio=${worstRatio.toFixed(1)} (need ≤2.5)`,
  });

  // -- Alignment trajectory --
  console.log("\n[Alignment Trajectory]");
  const strategies = ["all_yes", "all_no", "random"];
  for (const strategy of strategies) {
    const alignResults: AlignmentResult[] = [];
    for (let i = 0; i < opts.runs; i++) {
      const rng = new Rng(opts.seed + i + strategies.indexOf(strategy) * 10000);
      let alignment = 0;
      let daysToExtreme = -1;
      const seen = new Set<string>();
      const maxDays = 90;

      for (let day = 0; day < maxDays; day++) {
        // ~3 hacks/day with 10% decision chance + ~1 combat with 15% chance + 5% login
        const hacksPerDay = 6;
        const combatsPerDay = 2;
        const loginDecisionChance = DECISION_TRIGGER_CHANCES.onLogin;

        // Login decision
        if (rng.chance(loginDecisionChance)) {
          const eligible = ALL_DECISIONS.filter(
            (d) => d.levelRequirement <= 10 && !seen.has(d.id)
          );
          if (eligible.length > 0) {
            const dec = rng.pick(eligible);
            const chooseYes =
              strategy === "all_yes" ? true :
              strategy === "all_no" ? false :
              rng.chance(0.5);
            alignment += chooseYes ? dec.alignmentShift.yes : dec.alignmentShift.no;
            alignment = Math.max(-1, Math.min(1, alignment));
            seen.add(dec.id);
          }
        }

        // Hack decisions
        for (let h = 0; h < hacksPerDay; h++) {
          if (rng.chance(DECISION_TRIGGER_CHANCES.afterHack)) {
            const eligible = ALL_DECISIONS.filter(
              (d) => d.levelRequirement <= 10 && !seen.has(d.id)
            );
            if (eligible.length > 0) {
              const dec = rng.pick(eligible);
              const chooseYes =
                strategy === "all_yes" ? true :
                strategy === "all_no" ? false :
                rng.chance(0.5);
              alignment += chooseYes ? dec.alignmentShift.yes : dec.alignmentShift.no;
              alignment = Math.max(-1, Math.min(1, alignment));
              seen.add(dec.id);
            }
          }
        }

        // Combat decisions
        for (let c = 0; c < combatsPerDay; c++) {
          if (rng.chance(DECISION_TRIGGER_CHANCES.afterCombat)) {
            const eligible = ALL_DECISIONS.filter(
              (d) => d.levelRequirement <= 10 && !seen.has(d.id)
            );
            if (eligible.length > 0) {
              const dec = rng.pick(eligible);
              const chooseYes =
                strategy === "all_yes" ? true :
                strategy === "all_no" ? false :
                rng.chance(0.5);
              alignment += chooseYes ? dec.alignmentShift.yes : dec.alignmentShift.no;
              alignment = Math.max(-1, Math.min(1, alignment));
              seen.add(dec.id);
            }
          }
        }

        if (daysToExtreme < 0 && Math.abs(alignment) >= 0.8) {
          daysToExtreme = day + 1;
        }
      }

      alignResults.push({
        strategy,
        finalAlignment: alignment,
        daysToExtreme: daysToExtreme < 0 ? maxDays : daysToExtreme,
      });
    }

    const alignments = alignResults.map((r) => r.finalAlignment);
    const extremeTimes = alignResults.filter((r) => r.daysToExtreme < 90).map((r) => r.daysToExtreme);
    console.log(`  ${strategy}: final alignment (p50): ${percentile(alignments, 50).toFixed(2)}, reached extreme: ${extremeTimes.length}/${opts.runs}`);
    if (extremeTimes.length > 0) {
      console.log(`    Days to extreme (p50): ${percentile(extremeTimes, 50)}`);
    }

    if (strategy === "all_yes" || strategy === "all_no") {
      const p50Extreme = extremeTimes.length > 0 ? percentile(extremeTimes, 50) : 90;
      guardrails.push({
        name: `Alignment to |0.8| (${strategy})`,
        pass: p50Extreme <= 42, // 6 weeks
        detail: `p50=${p50Extreme} days (need ≤42)`,
      });
    }
  }

  // -- Encounter rate & content exhaustion --
  console.log("\n[Encounter Rate & Content Exhaustion]");
  const encounterResults: EncounterResult[] = [];
  for (let i = 0; i < opts.runs; i++) {
    const rng = new Rng(opts.seed + i + 30000);
    const seen = new Set<string>();
    let decisionsTotal = 0;
    let allSeenDay = -1;
    const totalDecisions = ALL_DECISIONS.filter((d) => d.levelRequirement <= 10).length;

    for (let day = 0; day < 30; day++) {
      let decisionsToday = 0;
      // Login
      if (rng.chance(DECISION_TRIGGER_CHANCES.onLogin)) decisionsToday++;
      // 6 hacks
      for (let h = 0; h < 6; h++) {
        if (rng.chance(DECISION_TRIGGER_CHANCES.afterHack)) decisionsToday++;
      }
      // 2 combats
      for (let c = 0; c < 2; c++) {
        if (rng.chance(DECISION_TRIGGER_CHANCES.afterCombat)) decisionsToday++;
      }

      for (let d = 0; d < decisionsToday; d++) {
        const eligible = ALL_DECISIONS.filter(
          (dec) => dec.levelRequirement <= 10 && !seen.has(dec.id)
        );
        if (eligible.length > 0) {
          seen.add(rng.pick(eligible).id);
        }
      }
      decisionsTotal += decisionsToday;

      if (allSeenDay < 0 && seen.size >= totalDecisions) {
        allSeenDay = day + 1;
      }
    }

    encounterResults.push({
      decisionsPerDay: decisionsTotal / 30,
      daysToSeeAll: allSeenDay < 0 ? 30 : allSeenDay,
      allSeen: allSeenDay >= 0,
    });
  }

  const avgDecPerDay = average(encounterResults.map((r) => r.decisionsPerDay));
  const seeAllDays = encounterResults.filter((r) => r.allSeen).map((r) => r.daysToSeeAll);
  console.log(`Decisions/day avg: ${avgDecPerDay.toFixed(1)}`);
  if (seeAllDays.length > 0) {
    console.log(`Days to see all (p50): ${percentile(seeAllDays, 50)}`);
  }
  console.log(`Total unique decisions (level ≤10): ${ALL_DECISIONS.filter((d) => d.levelRequirement <= 10).length}`);

  guardrails.push({
    name: "Decisions/day for mixed player",
    pass: avgDecPerDay >= 1 && avgDecPerDay <= 8,
    detail: `${avgDecPerDay.toFixed(1)} (need 1-8)`,
  });

  if (seeAllDays.length > 0 && percentile(seeAllDays, 50) < 7) {
    console.log(`[sim:decisions] WARN: All decisions seen in <7 days (content exhaustion risk)`);
  }

  const allPass = printGuardrails("sim:decisions", guardrails);
  if (!allPass) process.exit(1);
}

main();
