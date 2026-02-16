# Phase 2 — Game Systems

## Goal

Add the secondary game systems that create depth and daily variety: system maintenance, automation scripts, daily modifiers, energy refinement, and the level-gating progression system.

## Context

Read `SPEC.md` at the project root for the full game specification. Focus on sections: §6.3 (Maintenance), §6.4 (Scripts), §8 (Daily/Weekly), §15 (Progression), §5 (Resources — passive income).

## What Already Exists (from Phase 0 + Phase 1)

**Infrastructure:** Monorepo, Docker, Postgres, Redis, migrations, shared types, API client.

**Auth:** Wallet connection → signature verification → JWT/session. Auth middleware on all routes.

**Game features working:**
- NFT minting (devnet) → player account creation
- Game header with all stats + countdown timer
- Network map with interactive nodes (Scanner unlocked, others locked by level)
- Modal system with cyberpunk styling
- Infiltration Scanner: scan → select target → configure loadout → hack → earn resources
- Module Tech Tree: 4 categories, Basic tier purchasable + levelable, dependency system
- Infiltration loadout: 3 slots with module assignment
- Resource economy: energy (calculate-on-read regen), credits, data, processing power, reputation
- XP → level progression with level gates
- Heat system: escalating damage on failed hacks
- All actions server-validated

## What to Build

### 1. System Maintenance (SPEC §6.3)

**The 6 subsystems** (already in DB from Phase 0) need gameplay mechanics:

| System | Function | Adjacent Systems (for cascade) |
|--------|----------|-------------------------------|
| Neural Core | Primary processing | Memory Banks, Quantum Processor |
| Memory Banks | Data storage | Neural Core, Data Pathways |
| Quantum Processor | Advanced computation | Neural Core, Security Protocols |
| Security Protocols | Defense baseline | Quantum Processor, Energy Distribution |
| Data Pathways | Information transfer | Memory Banks, Energy Distribution |
| Energy Distribution | Power management | Security Protocols, Data Pathways |

**Degradation mechanics:**
- Systems naturally degrade over time: ~1-2% per real-time hour (computed on read, like energy)
- Additional degradation from: failed hacks (detection damage), PvP damage (Phase 3)
- Status thresholds:
  - OPTIMAL (75-100%): Full performance
  - DEGRADED (30-74%): -15% effectiveness to related stats
  - CRITICAL (<30%): CASCADE RISK — drags adjacent systems down by 5% per hour
  - CORRUPTED (0%): System offline, major penalties
- If 3+ systems reach CORRUPTED → **player death** (Phase 3 implements the actual death/rebirth flow; for now, just flag the condition)

**Cascade mechanic:**
- Background worker (or compute-on-read): when any system is CRITICAL, adjacent systems lose health faster
- Show a clear `CASCADE IMMINENT` warning in the UI when any system enters CRITICAL

**Maintenance actions:**
- `POST /api/maintenance/repair` — repair a specific system
  - Costs energy (15-30 depending on system severity) + credits
  - Restores health by 20-40% depending on action
  - Takes a cooldown period (5 min real-time) before can repair same system again
- `POST /api/maintenance/full-scan` — diagnose all systems (free, just shows current state)

**Frontend — System Status Modal:**
- Display all 6 systems as cards/panels
- Each shows: name, health bar (color-coded by status), status badge, function description
- Degraded/Critical systems pulse or flash
- "Repair" button on each system (grayed out during cooldown)
- CASCADE IMMINENT warning banner when applicable
- Show the adjacency connections between systems (visual lines, like a mini network)

### 2. Script Manager (SPEC §6.4)

Simple IFTTT-style automation — dropdown trigger + dropdown action.

**Available triggers:**
- "Energy > 80%"
- "Energy > 50%"
- "Any system DEGRADED"
- "Any system CRITICAL"
- "Credits > X" (player sets threshold)
- "Heat level = 0"

