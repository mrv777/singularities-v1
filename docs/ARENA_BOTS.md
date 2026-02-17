# Arena Bot System

## Purpose

The arena bot system is a **PvP backfill mechanism** to reduce empty-opponent states during low concurrency.

Bots are not full player accounts. They are generated synthetic opponents for matchmaking continuity.

## Design Summary

- Bot targets are deterministic per player/day and validated server-side.
- Bot profile includes tier, level, style, alignment, defense power, and reward multiplier.
- Bot encounters are tagged in combat logs:
  - `is_bot_match = true`
  - `bot_profile` JSON payload

## Guardrails

- Backfill only when human opponents are below the target floor.
- Player daily cap on bot attacks.
- Reduced rewards vs human PvP baseline.
- No reputation gains from bot wins.
- Bot match metrics are excluded from core competitive aggregates:
  - world-event PvP thresholds
  - public network PvP counter

## Runtime Controls

- Runtime setting key: `arena_bots_enabled` in `admin_settings`.
- Admin endpoint toggles the setting:
  - `POST /api/admin/bots/enabled`

## Validation

Run bot simulation guardrail:

```bash
pnpm --filter server sim:bots -- --runs=3000 --days=7 --seed=1337
```

The simulation exits non-zero if guardrails fail.
