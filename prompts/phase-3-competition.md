# Phase 3 — Competition

## Goal

Build the PvP combat system, security center, death/rebirth cycle, sandbox exit mechanics, and all PvP protection layers. This is the phase that makes the game truly multiplayer and introduces real stakes.

## Context

Read `SPEC.md` at the project root for the full game specification. Focus on sections: §3 (Death & Rebirth), §4 (Genetic Traits), §6.5 (Combat Arena), §6.7 (Security Center), §12 (PvP), §13 (NFT — Death & Burning, Trading & Transfer).

## What Already Exists (from Phases 0-2)

**All Phase 0+1 features:** Wallet auth, NFT minting, scanner, tech tree, loadouts (infiltration), resource economy, network map, modal system, game header.

**All Phase 2 features:** System maintenance (6 subsystems with degradation/cascade), script manager, daily modifiers, energy refinement, level gating (systems unlock progressively), passive income, background worker (script execution, degradation ticks, modifier rotation).

**Key state:** Players have modules, infiltration loadouts, system health, energy, credits, heat levels. Systems can reach CRITICAL/CORRUPTED status. Background worker runs on schedule.

## What to Build

### 1. Attack & Defense Loadout System

Extend the existing infiltration loadout to support PvP:

**Three loadout types:**
- **Infiltration loadout** (already exists from Phase 1) — 3 module slots for hacking
- **Attack loadout** — 3 module slots optimized for PvP offense
- **Defense loadout** — 3 module slots, always active, used when defending against attacks