**Available actions:**
- "Mine Credits" (passive low-yield hack)
- "Mine Data" (passive low-yield data extraction)
- "Repair lowest system" (auto-maintain)
- "Scan for targets" (auto-scan, doesn't auto-hack)

**Rules:**
- Only **1 script active** at a time
- Scripts execute during idle time (background worker checks every 15 min)
- Scripts cost reduced energy (half of manual action cost)
- Scripts produce reduced output (60-70% of manual action yields)

**Backend:**
- `GET /api/scripts` — list player's scripts
- `POST /api/scripts` — create a new script (trigger + action)
- `PUT /api/scripts/:id/activate` — activate a script (deactivates any other)
- `DELETE /api/scripts/:id` — delete a script
- Background worker: every 15 minutes, check all active scripts, evaluate trigger conditions, execute actions if met, log results

**Frontend — Script Manager Modal:**
- List of created scripts with status (active/inactive)
- "Create Script" form: dropdown for trigger, dropdown for action
- Toggle to activate/deactivate
- Delete button
- Activity log showing recent script executions (terminal-style output)

### 3. Daily Modifier System (SPEC §8)

**Define modifier pool in shared constants:**

Minor modifiers (5-15% impact):
- NEURAL_SURGE: +10% processing speed, +5% energy regen
- DATA_FLOW: +15% data mining output
- SIGNAL_BOOST: +10% scan accuracy (better target generation)
- EFFICIENCY_PATCH: -10% maintenance costs
- BANDWIDTH_EXPAND: +10% passive income rate
- QUICK_COMPILE: -15% module upgrade cost

Major modifiers (25-40% impact):
- COMPRESSION_BOOST: Data worth 2x, costs 2x energy
- STEALTH_BLACKOUT: Stealth modules 50% less effective
- POWER_SURGE: All energy costs halved
- COUNTERMEASURE_SWEEP: Detection chance +30% globally
- ECHO_LOOP: Can't hack the same target type twice in a day

**Implementation:**
- At midnight UTC, a cron job / scheduled task selects the day's modifier
  - 5 out of 7 days: random minor modifier
  - 2 out of 7 days: random major modifier
  - Store in `daily_modifiers` table
- `GET /api/modifiers/today` — returns today's active modifier
- All game calculations that are affected by modifiers should check the active modifier and apply bonuses/penalties

**Frontend — Daily Modifier Display:**
- In the game header: modifier badge/icon with tooltip showing details
- Clicking the badge opens a small modal with full modifier description and countdown to next day
- Major modifiers should have a more dramatic visual treatment (pulsing, larger badge)

### 4. Energy System Refinement

Ensure energy feels right for 30-min sessions:

**Base values (level 1):**
- Max energy: 100
- Regen rate: ~2 energy per minute (120/hour) — full refill in ~50 minutes
- A 30-min session uses roughly 60-80 energy through normal play

**Scaling:**
- Each level: +5 max energy, +0.1 regen per minute
- By level 10: 150 max, 3/min regen
- By level 20: 200 max, 4/min regen

**Action costs (refine from Phase 1):**
- Scan: 5 energy
- Easy hack (25-40% security): 10 energy
- Medium hack (41-65%): 15 energy
- Hard hack (66-85%): 20 energy
- Extreme hack (86-95%): 30 energy
- Module upgrade: 5 energy
- System repair: 15-30 energy (based on severity)

These values should be defined as constants in `packages/shared` so they're easily tunable.

### 5. Level Gating (SPEC §15)

Implement the progressive system unlock:

| Level | Unlock |
|-------|--------|
| 1 | Scanner |
| 4 | Tech Tree |
| 6 | System Maintenance |
| 8 | Script Manager |
| 10 | Sandbox exit option (player choice) |
| 10+ | PvP Arena, Security Center, Daily Modifiers visibility, Weekly Topology |

**Implementation:**
- `GET /api/players/me` should include `unlockedSystems: string[]` computed from level
- Network map reads this to determine which nodes are active vs locked
- On level up, if a new system unlocks, show a notification/celebration (typing text animation: "SYSTEM UNLOCKED: Tech Tree")
- The sandbox exit at level 10 should be a deliberate choice:
  - Show a modal: "You've reached Level 10. You can now leave the sandbox. This exposes you to PvP and the full network. Are you ready?"
  - `POST /api/players/exit-sandbox` — sets `is_in_sandbox = false`
  - Once exited, cannot re-enter

**XP curve (diminishing returns):**
```
Level 2: 100 XP
Level 3: 250 XP
Level 4: 500 XP
Level 5: 800 XP
Level 6: 1,200 XP
Level 7: 1,700 XP
Level 8: 2,300 XP
Level 9: 3,000 XP
Level 10: 4,000 XP
Level 11+: 4,000 + (level - 10) * 1,500
```

These should be constants in shared, not hardcoded in business logic.

### 6. Passive Income (Idle System)

Expand the calculate-on-read approach:

- Players earn passive credits and data based on:
  - Base rate (small, increases with level)
  - Active script bonuses
  - Module bonuses (certain modules boost passive income)
  - Daily modifier effects
- When player data is fetched (`GET /api/players/me`):
  - Calculate elapsed time since `last_active_at`
  - Compute passive gains: `rate * elapsed_seconds`
  - Cap at 24 hours of accumulation (prevent infinite offline gains)
  - Apply skip-day logic: if exactly 1 day skipped, grant 80% of passive gains
  - Update player resources and `last_active_at`

### 7. Background Worker

Set up a Redis-backed background job system for:
- Script execution (every 15 minutes)
- System degradation ticks (every 30 minutes — for cascade mechanics that can't be compute-on-read)
- Daily modifier rotation (midnight UTC cron)
- Heat level decay (heat reduces by 1 every hour)

Use a simple approach: BullMQ or a lightweight custom Redis queue. Keep it simple — the worker runs in the same Docker container as the server (or a separate process in the same container).

## Validation Checklist

After this phase, verify:

**System Maintenance:**
- [ ] All 6 systems display with health bars and status badges
- [ ] Systems naturally degrade over time (verify by fast-forwarding timestamps or waiting)
- [ ] Repairing a system costs energy + credits and restores health
- [ ] Repair cooldown prevents spamming
- [ ] When a system hits CRITICAL, adjacent systems start degrading faster
- [ ] CASCADE IMMINENT warning displays when any system is CRITICAL
- [ ] CORRUPTED status triggers when health reaches 0
- [ ] Status thresholds correctly update (OPTIMAL → DEGRADED → CRITICAL → CORRUPTED)

**Script Manager:**
- [ ] Can create a script with trigger + action from dropdowns
- [ ] Can activate only 1 script at a time (activating one deactivates others)
- [ ] Can delete scripts
- [ ] Background worker evaluates active scripts every 15 minutes
- [ ] Scripts execute their action when trigger condition is met
- [ ] Script execution costs reduced energy and produces reduced output
- [ ] Script activity log shows recent executions

**Daily Modifiers:**
- [ ] A modifier is selected each day (or can be manually triggered for testing)
- [ ] Header shows current modifier badge with details on hover/click
- [ ] Modifier effects actually apply to game calculations (e.g., POWER_SURGE halves energy costs)
- [ ] Mix of minor and major modifiers in the rotation

**Energy:**
- [ ] Energy regenerates at the correct rate
- [ ] Action costs match the defined values
- [ ] A 30-minute play session does NOT exhaust all energy
- [ ] Energy max increases with level
- [ ] Energy display in header updates after actions and on refresh

**Level Gating:**
- [ ] New players only see Scanner on the network map
- [ ] Reaching level 4 unlocks Tech Tree node (with notification)
- [ ] Level 6 unlocks System Maintenance
- [ ] Level 8 unlocks Script Manager
- [ ] Level 10 shows sandbox exit dialog
- [ ] Choosing to exit sandbox unlocks remaining nodes
- [ ] Locked nodes show their level requirement

**Passive Income:**
- [ ] Logging in after being offline shows accumulated passive resources
- [ ] Passive gains are capped at 24 hours
- [ ] Passive rates are affected by modules and daily modifiers
- [ ] Skip-day mechanic: 1 skipped day grants 80% passive income

**Background Worker:**
- [ ] Worker starts with the server (or as a separate process)
- [ ] Script execution jobs run on schedule
- [ ] System degradation ticks process correctly
- [ ] Daily modifier rotation triggers at midnight UTC
- [ ] Heat level decays over time

**General:**
- [ ] All new endpoints are auth-protected
- [ ] TypeScript compiles without errors
- [ ] No regressions in Phase 1 features (scanner, tech tree, loadouts still work)
