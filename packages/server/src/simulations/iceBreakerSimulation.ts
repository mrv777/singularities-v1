/**
 * ICE Breaker Balance Simulation
 *
 * Tests the sigmoid probability curve for layer resolution across
 * representative loadouts at key progression points.
 * Uses computeLayerPassRate + layerThreshold directly (pure functions, no DB).
 */
import {
  ICE_BREAKER_BALANCE,
  ICE_LAYER_TYPES,
  computeLayerPassRate,
  type IceLayerType,
} from "@singularities/shared";
import { printGuardrails } from "./lib.js";

// ---------------------------------------------------------------------------
// Representative loadout profiles (stat, level)
// Stats assume 3 infiltration slots, healthMultiplier = 1.0
// ---------------------------------------------------------------------------

interface Loadout {
  name: string;
  level: number;
  hackPower: number;
  stealth: number;
  defense: number;
}

const LOADOUTS: Loadout[] = [
  // L4 basic tier — focused builds (3 basic modules, ~lvl 3)
  { name: "L4 basic hack-focused",     level: 4,  hackPower: 18, stealth: 6,   defense: 6 },
  { name: "L4 basic stealth-focused",  level: 4,  hackPower: 6,  stealth: 18,  defense: 6 },
  { name: "L4 basic defense-focused",  level: 4,  hackPower: 6,  stealth: 6,   defense: 18 },
  { name: "L4 basic balanced",         level: 4,  hackPower: 8,  stealth: 8,   defense: 8 },

  // L8 advanced tier — focused builds (3 advanced modules, ~lvl 5-6)
  { name: "L8 adv hack-focused",       level: 8,  hackPower: 60, stealth: 12,  defense: 12 },
  { name: "L8 adv stealth-focused",    level: 8,  hackPower: 12, stealth: 90,  defense: 12 },
  { name: "L8 adv defense-focused",    level: 8,  hackPower: 12, stealth: 12,  defense: 60 },
  { name: "L8 adv balanced",           level: 8,  hackPower: 25, stealth: 30,  defense: 25 },

  // L15 elite tier — focused builds (3 elite modules, lvl 6)
  { name: "L15 elite hack-focused",    level: 15, hackPower: 186, stealth: 30, defense: 30 },
  { name: "L15 elite stealth-focused", level: 15, hackPower: 30,  stealth: 250, defense: 30 },
  { name: "L15 elite defense-focused", level: 15, hackPower: 30,  stealth: 30, defense: 186 },
  { name: "L15 elite balanced",        level: 15, hackPower: 50,  stealth: 60, defense: 50 },

  // L25 max elite — best-in-slot builds
  { name: "L25 max hack-focused",      level: 25, hackPower: 186, stealth: 40,  defense: 40 },
  { name: "L25 max stealth-focused",   level: 25, hackPower: 40,  stealth: 186, defense: 40 },
  { name: "L25 max defense-focused",   level: 25, hackPower: 40,  stealth: 40,  defense: 186 },
  { name: "L25 max balanced",          level: 25, hackPower: 80,  stealth: 90,  defense: 80 },
];

const STAT_FOR_TYPE: Record<IceLayerType, keyof Pick<Loadout, "hackPower" | "stealth" | "defense">> = {
  FIREWALL: "hackPower",
  TRACER: "stealth",
  BLACK_ICE: "defense",
};

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

