# Singularities (AI Game v2)

Competitive cyberpunk idle/strategy game with server-authoritative PvE + PvP systems.

## Key Additions

- **Arena simulated opponents (bots)** to backfill low-population PvP windows with strict reward guardrails.
- **Admin Console** (`/ops-nexus-8foh-console`) for operational visibility, bot controls, and privileged season actions.

## Admin Setup

Set these env vars on the server:

```bash
ADMIN_ENABLED=true
ADMIN_PLAYER_IDS=<comma-separated-player-uuid-list>
ADMIN_WALLET_ADDRESSES=<comma-separated-wallet-addresses>
```

Security model:

- Admin APIs are disabled unless `ADMIN_ENABLED=true`.
- Admin access is allowlist-based (player ID and/or wallet address).
- Admin middleware verifies JWT wallet matches the player’s current wallet in DB.
- High-risk action (`POST /api/admin/season/end`) requires explicit confirmation text (`END SEASON`).
- Admin writes are recorded in `admin_audit_logs`.

## Arena Bot System

Bots are **synthetic opponents**, not entries in the `players` table.

Guardrails:

- Backfill only when human opponent list is below floor.
- Daily bot-attack cap per player.
- Reduced bot rewards and **0 reputation gain** from bot fights.
- Bot matches are marked (`is_bot_match=true`) and excluded from competitive aggregate metrics.
- Runtime toggle via admin endpoint (`POST /api/admin/bots/enabled`).

## Docs

- `/Users/mrv/Documents/GitHub/ai-game-v2/docs/ARENA_BOTS.md`
- `/Users/mrv/Documents/GitHub/ai-game-v2/docs/ADMIN_CONSOLE.md`

## Verification Commands

```bash
pnpm --filter server db:migrate
pnpm -r typecheck
pnpm --filter server test
pnpm --filter server sim:bots -- --runs=3000 --days=7 --seed=1337
```
