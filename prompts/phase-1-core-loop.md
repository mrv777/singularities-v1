# Phase 1 — Core Loop

## Goal

Build the core gameplay loop: scan for targets, configure a loadout, execute hacks, earn resources, and upgrade modules. Plus NFT minting and the game's main UI (header, network map, modals).

## Context

Read `SPEC.md` at the project root for the full game specification. Focus on sections: §2 (Core Loop), §5 (Resources), §6.1 (Scanner), §6.2 (Tech Tree), §6.6 (Network Map), §13 (NFT Integration), §16 (UI/UX), §19 (Tech Stack), §20 (Auth Flow).

## What Already Exists (from Phase 0)

- Monorepo structure: `packages/client`, `packages/server`, `packages/shared`
- Docker Compose with Postgres, Redis, API server
- Database schema with migrations (all tables created)
- Wallet auth flow (connect → sign message → JWT/session)
- Vite + React + TailwindCSS + TanStack Router shell
- Cyberpunk color palette and base styles
- API client with TanStack Query
- Shared types package
- Basic layout component (header placeholder + main area)

## What to Build

### 1. NFT Minting (SPEC §13, §20)

**Solana Program / Client:**
- Integrate Metaplex SDK for NFT minting on Solana devnet
- Mint flow:
  1. Player connects wallet (already done)
  2. Player clicks "Mint Your AI" → enters a name for their AI
  3. Transaction: player sends SOL → NFT minted to their wallet
  4. Server detects/confirms mint → creates player record in Postgres linked to mint address
- For now, NFT metadata can be minimal (name, collection, placeholder image URI)
- The actual AI avatar generation comes in Phase 5

**Server-side:**
- Endpoint to confirm mint and create player account: `POST /api/players/register`
  - Verify the NFT exists on-chain and belongs to the authenticated wallet
  - Create player record with default stats (level 1, starting resources)
  - Create the 6 subsystem records (all at 100% health)
- Endpoint to get player data: `GET /api/players/me`

### 2. Game Header (SPEC §16)

Always-visible header bar with:
- AI name and level
- Resource display: Credits, Energy, Data, Processing Power
- Reputation score
- Day phase countdown timer (hours remaining in PvE or PvP phase)
- Daily modifier icon/badge (placeholder — just shows "No modifier" for now)
- Cyberpunk styling: monospace font, neon accents, subtle glow effects

### 3. Network Map (SPEC §6.6)

The main game screen — a visual hub of interactive nodes:

- Render 7-9 nodes on a dark background with connection lines between them:
  - **Scanner** (unlocked at level 1)
  - **Tech Tree** (locked until level 4)
  - **System Status** (locked until level 6)
  - **Script Manager** (locked until level 8)
  - **Combat Arena** (locked until level 10 + sandbox exit)
  - **Security Center** (locked until level 10 + sandbox exit)
  - **Network Stats** (locked until level 10 + sandbox exit)
  - Optional: 1-2 "coming soon" nodes (Quantum Lab, Data Vault)
- Each node shows: icon, label, status (active / locked with level requirement)
- Clicking an active node opens a modal for that feature
- Nodes should glow/pulse subtly when active
- Locked nodes appear dimmed with a lock icon and level requirement
- Connection lines drawn between related nodes (SVG or canvas)
- The prototype in `ai-game/` has a working version of this — reference its design patterns

### 4. Modal System

- Base modal component with cyberpunk styling (dark overlay, glow border, slide-in animation)
- Feature router: clicking a network map node opens the corresponding feature modal
- Modals should be closable via X button, escape key, and clicking outside
- Framer Motion entrance/exit animations

### 5. Infiltration Scanner (SPEC §6.1)

**Frontend — Scanner Modal:**
- "Scan Network" button — sends request to server
- Displays 5 randomly generated targets, each showing:
  - Target name and type (Database, Government, Financial, Military, etc.)
  - Security Level (25-95%, shown as a bar or percentage)
  - Risk Rating badge (Low / Medium / High / Extreme)
  - Detection Chance percentage
  - Reward preview (credits + reputation range)
- Player selects a target → sees their current infiltration loadout (modules selected)
- "Execute Hack" button → sends request to server → shows result

**Backend — Scanner Endpoints:**
- `POST /api/scanner/scan` — generates 5 random targets based on player level
  - Target pool scales with level (low-level players see easier targets)
  - Each target has: type, name, security_level, risk_rating, detection_chance, credit_reward, reputation_reward
  - Store generated targets in Redis (TTL 10 min) so they persist until next scan
- `POST /api/scanner/hack` — execute a hack against a selected target
  - Validate player has enough energy
  - Deduct energy cost
  - Calculate success: compare player's loadout power vs target security
  - On success: award credits, reputation, XP
  - On failure: roll detection chance
    - If detected: apply system damage, increment heat level
    - Heat escalation: 1st fail = minor damage, 2nd = moderate, 3rd = catastrophic + cooldown
  - Log the infiltration attempt
  - Return result with narrative text (template-based)

