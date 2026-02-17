# Admin Console

## Overview

Admin UI route: `/ops-nexus-8foh-console`

Admin APIs are served under `/api/admin/*` and are protected by:

- JWT auth (`authGuard`)
- Admin allowlist check (`adminGuard`)
- Admin feature gate (`ADMIN_ENABLED=true`)
- Player wallet consistency check (JWT wallet must match current DB wallet for token `sub`)

## Environment Configuration

```bash
ADMIN_ENABLED=true
ADMIN_PLAYER_IDS=<uuid1,uuid2,...>
ADMIN_WALLET_ADDRESSES=<wallet1,wallet2,...>
```

## Endpoints

- `GET /api/admin/status`
- `GET /api/admin/overview`
- `GET /api/admin/bots/preview?level=12`
- `POST /api/admin/bots/enabled`
- `POST /api/admin/season/end` (requires body `{"confirmation":"END SEASON"}`)

## Audit Logging

State-changing admin actions are written to `admin_audit_logs` with:

- actor (`admin_player_id`)
- action name
- optional details JSON
- request IP and user-agent (best effort)

## Database Objects

Migration: `007_admin_console.sql`

- `admin_settings`
- `admin_audit_logs`
