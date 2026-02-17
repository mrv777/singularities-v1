# Phase 6 — Deferred Workstreams

These workstreams were scoped during Phase 5 planning but deferred to reduce launch scope.

---

## 1. AI Avatar Generation

- Pick a generation service (DALL-E, Stable Diffusion API, or on-chain generative)
- Server-side generation triggered at player registration
- Add `avatar_url` column to `players` table
- Update NFT metadata to include generated avatar
- Avatar evolution at milestone levels (5, 10, 15, 20)
- Client: display avatar in Header, Arena opponent cards, and Chat messages

## 2. Anomaly Detection

- Daily cron job (run alongside existing worker)
- 4 check types:
  - **Velocity check**: flag players gaining XP/credits faster than 3x median rate
  - **Impossible state check**: flag players with stats exceeding theoretical maximums
  - **Pattern detection**: flag identical hack timing patterns (bot behavior)
  - **Resource anomaly**: flag credit/data totals that don't match sum of logged earnings
- Create `anomaly_flags` table: `player_id`, `flag_type`, `details`, `severity`, `created_at`, `resolved_at`
- Admin API endpoint: `GET /api/admin/anomalies` (admin-only auth)
- Dashboard UI for reviewing flagged accounts

## 3. Performance Optimization & Load Testing

- **Bundle audit**: analyze Vite output, identify large dependencies, add code splitting
- **Lazy loading**: lazy-load modal components (Scanner, Arena, TechTree, etc.) via `React.lazy`
- **DB indexes**: audit slow queries, add composite indexes on `combat_logs`, `infiltration_logs`
- **Redis caching audit**: ensure all hot paths use Redis (player stats, loadout resolution)
- **Rate limiting**: add per-endpoint rate limits via `@fastify/rate-limit`
- **Load testing**: write k6 or artillery scripts targeting:
  - Auth flow (challenge + verify)
  - Scan + hack sequence
  - PvP attack flow
  - WebSocket chat (concurrent connections)
- Target: 100 concurrent players with <200ms p95 latency
