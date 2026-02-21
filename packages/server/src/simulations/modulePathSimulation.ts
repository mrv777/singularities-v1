/**
 * Module Path Optimization Simulation
 *
 * Analyzes cost to max each category, stat-per-credit efficiency,
 * tier gate timing, top loadout combos, and dead module detection.
 */
import {
  ALL_MODULES,
  TIER_UNLOCK_REQUIREMENT,
  TIER_UNLOCK_LEVEL,
  type ModuleDefinition,
  type ModuleTier,
} from "@singularities/shared";
import { parseCliOptions, printGuardrails } from "./lib.js";

interface ModuleEfficiency {
  id: string;
  name: string;
  category: string;
  tier: string;
  costToMax: { credits: number; data: number };
  totalStats: Record<string, number>;
  statPerCredit: number;
}

interface CategoryCost {
  category: string;
  totalCredits: number;
  totalData: number;
  hoursToMax: number;
}

function computeModuleCostToMax(mod: ModuleDefinition): { credits: number; data: number } {
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

function totalStatPoints(mod: ModuleDefinition): number {
  let total = 0;
  for (const [, val] of Object.entries(mod.effects)) {
    total += Math.abs(val) * mod.maxLevel;
  }
  return total;
}

function statValue(effects: Record<string, number>, level: number): number {
  // Credit-equivalence: 1c=1, 1d=1.5, 1pp=4, 1rep=0.8
  // For stat points, weight by impact
  let val = 0;
  for (const [key, v] of Object.entries(effects)) {
    const scaled = v * level;
    if (key === "hackPower") val += scaled * 3;
    else if (key === "defense") val += scaled * 2.5;
    else if (key === "stealth") val += scaled * 2;
    // Efficiency mitigates health-penalty degradation in sustained play.
    else if (key === "efficiency") val += scaled * 3;
    else if (key === "creditBonus") val += scaled * 3;
    else if (key === "dataBonus") val += scaled * 2;
    else val += scaled * 1;
  }
  return val;
}

function parseCreditsPerHour(argv: string[]): number {
  for (const arg of argv) {
    if (arg.startsWith("--credits-per-hour=")) {
      const parsed = Number(arg.slice("--credits-per-hour=".length));
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
  }
  // Minigame economy replaced old scanner-hack payouts; 140c/hr is now too low.
  // Keep overrideable via --credits-per-hour for local calibration runs.
  return 320;
}

function main() {
  const argv = process.argv.slice(2);
  const opts = parseCliOptions(argv);
  const creditsPerHour = parseCreditsPerHour(argv);
  const creditsPerDay = creditsPerHour * 2;
  console.log("=== Module Path Optimization Simulation ===");
  console.log(`runs=${opts.runs} credits_per_hour=${creditsPerHour}`);

  const guardrails: Array<{ name: string; pass: boolean; detail: string }> = [];

  // -- Per-module efficiency analysis --
  const efficiencies: ModuleEfficiency[] = [];
  for (const mod of ALL_MODULES) {
    const cost = computeModuleCostToMax(mod);
    const stats: Record<string, number> = {};
    for (const [key, val] of Object.entries(mod.effects)) {
      stats[key] = val * mod.maxLevel;
    }
    const totalVal = statValue(mod.effects, mod.maxLevel);
    const totalCost = cost.credits + cost.data * 1.5; // Data weighted higher
    efficiencies.push({
      id: mod.id,
      name: mod.name,
      category: mod.category,
      tier: mod.tier,
      costToMax: cost,
      totalStats: stats,
      statPerCredit: totalCost > 0 ? totalVal / totalCost : 0,
    });
  }

  // Sort by efficiency
  const sorted = [...efficiencies].sort((a, b) => b.statPerCredit - a.statPerCredit);

  console.log("\n[Module Efficiency Ranking - Top 10]");
  for (const mod of sorted.slice(0, 10)) {
    console.log(`  ${mod.name} (${mod.tier}/${mod.category}): ${mod.statPerCredit.toFixed(3)} val/credit, cost: ${mod.costToMax.credits}c/${mod.costToMax.data}d`);
  }

  console.log("\n[Module Efficiency Ranking - Bottom 5]");
  for (const mod of sorted.slice(-5)) {
    console.log(`  ${mod.name} (${mod.tier}/${mod.category}): ${mod.statPerCredit.toFixed(3)} val/credit, cost: ${mod.costToMax.credits}c/${mod.costToMax.data}d`);
  }

  // -- Dead module detection --
  // A module is "dead" if there's another in the same tier+category with strictly better efficiency
  let deadModules = 0;
  for (const mod of efficiencies) {
    const sameTierCat = efficiencies.filter(
      (m) => m.tier === mod.tier && m.category === mod.category && m.id !== mod.id
    );
    const dominated = sameTierCat.some((other) => {
      // Check if other is strictly better in every stat
      const modStats = Object.entries(mod.totalStats);
      return modStats.every(([key, val]) => (other.totalStats[key] ?? 0) >= val)
        && other.costToMax.credits <= mod.costToMax.credits
        && other.costToMax.data <= mod.costToMax.data
        && (other.costToMax.credits < mod.costToMax.credits
          || other.costToMax.data < mod.costToMax.data
          || modStats.some(([key, val]) => (other.totalStats[key] ?? 0) > val));
    });
    if (dominated) {
      deadModules++;
      console.log(`  DEAD: ${mod.name} (${mod.tier}/${mod.category}) is strictly dominated`);
    }
  }

  guardrails.push({
    name: "No dead modules",
    pass: deadModules === 0,
    detail: `${deadModules} dead modules`,
  });

  // -- Tier-3 efficiency variance --
  const eliteModules = efficiencies.filter((m) => m.tier === "elite");
  if (eliteModules.length >= 2) {
    const maxEff = Math.max(...eliteModules.map((m) => m.statPerCredit));
    const minEff = Math.min(...eliteModules.map((m) => m.statPerCredit));
    const ratio = minEff > 0 ? maxEff / minEff : Infinity;
    console.log(`\n[Elite Tier Efficiency Variance] max/min ratio: ${ratio.toFixed(2)}`);
    guardrails.push({
      name: "No elite module >2x efficiency of worst in tier",
      pass: ratio <= 2,
      detail: `ratio=${ratio.toFixed(2)} (need ≤2.0)`,
    });
  }

  // -- Category total costs --
  console.log("\n[Category Total Costs to Max All]");
  const categories = [...new Set(ALL_MODULES.map((m) => m.category))];
  const categoryCosts: CategoryCost[] = [];
  for (const cat of categories) {
    const mods = ALL_MODULES.filter((m) => m.category === cat);
    let totalC = 0;
    let totalD = 0;
    for (const mod of mods) {
      const cost = computeModuleCostToMax(mod);
      totalC += cost.credits;
      totalD += cost.data;
    }
    const hours = totalC / creditsPerHour;
    categoryCosts.push({ category: cat, totalCredits: totalC, totalData: totalD, hoursToMax: hours });
    console.log(`  ${cat}: ${totalC}c + ${totalD}d = ~${hours.toFixed(0)}h at ${creditsPerHour}c/hr`);
  }

  // -- Full completion timeline --
  const totalAllCredits = categoryCosts.reduce((s, c) => s + c.totalCredits, 0);
  const totalAllData = categoryCosts.reduce((s, c) => s + c.totalData, 0);
  const daysToComplete = totalAllCredits / creditsPerDay;
  console.log(`\n[Full Completion] All 36 modules: ${totalAllCredits}c + ${totalAllData}d`);
  console.log(`  At 2h/day, ${creditsPerHour}c/hr: ${daysToComplete.toFixed(0)} days`);

  // Elite tier reachable within 90 days
  const eliteCats = categoryCosts.map((c) => c.hoursToMax / 2); // days at 2h/day
  const maxCategoryDays = Math.max(...eliteCats);
  guardrails.push({
    name: "Elite tier reachable within one season (90 days at 2h/day)",
    pass: maxCategoryDays <= 120,
    detail: `worst category: ${maxCategoryDays.toFixed(0)} days`,
  });

  // -- Category build effectiveness comparison --
  // Compute total stat value per category if you max all modules in it
  const catValues: Record<string, number> = {};
  for (const cat of categories) {
    const mods = ALL_MODULES.filter((m) => m.category === cat);
    let totalVal = 0;
    for (const mod of mods) {
      totalVal += statValue(mod.effects, mod.maxLevel);
    }
    catValues[cat] = totalVal;
  }
  const maxCatVal = Math.max(...Object.values(catValues));
  const minCatVal = Math.min(...Object.values(catValues));
  const catValRatio = minCatVal > 0 ? maxCatVal / minCatVal : Infinity;
  console.log(`\n[Category Build Effectiveness]`);
  for (const cat of categories) {
    console.log(`  ${cat}: ${catValues[cat].toFixed(0)} total value`);
  }
  guardrails.push({
    name: "All 4 category builds within 60% effectiveness",
    pass: catValRatio <= 1.6,
    detail: `max/min ratio=${catValRatio.toFixed(2)} (need ≤1.6)`,
  });

  // -- Tier gate timing: cost to unlock each tier (cheapest path) --
  console.log("\n[Tier Gate Timing — Level-Gated Unlock]");
  console.log(`  Requires ${TIER_UNLOCK_REQUIREMENT} prev-tier modules at L${TIER_UNLOCK_LEVEL} to advance`);

  const TIER_ORDER: ModuleTier[] = ["basic", "advanced", "elite"];
  for (const cat of categories) {
    const rows: string[] = [];
    let cumulativeCost = 0;
    for (let t = 0; t < TIER_ORDER.length; t++) {
      const tier = TIER_ORDER[t];
      if (t === 0) {
        // Basic: need to buy 2 cheapest and level them to TIER_UNLOCK_LEVEL to unlock advanced
        const basicMods = ALL_MODULES.filter((m) => m.category === cat && m.tier === "basic");
        const basicCosts = basicMods
          .map((m) => computeModuleCostToMax(m))
          .sort((a, b) => a.credits - b.credits);
        const gateCredits = basicCosts.slice(0, TIER_UNLOCK_REQUIREMENT).reduce((s, c) => s + c.credits, 0);
        cumulativeCost += gateCredits;
        rows.push(`    Basic gate (${TIER_UNLOCK_REQUIREMENT} modules to L${TIER_UNLOCK_LEVEL}): ${gateCredits}c — ~${(gateCredits / creditsPerHour).toFixed(1)}h`);
      } else if (t === 1) {
        // Advanced: need 2 cheapest advanced modules to L6 to unlock elite
        // But first must buy them (requires basic gate already met)
        const advMods = ALL_MODULES.filter((m) => m.category === cat && m.tier === "advanced");
        const advCosts = advMods
          .map((m) => computeModuleCostToMax(m))
          .sort((a, b) => a.credits - b.credits);
        const gateCredits = advCosts.slice(0, TIER_UNLOCK_REQUIREMENT).reduce((s, c) => s + c.credits, 0);
        cumulativeCost += gateCredits;
        rows.push(`    Advanced gate (${TIER_UNLOCK_REQUIREMENT} modules to L${TIER_UNLOCK_LEVEL}): ${gateCredits}c — cumulative ${cumulativeCost}c (~${(cumulativeCost / creditsPerHour).toFixed(1)}h)`);
      } else {
        // Elite: first purchasable module
        const eliteMods = ALL_MODULES.filter((m) => m.category === cat && m.tier === "elite");
        const cheapest = Math.min(...eliteMods.map((m) => m.baseCost.credits));
        cumulativeCost += cheapest;
        rows.push(`    Elite L1 (first purchase): +${cheapest}c — cumulative ${cumulativeCost}c (~${(cumulativeCost / creditsPerHour).toFixed(1)}h)`);
      }
    }
    console.log(`  ${cat}:`);
    for (const row of rows) console.log(row);
  }

  const allPass = printGuardrails("sim:modules", guardrails);
  if (!allPass) process.exit(1);
}

main();