### 6. Module Tech Tree (SPEC §6.2)

**Game Constants (in `packages/shared`):**
Define all 36 modules as data:
- 4 categories: Primary (Offense lean), Secondary (Utility), Relay (Stealth), Backup (Defense)
- 3 tiers per category: Basic, Advanced, Elite
- 3 modules per tier
- Each module definition:
  - `id`, `name`, `description`, `category`, `tier`
  - `cost` (credits + data per level)
  - `maxLevel` (5)
  - `dependencies` (which modules must be unlocked first — 2 of 3 in previous tier)
  - `stats` (what it affects — e.g. +hack_power, +stealth, +defense, +energy_efficiency)
  - `loadoutType` (attack, defense, infiltration, or utility)

**For Phase 1, only Basic tier needs to be fully implemented.** Advanced and Elite tiers should be defined in data but show as locked in UI.

**Frontend — Tech Tree Modal:**
- Display the 4 categories as columns or tabs
- Within each category, show the 3 tiers vertically
- Each module shows: name, icon, current level / max level, cost to upgrade, locked/unlocked status
- Dependency lines between modules (visual connections)
- Click a module → detail panel with description, stats, upgrade button
- Upgrade button → calls API → updates module level → refreshes display
- Locked modules show what's needed to unlock them

**Backend — Module Endpoints:**
- `GET /api/modules` — get player's purchased modules with levels
- `POST /api/modules/purchase` — buy or level up a module
  - Validate dependencies are met
  - Validate player has enough credits + data
  - Deduct resources, create/update module record
  - Award XP
  - Return updated player data

### 7. Basic Resource Economy

**Server-side resource management:**
- All resource changes go through server-validated transactions
- Energy regeneration: calculate-on-read
  - When querying player data, compute: `current_energy = min(energy_max, stored_energy + regen_rate * seconds_elapsed)`
  - Update `energy` and `energy_updated_at` on read
- Action costs (energy):
  - Scan: 5 energy
  - Hack attempt: 10-30 energy (based on target difficulty)
  - Module upgrade: 5 energy
  - (These are starting values — will be tuned)
- XP → level progression:
  - Define XP thresholds per level (diminishing returns curve)
  - On level up: increase energy_max, unlock new systems at level gates

### 8. Loadout System (Basic)

- Players can assign owned modules to infiltration loadout slots
- For Phase 1, just 3 infiltration slots (attack/defense loadouts come in Phase 3)
- `GET /api/loadouts` — get current loadout configuration
- `PUT /api/loadouts` — update loadout slot assignments
- Loadout power calculation: sum of module stats in the loadout, used for hack success calculation

## UI Style Guide

Reference SPEC §16 for the full visual direction. Key points:
- Black/near-black backgrounds (#0a0a0f)
- Monospace font (JetBrains Mono or similar)
- Neon accents: cyan (#00f0ff), magenta (#ff00ff), green (#00ff88)
- Typing text animations for important messages
- Scanline overlay effect (subtle CSS)
- Glow effects on interactive elements (box-shadow with neon color)
- Panels slide/fade in with Framer Motion
- Terminal-style result displays (for hack outcomes)

## Validation Checklist

After this phase, verify the complete flow:

- [ ] New player can connect wallet → mint NFT (devnet) → create account → enter game
- [ ] Game header displays: AI name, level, all resources, countdown timer
- [ ] Network map renders with Scanner (unlocked) and other nodes (locked with level requirements)
- [ ] Clicking Scanner node opens the scanner modal
- [ ] "Scan Network" generates 5 targets with appropriate difficulty for player level
- [ ] Player can select a target and see their loadout
- [ ] "Execute Hack" deducts energy, calculates success/failure, awards resources on success
- [ ] Failed hacks with detection deal system damage and increment heat
- [ ] Heat escalation works (1st/2nd/3rd failure in a session have increasing consequences)
- [ ] Resources update correctly in the header after actions
- [ ] Tech tree modal shows all 4 categories with Basic tier modules available
- [ ] Player can purchase a module (deducts credits + data, awards XP)
- [ ] Player can level up a module (1 → 2, etc.)
- [ ] Purchased modules can be assigned to infiltration loadout slots
- [ ] Loadout affects hack success probability
- [ ] XP accumulation triggers level ups with correct thresholds
- [ ] Level up increases energy_max
- [ ] Level 4 unlocks the Tech Tree node on the network map
- [ ] Energy regenerates over time (verify by waiting or adjusting timestamps)
- [ ] All API endpoints validate auth and return 401 without token
- [ ] TypeScript compiles without errors
- [ ] UI looks correct on both desktop (1440px) and mobile (375px) viewports
- [ ] Cyberpunk aesthetic is consistent: dark theme, neon accents, monospace font, glow effects