function runSimulation() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  ICE BREAKER BALANCE SIMULATION");
  console.log("═══════════════════════════════════════════════════════════\n");

  // --- Per-loadout pass rates across all layer types and depths ---
  for (const loadout of LOADOUTS) {
    const layerCount = ICE_BREAKER_BALANCE.layerCount(loadout.level);
    console.log(`\n── ${loadout.name} (level ${loadout.level}, ${layerCount} layers) ──`);
    console.log(`   Stats: hack=${loadout.hackPower} stealth=${loadout.stealth} def=${loadout.defense}`);

    for (const type of ICE_LAYER_TYPES) {
      const stat = loadout[STAT_FOR_TYPE[type]];
      const rates: number[] = [];
      for (let d = 0; d < layerCount; d++) {
        const threshold = ICE_BREAKER_BALANCE.layerThreshold(type, d, loadout.level);
        const rate = computeLayerPassRate(stat, threshold);
        rates.push(rate);
      }
      const rateStrs = rates.map((r) => `${(r * 100).toFixed(0)}%`).join(" → ");
      const fullClear = rates.reduce((a, b) => a * b, 1);
      console.log(`   ${type.padEnd(10)} [${rateStrs}]  full-clear: ${(fullClear * 100).toFixed(1)}%`);
    }
  }

  // --- Full-clear Monte Carlo for key loadouts ---
  console.log("\n\n── Monte Carlo Full-Clear Rates (10,000 runs) ──\n");
  const mcLoadouts = LOADOUTS.filter((l) =>
    l.name.includes("focused") && !l.name.includes("balanced")
  );
  for (const loadout of mcLoadouts) {
    const layerCount = ICE_BREAKER_BALANCE.layerCount(loadout.level);
    let clears = 0;
    const runs = 10_000;
    for (let r = 0; r < runs; r++) {
      let cleared = true;
      for (let d = 0; d < layerCount; d++) {
        // Random layer type per depth
        const type = ICE_LAYER_TYPES[Math.floor(Math.random() * ICE_LAYER_TYPES.length)];
        const stat = loadout[STAT_FOR_TYPE[type]];
        const threshold = ICE_BREAKER_BALANCE.layerThreshold(type, d, loadout.level);
        const passRate = computeLayerPassRate(stat, threshold);
        if (Math.random() >= passRate) {
          cleared = false;
          break;
        }
      }
      if (cleared) clears++;
    }
    console.log(`   ${loadout.name.padEnd(30)} ${((clears / runs) * 100).toFixed(1)}% full-clear`);
  }

  // --- Guardrails ---
  console.log("\n");

  // Helper: get pass rate for a specific scenario
  function getRate(stat: number, type: IceLayerType, depth: number, level: number): number {
    const threshold = ICE_BREAKER_BALANCE.layerThreshold(type, depth, level);
    return computeLayerPassRate(stat, threshold);
  }

  const checks: Array<{ name: string; pass: boolean; detail: string }> = [];

  // Floor: stat=0 always returns 0 (below floor)
  const zeroRate = computeLayerPassRate(0, 30);
  checks.push({
    name: "Zero stat → 0% pass rate",
    pass: zeroRate === 0,
    detail: `computeLayerPassRate(0, 30) = ${(zeroRate * 100).toFixed(1)}%`,
  });

  // Ceiling: no loadout exceeds 92%
  let maxSeen = 0;
  for (const loadout of LOADOUTS) {
    for (const type of ICE_LAYER_TYPES) {
      const stat = loadout[STAT_FOR_TYPE[type]];
      for (let d = 0; d < 5; d++) {
        const rate = getRate(stat, type, d, loadout.level);
        if (rate > maxSeen) maxSeen = rate;
      }
    }
  }
  checks.push({
    name: "No pass rate exceeds 92% cap",
    pass: maxSeen <= 0.92,
    detail: `Max observed: ${(maxSeen * 100).toFixed(1)}%`,
  });

  // L4 basic focused, depth 0: pass rate ≥ 20%
  const l4FocusedRate = getRate(18, "FIREWALL", 0, 4);
  checks.push({
    name: "L4 basic focused d0 ≥ 20%",
    pass: l4FocusedRate >= 0.20,
    detail: `stat=18 vs FIREWALL d0 L4: ${(l4FocusedRate * 100).toFixed(1)}%`,
  });

  // L8 advanced focused, depth 0: pass rate ≥ 50%
  const l8FocusedRate = getRate(60, "FIREWALL", 0, 8);
  checks.push({
    name: "L8 adv focused d0 ≥ 50%",
    pass: l8FocusedRate >= 0.50,
    detail: `stat=60 vs FIREWALL d0 L8: ${(l8FocusedRate * 100).toFixed(1)}%`,
  });

  // L15+ elite focused, depth 0: pass rate ≥ 75%
  const l15FocusedRate = getRate(186, "FIREWALL", 0, 15);
  checks.push({
    name: "L15 elite focused d0 ≥ 75%",
    pass: l15FocusedRate >= 0.75,
    detail: `stat=186 vs FIREWALL d0 L15: ${(l15FocusedRate * 100).toFixed(1)}%`,
  });

  // L25 max-elite full-clear (5 layers): between 40-80%
  // Compute worst-case full-clear: focused loadout faces random layer types
  // Use the focused stats that match each layer type
  const l25Focused: Loadout = { name: "L25 max", level: 25, hackPower: 186, stealth: 186, defense: 138 };
  let l25FullClear = 1;
  for (let d = 0; d < 5; d++) {
    // Average across layer types (each equally likely)
    let avgRate = 0;
    for (const type of ICE_LAYER_TYPES) {
      const stat = l25Focused[STAT_FOR_TYPE[type]];
      avgRate += getRate(stat, type, d, 25);
    }
    avgRate /= ICE_LAYER_TYPES.length;
    l25FullClear *= avgRate;
  }
  checks.push({
    name: "L25 max full-clear between 40-80%",
    pass: l25FullClear >= 0.40 && l25FullClear <= 0.80,
    detail: `Estimated full-clear: ${(l25FullClear * 100).toFixed(1)}%`,
  });

  // Floor check: any stat > 0 gets at least 10%
  const floorRate = computeLayerPassRate(1, 200);
  checks.push({
    name: "Stat > 0 always ≥ 10% (floor)",
    pass: floorRate >= 0.10,
    detail: `computeLayerPassRate(1, 200) = ${(floorRate * 100).toFixed(1)}%`,
  });

  const allPass = printGuardrails("ICE BREAKER", checks);

  if (!allPass) {
    console.error("\n✗ Some guardrails FAILED");
    process.exit(1);
  }
  console.log("\n✓ All guardrails passed");
}

runSimulation();
