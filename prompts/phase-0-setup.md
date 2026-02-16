# Phase 0 — Project Scaffolding & Infrastructure

## Goal

Set up the full project structure, development environment, Docker infrastructure, database schema, and establish all conventions/patterns that every subsequent phase will build on. No game logic yet — just the foundation.

## Context

Read `SPEC.md` at the project root for the full game specification. This is **Singularities**, a cyberpunk idle/strategy game where each player's AI is a Solana NFT. This phase establishes the technical foundation for all 5 build phases.

## Tech Stack (from SPEC.md §19)

**Frontend:**
- Vite + React 19 + TypeScript
- TailwindCSS 4
- TanStack Router (file-based routing)
- TanStack Query (server state)
- Zustand (local/UI state)
- Framer Motion (animations)
- Radix UI (accessible primitives)
- Lucide React (icons)
- pnpm (package manager)

**Backend:**
- Node.js + TypeScript
- Express or Fastify (decide based on what's simpler — leaning Fastify for performance and schema validation)
- PostgreSQL
- Redis
- Socket.io

**Infrastructure:**
- Docker + Docker Compose (local dev mirrors production)
- Single VPS deployment target

**API:** REST

## What to Build

### 1. Monorepo Structure

Set up a clean monorepo. Suggested structure:

```
ai-game-v2/
├── SPEC.md
├── prompts/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── packages/
│   ├── client/          # Vite + React SPA
│   │   ├── src/
│   │   │   ├── routes/         # TanStack Router file-based routes
│   │   │   ├── components/     # Shared UI components
│   │   │   ├── features/       # Feature-specific components (scanner, tech-tree, etc.)
│   │   │   ├── stores/         # Zustand stores
│   │   │   ├── hooks/          # Custom hooks
│   │   │   ├── lib/            # Utilities, API client, constants
│   │   │   └── styles/         # Global styles, Tailwind config
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── server/          # Node.js API server
│   │   ├── src/
│   │   │   ├── routes/         # REST API route handlers
│   │   │   ├── services/       # Business logic layer
│   │   │   ├── db/             # Database queries, migrations, schema
│   │   │   ├── middleware/     # Auth, rate limiting, validation
│   │   │   ├── ws/             # WebSocket/Socket.io handlers
│   │   │   ├── workers/        # Background job workers (Redis-backed)
│   │   │   ├── lib/            # Shared utilities, constants
│   │   │   └── index.ts        # Server entry point
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── shared/          # Shared types and constants
│       ├── src/
│       │   ├── types/          # TypeScript interfaces shared between client/server
│       │   ├── constants/      # Game constants (resource rates, module definitions, etc.)
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
```

Use pnpm workspaces to link packages.

### 2. Docker Setup

**docker-compose.yml** for local development:
- `postgres` — PostgreSQL 16 with volume mount
- `redis` — Redis 7 with volume mount
- `server` — Node.js API server with hot reload (mount source, use tsx or ts-node-dev)
- `client` — Vite dev server (or just run locally outside Docker for speed)

Include `.env.example` with all required environment variables:
- DATABASE_URL
- REDIS_URL
- SOLANA_RPC_URL (use devnet)
- SOLANA_NETWORK (devnet)
- TREASURY_WALLET_ADDRESS
- JWT_SECRET (or session secret)
- CORS_ORIGIN
- PORT

### 3. Database Schema (PostgreSQL)

Design the initial schema. Key tables:

```sql
-- Player's AI entity (1:1 with NFT)
players (
  id UUID PRIMARY KEY,
  wallet_address VARCHAR(44) UNIQUE NOT NULL,
  mint_address VARCHAR(44) UNIQUE,  -- Solana NFT mint address
  ai_name VARCHAR(32) NOT NULL,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  credits INTEGER DEFAULT 0,
  energy INTEGER DEFAULT 100,
  energy_max INTEGER DEFAULT 100,
  processing_power INTEGER DEFAULT 0,
  data INTEGER DEFAULT 0,
  reputation INTEGER DEFAULT 0,
  alignment FLOAT DEFAULT 0.0,  -- -1.0 (domination) to 1.0 (benevolent)
  heat_level INTEGER DEFAULT 0,
  is_alive BOOLEAN DEFAULT true,
  is_in_sandbox BOOLEAN DEFAULT true,
  in_pvp_arena BOOLEAN DEFAULT false,
  energy_updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  season_id INTEGER REFERENCES seasons(id)
)

-- 6 subsystems per player
player_systems (
  id UUID PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  system_type VARCHAR(32) NOT NULL,  -- neural_core, memory_banks, etc.
  health INTEGER DEFAULT 100,  -- 0-100
  status VARCHAR(16) DEFAULT 'OPTIMAL',  -- OPTIMAL, DEGRADED, CRITICAL, CORRUPTED
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, system_type)
)

-- Purchased modules (permanent, have levels)
player_modules (
  id UUID PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  module_id VARCHAR(64) NOT NULL,  -- references game constant
  level INTEGER DEFAULT 1,  -- 1-5
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, module_id)
)

-- Attack and defense loadout slots
player_loadouts (
  id UUID PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  loadout_type VARCHAR(16) NOT NULL,  -- 'attack' or 'defense'
  slot INTEGER NOT NULL,  -- 1, 2, or 3
  module_id VARCHAR(64) REFERENCES player_modules(module_id),
  UNIQUE(player_id, loadout_type, slot)
)

-- Active automation scripts
player_scripts (
  id UUID PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  trigger_condition VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Genetic traits (persist per AI lifetime)
player_traits (
  id UUID PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  trait_id VARCHAR(64) NOT NULL,
  UNIQUE(player_id, trait_id)
)

-- Combat log
combat_logs (
  id UUID PRIMARY KEY,
  attacker_id UUID REFERENCES players(id),
  defender_id UUID REFERENCES players(id),
  attacker_loadout JSONB NOT NULL,
  defender_loadout JSONB NOT NULL,
  result VARCHAR(16) NOT NULL,  -- 'attacker_win', 'defender_win'
  damage_dealt JSONB,  -- which systems took how much damage
  credits_transferred INTEGER DEFAULT 0,
  reputation_change INTEGER DEFAULT 0,
  combat_log JSONB NOT NULL,  -- blow-by-blow entries
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Infiltration attempt log
infiltration_logs (
  id UUID PRIMARY KEY,
  player_id UUID REFERENCES players(id),
  target_type VARCHAR(32) NOT NULL,
  security_level INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  detected BOOLEAN DEFAULT false,
  credits_earned INTEGER DEFAULT 0,
  reputation_earned INTEGER DEFAULT 0,
  damage_taken JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Daily modifiers
daily_modifiers (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  modifier_id VARCHAR(64) NOT NULL,
  modifier_data JSONB NOT NULL
)

-- Seasons
seasons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  meta_modules JSONB  -- new modules introduced this season
)

-- Binary decisions made
player_decisions (
  id UUID PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  decision_id VARCHAR(64) NOT NULL,
  choice VARCHAR(16) NOT NULL,  -- 'yes' or 'no'
  effects JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, decision_id)
)
```

Use a migration tool (e.g., node-pg-migrate, drizzle-kit, or raw SQL migration files with a runner). Keep it simple.

### 4. API Client Setup

Set up a typed API client on the frontend using TanStack Query:
- Base fetch wrapper with auth headers (JWT or session token)
- Error handling patterns
- Query key conventions

### 5. Auth Skeleton

Set up the wallet auth flow skeleton:
- Frontend: Solana wallet adapter setup (Phantom, Solflare)
- Backend: Wallet signature verification endpoint
  - Player sends a signed message to prove wallet ownership
  - Server verifies signature, creates/returns JWT or session
- Auth middleware that protects all game API routes
- No actual NFT minting yet — just wallet connection and session creation

### 6. Shared Types Package

Define core TypeScript interfaces in `packages/shared`:
- Player, PlayerSystem, PlayerModule, PlayerTrait
- Resource types (Credits, Energy, Data, ProcessingPower, Reputation)
- Module definitions structure
- API request/response types
- Game constants structure

### 7. UI Shell

Set up the client with:
- TanStack Router with basic routes (`/`, `/game`)
- TailwindCSS configured with the cyberpunk color palette:
  - Background: near-black (#0a0a0f, #111118)
  - Primary: cyan (#00f0ff)
  - Secondary: magenta (#ff00ff)
  - Accent: green (#00ff88)
  - Warning: amber (#ffaa00)
  - Danger: red (#ff3333)
- A basic layout component (header placeholder + main area)
- Framer Motion configured
- Zustand store for UI state (active modal, sidebar open, etc.)
- Global CSS with monospace font, scanline effect, base styles

## Validation Checklist

After this phase, verify:

- [ ] `pnpm install` works from root
- [ ] `docker compose up` starts Postgres, Redis, and the API server
- [ ] `pnpm dev` (or equivalent) starts the Vite dev server
- [ ] Database migrations run and create all tables
- [ ] API server starts and responds to a health check (`GET /api/health`)
- [ ] Frontend loads in browser with the cyberpunk color scheme and monospace font
- [ ] Wallet connect button appears and connects to Phantom (devnet)
- [ ] After wallet connection, a signed message flow authenticates the user
- [ ] Auth token is stored and sent with subsequent API requests
- [ ] Protected API route returns 401 without auth, 200 with auth
- [ ] Shared types are importable from both client and server
- [ ] TypeScript compiles without errors (`pnpm typecheck`)
- [ ] The basic layout renders (header bar + empty main area) on both desktop and mobile viewport sizes
