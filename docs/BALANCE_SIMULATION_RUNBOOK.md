# Balance Simulation Runbook

This runbook documents the simulation suite used to validate progression, economy, retention, and exploit resistance.

## Balance Policy

- Default to conservative progression and inflation.
- Prefer shipping slightly slower/leaner economies, then tuning upward with data.
- Treat "too fast" failures as release blockers (cap-rush, runaway credit accumulation).

## Prerequisites

- Install dependencies (`pnpm install`).
- Run from repo root: `/Users/mrv/Documents/GitHub/ai-game-v2`
- Primary package: `packages/server`

## Core Commands

```bash
# Sanity check
pnpm --filter server typecheck

# Run entire suite
pnpm --filter server sim:all
```

## Day-1 / Day-30 / Day-90 Review Commands

```bash
# Day 1 onboarding + first-session feel
pnpm --filter server sim:day1 -- --runs=400 --seed=1337
pnpm --filter server sim:newplayer -- --runs=400 --seed=1337
pnpm --filter server sim:energy -- --runs=400 --seed=1337

# Day 30 midgame economy and style viability
pnpm --filter server sim:economy -- --runs=400 --days=30 --seed=1337 --profile=current --data-vault=on
pnpm --filter server sim:pvp -- --runs=400 --seed=1337
pnpm --filter server sim:decisions -- --runs=400 --seed=1337

# Day 90 endgame and seasonal durability
pnpm --filter server sim:progression -- --runs=400 --seed=1337 --data-vault=on
pnpm --filter server sim:catchup -- --runs=400 --seed=1337
pnpm --filter server sim:endgame -- --runs=400 --seed=1337
pnpm --filter server sim:exploits -- --runs=400 --seed=1337
```

## Script Coverage

- Scanner/minigame model note:
  - Simulations assume one-target-per-scan flow (each infiltration spends scan energy).
  - There is no additional per-hack energy cost in the sim model.

- `sim:progression`: level pacing, unlock timing, full season 1-25 lifecycle, XP source split, XP walls.
- `sim:economy`: gross/net credits, repairs, mutation readiness, and archetype viability.
- `sim:day1`: baseline vs tuned first-session onboarding outcomes.
- `sim:newplayer`: first-success timing, first-5 fail risk, unlock cadence, early confusion risk.
- `sim:energy`: action throughput and downtime by level/session length.
- `sim:pvp`: fairness, level advantage slope, loadout matchup dominance, expected value.
- `sim:bots`: bot arena rewards, tier difficulty, EV, and bot-vs-human reward ratio.
- `sim:health`: degradation sustainability, cascade stability, maintenance burden.
- `sim:modules`: module efficiency spread, category parity, completion timeline.
- `sim:death`: death frequency, carryover value, death-spiral risk, trait-combo safety.
- `sim:decisions`: yes/no option parity, alignment trajectory, content exhaustion speed.
- `sim:modifiers`: modifier tradeoff integrity and economy impact range.
- `sim:catchup`: late-joiner catch-up speed and anti-perverse-incentive validation.
- `sim:endgame`: max-level sink pressure and activity variety.
- `sim:exploits`: passive farming, decision reset value, bot farming ceiling, energy abuse.

## Guardrail Semantics

- Each simulation prints `[sim:<name>] PASS/FAIL` guardrails.
- Any failed guardrail should block balance merge until reviewed.
- Record seed, runs, and profile arguments in PR notes for reproducibility.

## Review Checklist

- Verify at least one run each for day-1, day-30, and day-90 command groups.
- Confirm at least one economy archetype per playstyle is net-positive.
- Confirm no obvious stuck-state loop (energy lock, repair debt lock, death spiral).
- Confirm decision and module paths do not collapse to one dominant strategy.
- Confirm endgame has meaningful sinks and does not accumulate runaway idle resources.
- Confirm progression does not cap-rush (median season-end player should remain below level cap).