**Implementation:**
- `player_loadouts` table already supports `loadout_type` ('attack', 'defense', 'infiltration')
- Update `PUT /api/loadouts` to handle all three types
- Update `GET /api/loadouts` to return all three configurations
- A module can be used in multiple loadouts simultaneously (it's your installed module, not consumed)
- Loadout UI: tabs or sections for each loadout type in a dedicated modal or within Security Center

### 2. PvP Combat Arena (SPEC §6.5)

**Only available during second half of daily cycle (hours 12-24 UTC).**

**Backend — Arena Endpoints:**

`GET /api/arena/available` — list available opponents
- Only returns players who: are NOT in sandbox, have `in_pvp_arena = true` today, are alive
- For each opponent, return: ai_name, level, reputation, alignment, playstyle classification (computed from their module distribution: Offense/Defense/Stealth/Balanced)
- Add a risk/reward estimate: potential credits + reputation gain/loss
- Don't return the player themselves
- Consider level-based matchmaking: only show opponents within ±5 levels (tunable)

`POST /api/arena/enter` — opt into PvP for the day
- Sets `in_pvp_arena = true`
- Can only be called during PvP hours (12-24 UTC)
- Requires player to have exited sandbox
- Returns confirmation

`POST /api/arena/attack` — attack a specific player
- Validate: attacker is in arena, target is in arena, PvP hours active, attacker has enough energy
- Deduct attack energy cost (20-30 energy)
- Check daily damage cap: has attacker already hit their damage-dealt limit today?
- Check per-target cap: has this target already received max damage today?

**Combat Resolution Algorithm:**

```
Attacker: sum of attack loadout module stats (attack_power, special bonuses)
Defender: sum of defense loadout module stats (defense_power, special bonuses)

Modifiers applied:
  - System health: if attacker/defender systems are degraded, reduce effectiveness proportionally
  - Daily modifier: apply any relevant combat buffs/debuffs
  - Genetic traits: apply any combat-relevant trait bonuses
  - Alignment bonuses: extreme alignment grants combat perks

Base win chance = 50% + (attacker_power - defender_power) / scale_factor
Clamp between 15% and 85% (never guaranteed)

Roll outcome:
  - Win: attacker earns credits (taken from defender? or generated?) + reputation
  - Lose: attacker takes system damage to 1-2 random subsystems
```

**Combat Log Generation:**
- Generate a blow-by-blow text log (template-based, NOT LLM):
  - "NEXUS-7 deploys Virus Module Mk.III..."
  - "ATLAS-9's Firewall Module absorbs 45% of the attack..."
  - "Critical hit! Data Pathways take 12% damage."
  - "NEXUS-7 wins. +150 credits, +25 reputation."
- Store full combat log in `combat_logs` table as JSONB
- Each entry: { round: 1, attacker_action: "...", defender_action: "...", damage: {...}, narrative: "..." }

**Outcomes:**
- Winner: +credits, +reputation, +XP
- Loser: system damage applied to 1-2 specific subsystems (10-20% each, subject to daily damage cap)
- Loser's system damage respects the cascade rules (if pushing into CRITICAL, cascade begins)

`GET /api/arena/combat-logs` — get recent combat logs for the player (as attacker or defender)

**Frontend — Combat Arena Modal:**
- Phase indicator: "PvP ACTIVE" or "PvP OFFLINE — opens in X hours"
- If PvP inactive, show countdown and disable all combat actions
- "Enter Arena" button (if not yet opted in today)
- List of available opponents (from GET /api/arena/available):
  - Each shows: name, level, type badge (Offense/Defense/Stealth), reputation, estimated risk/reward
  - "Attack" button on each
- Attack confirmation dialog: "Attack ATLAS-9? Cost: 25 energy. Estimated risk: Medium."
- Combat result screen: show the combat log with typing animation (line by line)
- Recent combat log viewer (both attacks initiated and defenses against you)

### 3. PvP Protection Layers (SPEC §6.5)

**Layer 1: Opt-in**
- `in_pvp_arena` flag: only players who called `/api/arena/enter` today can be attacked
- Reset all `in_pvp_arena` flags at midnight UTC (background job)

**Layer 2: Auto-defense**
- When attacked, the defender's defense loadout is used automatically
- No action needed from the defender — their loadout fights for them
- If defender has no defense loadout configured, they get a default (very weak) defense

**Layer 3: Damage cap**
- Maximum damage any single target can receive per day: 40% total system health across all subsystems
- Maximum number of times a single player can be attacked per day: 3 attacks
- Track in Redis: `pvp_damage_received:{player_id}:{date}` → increment on each attack
- If cap reached, target is removed from available opponents list for the day

### 4. Security Center (SPEC §6.7)

**Frontend — Security Center Modal:**
- **Defense Loadout Configuration** — drag/select 3 modules into defense slots
- **Threat Monitor:**
  - Recent incoming attacks (from combat_logs where you are defender)
  - Each shows: attacker name, result, damage dealt, timestamp
- **Heat Level Display:**
  - Current heat level (0-10 scale)
  - Heat effects: higher heat = higher detection chance on hacks
  - Heat decays over time (already implemented in Phase 2 background worker)
- **System Overview:**
  - Quick-view of all 6 subsystem statuses (link to full maintenance modal)
  - Highlight any cascading systems

### 5. Death & Rebirth System (SPEC §3, §4, §13)

**Death trigger:**
- When 3+ subsystems reach CORRUPTED (0% health), the AI dies
- This check should run:
  - After any system health change (hack damage, PvP damage, cascade tick)
  - In the background worker during cascade processing

**Death sequence (server-side):**
1. Mark player as dead: `is_alive = false`
2. **Burn the NFT on-chain:**
   - Call Metaplex to burn the NFT associated with this player
   - Use the project's authority (must be set up as update authority on the NFT)
   - If burn fails (network issue), queue for retry — player stays dead either way
3. **Calculate carryover:**
   - Identify player's top item/module (highest level module)
   - For each other item/module: 50% chance to recover (roll per item)
   - Store carryover data in a new table: `wallet_carryovers`
     ```
     wallet_carryovers (
       wallet_address VARCHAR(44) PRIMARY KEY,
       guaranteed_module_id VARCHAR(64),
       recovered_modules JSONB,  -- array of module IDs that passed the 50% roll
       deaths_count INTEGER DEFAULT 1,
       last_death_at TIMESTAMPTZ DEFAULT NOW()
     )
     ```
4. **Archive the dead player** (don't delete — keep for leaderboard history)

**Rebirth flow:**
1. When a wallet with carryover data connects and mints a new NFT:
   - Create new player record (fresh stats, level 1)
   - Apply carryover: grant the guaranteed module + any recovered modules
   - Generate 2-3 **genetic traits** (random from trait pool):
     - Overclocker, Ghost Protocol, Hardened Core, Data Siphon, Neural Plasticity (and more)
     - Each has a positive and negative stat modifier (+/- 10-20%)
   - Store traits in `player_traits`
   - Clear the `wallet_carryovers` record
2. Traits affect all relevant calculations (hack power, defense, energy, etc.)

**Frontend — Death Screen:**
- Dramatic death animation (glitch effects, screen corruption, system-by-system shutdown)
- Show what happened: "3 SYSTEMS CORRUPTED — AI TERMINATED"
- Show carryover summary: "1 module guaranteed, X modules recovered (50% chance each)"
- "MINT NEW AI" button → standard mint flow but with carryover applied
- After rebirth, show the new AI's genetic traits with descriptions

### 6. Sandbox Exit (SPEC §15)

- At level 10, show a notification: "You've reached Level 10. You may now exit the sandbox."
- Network map shows a new interactive element: "EXIT SANDBOX" button or special node
- Clicking it opens a confirmation modal:
  - "Leaving the sandbox exposes you to PvP combat and the full network."
  - "You'll gain access to: Combat Arena, Security Center, Network Statistics"
  - "This cannot be undone."
  - "Exit Sandbox" / "Stay in Sandbox" buttons
- `POST /api/players/exit-sandbox`
  - Sets `is_in_sandbox = false`
  - Unlocks all remaining network map nodes
  - Awards bonus XP for exiting

### 7. NFT Transfer Detection

When an NFT is transferred (sold on marketplace):

- Server periodically checks NFT ownership (or uses Solana webhooks if available)
- If the NFT's wallet owner changes:
  - Look up the player record by mint_address
  - Update `wallet_address` to new owner
  - Set `adaptation_period_until` = NOW() + 48 hours
  - During adaptation period: all stats operate at 50% effectiveness
- `GET /api/players/me` includes `adaptationActive: boolean` and `adaptationEndsAt: timestamp`

## Validation Checklist

After this phase, verify:

**Loadouts:**
- [ ] Player can configure attack, defense, and infiltration loadouts separately
- [ ] Modules can be used in multiple loadouts
- [ ] Loadout UI correctly shows all three types

**PvP Arena:**
- [ ] Arena is only accessible during hours 12-24 UTC (show countdown outside these hours)
- [ ] "Enter Arena" opts the player into PvP for the day
- [ ] Available opponents list only shows eligible players (alive, in arena, not in sandbox)
- [ ] Matchmaking respects level range (±5 levels)
- [ ] Attacking costs energy and is validated server-side
- [ ] Combat resolves using the correct formula (loadout stats, modifiers, traits)
- [ ] Combat log is generated with blow-by-blow narrative
- [ ] Winner receives credits + reputation + XP
- [ ] Loser takes system damage (respects cascade rules)

**PvP Protection:**
- [ ] Players NOT in arena cannot be attacked
- [ ] Daily damage cap prevents excessive damage to one player (max 40% total / 3 attacks)
- [ ] `in_pvp_arena` resets at midnight UTC
- [ ] Auto-defense uses the defender's configured defense loadout

**Security Center:**
- [ ] Shows defense loadout configuration
- [ ] Displays incoming attack history
- [ ] Shows current heat level with decay information
- [ ] Quick-view of system health statuses

**Death & Rebirth:**
- [ ] When 3+ systems reach CORRUPTED, the AI is marked dead
- [ ] NFT burn transaction executes on-chain (devnet)
- [ ] Carryover is calculated: 1 guaranteed top module + 50% rolls on others
- [ ] Dead player cannot take any game actions
- [ ] Wallet can mint a new AI after death
- [ ] New AI receives carryover modules
- [ ] New AI gets 2-3 random genetic traits
- [ ] Genetic traits apply their stat modifiers to all relevant calculations
- [ ] Death screen shows dramatic animation and carryover summary

**Sandbox Exit:**
- [ ] Level 10 notification appears
- [ ] Confirmation modal explains consequences
- [ ] Exiting sandbox unlocks PvP Arena, Security Center, remaining nodes
- [ ] Cannot re-enter sandbox after exiting

**NFT Transfer:**
- [ ] Transfer detection updates the player's wallet address
- [ ] Adaptation period activates (48 hours at 50% effectiveness)
- [ ] Adaptation status shown in UI

**General:**
- [ ] All new endpoints are auth-protected and server-validated
- [ ] Combat outcomes are computed entirely server-side (client cannot influence)
- [ ] No regressions in Phase 1-2 features
- [ ] TypeScript compiles without errors
- [ ] Test with 2+ player accounts: one attacks the other, verify full combat flow
