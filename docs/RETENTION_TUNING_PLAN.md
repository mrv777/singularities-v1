# Retention Tuning Plan (Day 1 / Day 30 / Day 90)

This plan is intentionally incremental: improve UX and retention without creating resource inflation or reducing strategic depth.

## Day 1 (Onboarding + First Session)

### Goals
- Keep momentum high in the first 60 minutes.
- Reduce avoidable frustration from failed actions.
- Keep cognitive load low while teaching core systems.

### Implemented now
- Added scanner energy gating in UI so players cannot attempt hacks they cannot afford.
- Added one-click `Repair All` with strict economy parity:
  - same per-system energy/credit costs as manual repair,
  - same cooldown rules,
  - no discounts and no free efficiency gain.
- Fixed outdated/manual-mismatch text in Operations Manual (phase windows, mutation costs, repair cost model).

### Next experiment
- Add a post-hack "recommended next action" hint when energy is low:
  - "Wait for energy", "open Tech Tree", or "run maintenance scan".
- Success metric:
  - lower day-1 session aborts after first energy wall,
  - improved hacks-per-session without reducing success quality.

## Day 30 (Midgame Retention + Build Variety)

### Goals
- Keep multiple viable playstyles (PvE, mixed, PvP).
- Prevent midgame from feeling like repetitive farming.

### Proposed changes
- Add weekly rotating objective cards (small targeted goals, no mandatory grind).
- Add lightweight loadout preset save/swap to support style switching.
- Surface comparative economy feedback (credits/hour, data/hour, repairs spent) in Net Stats for self-optimization.

### Guardrails
- No direct reward multiplier buffs from these UX systems.
- Use fixed caps per day to avoid runaway economy.

### Success metric
- More players using 2+ playstyles by day 30.
- Stable mutation-readiness timing (no unintended acceleration).

## Day 90 (Long-Tail + Seasonal Stickiness)

### Goals
- Sustain reasons to return across a full season.
- Prevent content exhaustion for highly active players.

### Proposed changes
- Expand binary decision pool each season.
- Add a seasonal objective track tied to varied activities (hacks, PvP, maintenance, scripts), not pure grind volume.
- Publish season-end recap with personal performance deltas (not only rank).

### Guardrails
- Keep reward pacing aligned with current simulation baselines.
- Prefer horizontal progression rewards over raw stat inflation.

### Success metric
- Higher participation in final 30% of season.
- Better day-90 return behavior in active cohorts.

## Rollout Pattern

1. Ship UX-only changes first.
2. Measure for 1-2 weeks.
3. Then ship economy-impacting changes one at a time behind config flags.
4. Re-run progression/economy sims before each balance change merge.

Simulation command and guardrail reference: `docs/BALANCE_SIMULATION_RUNBOOK.md`.
