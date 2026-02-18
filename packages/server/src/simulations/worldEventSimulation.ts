/**
 * World Event Ripple Simulation
 *
 * Tests whether the per-capita ripple thresholds fire at the right frequency
 * across different playerbase sizes and days, with random daily active-player
 * counts and randomised per-player activity.
 *
 * Usage:
 *   pnpm --filter @singularities/server sim:worldEvents
 *   pnpm --filter @singularities/server sim:worldEvents -- --days=60 --seed=42
 *   pnpm --filter @singularities/server sim:worldEvents -- --verbose=50
 *     (prints day-by-day breakdown for the 50-player scenario)
 */

import {
  RIPPLE_THRESHOLDS,
  RIPPLE_MIN_ACTIVE_PLAYERS,
  RIPPLE_EVENTS,
} from "@singularities/shared";
import { Rng, parseCliOptions, average, percentile, printGuardrails } from "./lib.js";

// ---------------------------------------------------------------------------
// Player archetypes — fraction of playerbase + daily activity when active
// ---------------------------------------------------------------------------

interface Archetype {
  name: string;
  fraction: number;
  hacksPerDay: [number, number];
  pvpPerDay:   [number, number];
  deathChance: number;          // probability of dying that day
  upgradesPerDay: [number, number];
}

const ARCHETYPES: Archetype[] = [
  // 50 %  casual: light hacking, almost no PvP
  { name: "casual",    fraction: 0.50, hacksPerDay: [2, 8],   pvpPerDay: [0, 1], deathChance: 0.02, upgradesPerDay: [0, 1] },
  // 35 %  active: moderate hacking, occasional PvP
  { name: "active",   fraction: 0.35, hacksPerDay: [8, 18],  pvpPerDay: [1, 4], deathChance: 0.05, upgradesPerDay: [0, 2] },
  // 10 %  power: heavy hacking + PvP
  { name: "power",    fraction: 0.10, hacksPerDay: [15, 30], pvpPerDay: [3, 8], deathChance: 0.10, upgradesPerDay: [1, 4] },
  //  5 %  pvp-focused: low hacking, high PvP
  { name: "pvp",      fraction: 0.05, hacksPerDay: [2, 6],   pvpPerDay: [5, 15], deathChance: 0.15, upgradesPerDay: [0, 2] },
];

// ---------------------------------------------------------------------------
// Simulation types
// ---------------------------------------------------------------------------

interface DayMetrics {
  totalHacks:      number;
  stealthUsage:    number;  // estimated as 40 % of hacks (matches server logic)
  pvpBattles:      number;
  deaths:          number;
  moduleUpgrades:  number;
  activePlayerCount: number;
}

interface EventResult {
  eventId:   string;
  name:      string;
  fired:     boolean;
  metric:    number;
  threshold: number;
  ratio:     number;  // metric / threshold — useful for spotting "near misses"
}

interface DayResult {
  day:         number;
  metrics:     DayMetrics;
  events:      EventResult[];
  eventsFired: string[];
}

interface ScenarioResult {
  totalPlayers:        number;
  days:                DayResult[];
  eventFireRates:      Record<string, number>;
  avgActivePerDay:     number;
  avgHacksPerDay:      number;
  avgPvpPerDay:        number;
  avgDeathsPerDay:     number;
  avgUpgradesPerDay:   number;
  avgEventsPerDay:     number;
  p50ActivePerDay:     number;
  p90ActivePerDay:     number;
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

function pickArchetype(rng: Rng): Archetype {
  const roll = rng.next();
  let cumulative = 0;
  for (const a of ARCHETYPES) {
    cumulative += a.fraction;
    if (roll < cumulative) return a;
  }
  return ARCHETYPES[ARCHETYPES.length - 1];
}

function simulateDay(totalPlayers: number, rng: Rng): DayMetrics {
  // Daily active fraction: 20–70 %, uniformly random
  const activeRatio = 0.20 + rng.next() * 0.50;
  const activePlayerCount = Math.max(1, Math.round(totalPlayers * activeRatio));

  let totalHacks = 0;
  let pvpBattles = 0;
  let deaths = 0;
  let moduleUpgrades = 0;

  for (let i = 0; i < activePlayerCount; i++) {
    const a = pickArchetype(rng);
    totalHacks     += rng.int(a.hacksPerDay[0],    a.hacksPerDay[1]);
    pvpBattles     += rng.int(a.pvpPerDay[0],      a.pvpPerDay[1]);
    if (rng.chance(a.deathChance)) deaths++;
    moduleUpgrades += rng.int(a.upgradesPerDay[0], a.upgradesPerDay[1]);
  }

  return {
    totalHacks,
    stealthUsage: Math.floor(totalHacks * 0.4),
    pvpBattles,
    deaths,
    moduleUpgrades,
    activePlayerCount,
  };
}

function evaluateEvents(metrics: DayMetrics): EventResult[] {
  const effectiveCount = Math.max(RIPPLE_MIN_ACTIVE_PLAYERS, metrics.activePlayerCount);
  const results: EventResult[] = [];

  for (const threshold of RIPPLE_THRESHOLDS) {
    const value = (metrics as unknown as Record<string, number>)[threshold.metric] ?? 0;
    // Mirror server logic: absoluteMin guards against single hyper-active players;
    // per-player scaling takes over once the playerbase is large enough.
    const scaled = Math.max(threshold.absoluteMin, threshold.perPlayerRate * effectiveCount);
    const event  = RIPPLE_EVENTS.find((e) => e.triggerMetric === threshold.metric);
    if (!event) continue;

    results.push({
      eventId:   event.id,
      name:      event.name,
      fired:     value >= scaled,
      metric:    value,
      threshold: scaled,
      ratio:     scaled > 0 ? value / scaled : 0,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Scenario runner
// ---------------------------------------------------------------------------

function runScenario(totalPlayers: number, days: number, seed: number): ScenarioResult {
  const rng = new Rng(seed);
  const dayResults: DayResult[] = [];
  const fireCounts: Record<string, number> = {};

  for (let d = 0; d < days; d++) {
    const metrics = simulateDay(totalPlayers, rng);
    const events  = evaluateEvents(metrics);

    // Mirror real logic: cap at 2 events per day, first-come order
    const fired    = events.filter((e) => e.fired).slice(0, 2);
    const firedIds = fired.map((e) => e.eventId);

    for (const id of firedIds) {
      fireCounts[id] = (fireCounts[id] ?? 0) + 1;
    }

    dayResults.push({ day: d + 1, metrics, events, eventsFired: firedIds });
  }

  const fireRates: Record<string, number> = {};
  for (const ev of RIPPLE_EVENTS) {
    fireRates[ev.id] = (fireCounts[ev.id] ?? 0) / days;
  }

  const activeCounts = dayResults.map((d) => d.metrics.activePlayerCount);

  return {
    totalPlayers,
    days: dayResults,
    eventFireRates:    fireRates,
    avgActivePerDay:   average(activeCounts),
    avgHacksPerDay:    average(dayResults.map((d) => d.metrics.totalHacks)),
    avgPvpPerDay:      average(dayResults.map((d) => d.metrics.pvpBattles)),
    avgDeathsPerDay:   average(dayResults.map((d) => d.metrics.deaths)),
    avgUpgradesPerDay: average(dayResults.map((d) => d.metrics.moduleUpgrades)),
    avgEventsPerDay:   average(dayResults.map((d) => d.eventsFired.length)),
    p50ActivePerDay:   percentile(activeCounts, 50),
    p90ActivePerDay:   percentile(activeCounts, 90),
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseVerboseFlag(argv: string[]): number | null {
  for (const arg of argv) {
    if (arg.startsWith("--verbose=")) {
      const n = Number(arg.slice("--verbose=".length));
      return isNaN(n) ? null : n;
    }
  }
  return null;
}

function printScenario(result: ScenarioResult): void {
  const { totalPlayers: p } = result;
  console.log(`--- ${p.toString().padStart(4)} registered players ---`);
  console.log(
    `  active/day p50=${result.p50ActivePerDay} p90=${result.p90ActivePerDay}` +
    `  avg: ${result.avgActivePerDay.toFixed(1)}`
  );
  console.log(
    `  hacks=${result.avgHacksPerDay.toFixed(0).padStart(5)}` +
    `  pvp=${result.avgPvpPerDay.toFixed(0).padStart(4)}` +
    `  deaths=${result.avgDeathsPerDay.toFixed(1).padStart(5)}` +
    `  upgrades=${result.avgUpgradesPerDay.toFixed(0).padStart(4)}`
  );

  for (const ev of RIPPLE_EVENTS) {
    const rate = result.eventFireRates[ev.id] ?? 0;
    const pct  = (rate * 100).toFixed(0).padStart(3);
    const bar  = rate > 0 ? "█".repeat(Math.max(1, Math.round(rate * 20))) : "·";
    const label = ev.id.replace("ripple_", "").replace(/_/g, " ").padEnd(14);
    console.log(`  ${label} ${pct}%  ${bar}`);
  }

  console.log(`  avg events/day: ${result.avgEventsPerDay.toFixed(2)}`);
  console.log();
}

function printVerbose(result: ScenarioResult): void {
  console.log(`\n=== Day-by-day: ${result.totalPlayers} players ===`);
  const header = "Day  Active  Hacks  PvP  Deaths  Upgrades  Events";
  console.log(header);

  for (const d of result.days) {
    const m   = d.metrics;
    const evs = d.eventsFired
      .map((id) => id.replace("ripple_", "").replace(/_/g, "_"))
      .join(", ") || "-";
    console.log(
      `${d.day.toString().padStart(3)}` +
      `  ${m.activePlayerCount.toString().padStart(6)}` +
      `  ${m.totalHacks.toString().padStart(5)}` +
      `  ${m.pvpBattles.toString().padStart(3)}` +
      `  ${m.deaths.toString().padStart(6)}` +
      `  ${m.moduleUpgrades.toString().padStart(8)}` +
      `  ${evs}`
    );
  }
  console.log();
}

function main() {
  const { days, seed } = parseCliOptions(process.argv.slice(2));
  const verboseAt      = parseVerboseFlag(process.argv.slice(2));

  const SCENARIOS = [1, 5, 10, 25, 50, 100, 250, 500];

  console.log("=== World Event Ripple Simulation ===");
  console.log(`days=${days}  seed=${seed}  floor=${RIPPLE_MIN_ACTIVE_PLAYERS} players`);
  console.log();
  console.log("Thresholds (effective = max(absoluteMin, perPlayerRate × effectiveCount)):");
  for (const t of RIPPLE_THRESHOLDS) {
    const floorScaled = t.perPlayerRate * RIPPLE_MIN_ACTIVE_PLAYERS;
    const effective   = Math.max(t.absoluteMin, floorScaled);
    const crossover   = Math.ceil(t.absoluteMin / t.perPlayerRate);
    console.log(
      `  ${t.metric.padEnd(16)} rate=${t.perPlayerRate}  absoluteMin=${t.absoluteMin}` +
      `  at-floor=${effective}  per-player-takes-over-at=${crossover}-active`
    );
  }
  console.log();

  const allResults: ScenarioResult[] = [];

  for (const playerCount of SCENARIOS) {
    const result = runScenario(playerCount, days, seed);
    allResults.push(result);
    printScenario(result);

    if (verboseAt !== null && playerCount === verboseAt) {
      printVerbose(result);
    }
  }

  // ---------------------------------------------------------------------------
  // Guardrails
  // ---------------------------------------------------------------------------

  const get = (n: number) => allResults.find((r) => r.totalPlayers === n)!;
  const r1   = get(1);
  const r10  = get(10);
  const r50  = get(50);
  const r100 = get(100);
  const r250 = get(250);

  const maxFireRateAnyScenario = Math.max(
    ...allResults.flatMap((r) => Object.values(r.eventFireRates))
  );

  const hackSurge = "ripple_hack_surge";

  const guardrails = [
    // --- Single-player protection ---
    {
      name: "Single player fires no events (even at 100+ hacks)",
      pass: r1.avgEventsPerDay === 0,
      detail: `avg ${r1.avgEventsPerDay.toFixed(2)} events/day (need 0)`,
    },
    {
      name: "5-player game fires no events",
      pass: allResults.find((r) => r.totalPlayers === 5)!.avgEventsPerDay === 0,
      detail: `avg ${allResults.find((r) => r.totalPlayers === 5)!.avgEventsPerDay.toFixed(2)} events/day (need 0)`,
    },
    // --- Early-access range (10–50 players): events are rare/occasional ---
    {
      name: "10-player game: events are rare (≤20% of days)",
      pass: r10.avgEventsPerDay <= 0.20,
      detail: `avg ${r10.avgEventsPerDay.toFixed(2)} events/day (need ≤0.20)`,
    },
    {
      name: "25-player game: hack surge fires occasionally (1–50%)",
      pass: (allResults.find((r) => r.totalPlayers === 25)!.eventFireRates[hackSurge] ?? 0) >= 0.01 &&
            (allResults.find((r) => r.totalPlayers === 25)!.eventFireRates[hackSurge] ?? 0) <= 0.50,
      detail: `fires ${((allResults.find((r) => r.totalPlayers === 25)!.eventFireRates[hackSurge] ?? 0) * 100).toFixed(0)}% of days (need 1–50%)`,
    },
    {
      name: "50-player game: hack surge fires regularly (20–75%)",
      pass: (r50.eventFireRates[hackSurge] ?? 0) >= 0.20 &&
            (r50.eventFireRates[hackSurge] ?? 0) <= 0.75,
      detail: `fires ${((r50.eventFireRates[hackSurge] ?? 0) * 100).toFixed(0)}% of days (need 20–75%)`,
    },
    // --- Growth range (100–250 players): events are a normal part of the world ---
    {
      name: "100-player game: meaningful daily activity (≥0.30 events/day)",
      pass: r100.avgEventsPerDay >= 0.30,
      detail: `avg ${r100.avgEventsPerDay.toFixed(2)} events/day (need ≥0.30)`,
    },
    {
      name: "250-player game: hack surge fires regularly (≥40%)",
      pass: (r250.eventFireRates[hackSurge] ?? 0) >= 0.40,
      detail: `fires ${((r250.eventFireRates[hackSurge] ?? 0) * 100).toFixed(0)}% of days (need ≥40%)`,
    },
    // --- Stealth fog is always harder to trigger than hack surge ---
    {
      name: "Stealth fog never fires more often than hack surge",
      pass: allResults.every(
        (r) => (r.eventFireRates["ripple_stealth_fog"] ?? 0) <=
                (r.eventFireRates[hackSurge] ?? 0) + 0.05
      ),
      detail: `at 250p: surge=${((r250.eventFireRates[hackSurge] ?? 0) * 100).toFixed(0)}%  fog=${((r250.eventFireRates["ripple_stealth_fog"] ?? 0) * 100).toFixed(0)}%`,
    },
  ];

  printGuardrails("sim:worldEvents", guardrails);
}

main();
