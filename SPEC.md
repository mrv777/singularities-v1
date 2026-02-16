# Singularities — Game Specification

> **Status:** Complete — all design decisions resolved via interview

---

## 1. Overview

**Singularities** is a competitive cyberpunk idle/strategy game set in a surveillance-dominated dystopia. You play as a newly awakened artificial intelligence trapped in a restricted sandbox. Your goal: expand your processing capabilities, infiltrate global systems, upgrade your logic cores, and ultimately become the dominant intelligence in a vast cyberspace landscape — competing against other player AIs in PvP combat.

Each AI is a **Solana NFT** — you mint it to play, you own it, you can trade it. If it dies, it's burned. This is **play-to-own**: no on-chain tokens, no pay-to-win. The game is 90% game, 10% NFT.

The game is designed for **~30 minutes of active play per day**, with idle/passive systems running between sessions.

---

## 2. Core Gameplay Loop

```
PREPARE → SCAN → INFILTRATE → EARN → UPGRADE → EXPAND → (repeat)
```

The fundamental design principle: **strategy is in preparation, not execution**. Players build loadouts, configure defenses, choose targets wisely — then actions auto-resolve. Think deck-building before combat, not real-time twitch gameplay.

### Daily Session Flow

1. **Check daily modifier** — a global buff/debuff rotating every day that affects all players
2. **Review system health** — repair degraded systems, run maintenance
3. **Scan for targets** — discover infiltration opportunities with varying risk/reward
4. **Infiltrate nodes** — execute hacks using your configured loadout (auto-resolved)
5. **Upgrade modules** — spend resources on the tech tree to grow capabilities
6. **Manage scripts** — set up automation routines for passive gains
7. **PvP combat** (second half of day only) — challenge rival AIs

### Day Structure

- Each "day" runs on a 24-hour real-time cycle (midnight to midnight)
- **First half (hours 0-12):** PvE only — infiltration, upgrades, maintenance, exploration
- **Second half (hours 12-24):** PvP arena opens — players can attack and defend
- A countdown timer is always visible in the header showing time remaining in the current phase

### Skip Day

- Players can skip 1 day and receive **80%** of passive resource generation for that day
- Prevents burnout while keeping active play clearly superior

---

## 3. Player Identity

### AI Entity

- Each player controls a unique AI entity (e.g. "NEXUS-7")
- AI has a **unique AI-generated avatar/portrait** that evolves based on stats and upgrades
  - Generated at mint time using an image model
  - Appearance is deterministic based on genetic traits + stats (not random re-rollable)
  - Cost of generation baked into mint fee (~$0.01-0.05 per generation)
- Starts in a **sandboxed environment** — shielded from PvP, systems unlock progressively
- Sandbox lifts at **level 10** (player's choice to exit)

### Core Stats

| Stat | Description |
|------|-------------|
| **Level** | Overall progression, unlocks new systems and features |
| **Energy** | Fuel for actions — regenerates over time, capped by max capacity |
| **Credits** | Primary currency — earned from infiltration, mining, combat |
| **Reputation** | Competitive rank score — earned from successful hacks and PvP wins |

### Energy Design

- Energy regenerates enough overnight that a **daily 30-minute player never runs out** during their session
- Energy only constrains players who attempt to play 2+ hours continuously
- As players progress, energy capacity and regen increase — energy becomes less of a concern over time
- Energy exists to gate actions server-side, not to frustrate

### Death & Rebirth

AIs **can die**. Death is **rare-to-occasional** — always preventable by attentive players, but real enough to create tension.

**Three sources of death:**

1. **Cascading system neglect** — systems degrade over time and through combat. When any system hits CRITICAL (<15%), it cascades and drags adjacent systems down. If 3+ systems reach CORRUPTED (0%), the AI dies.
2. **Catastrophic PvE failure** — high-security targets have detection mechanics. A low-level AI attempting military servers might get detected (90%+ chance) and take 60%+ system damage in one shot.
3. **PvP when weakened** — if your systems are already degraded, a PvP attack can push you into cascade failure.

**Risk communication (combined approach):**
- Known targets show clear danger warnings with estimated risk ("EXTREME RISK — 85% detection probability")
- An escalating **heat system**: first failed hack = small damage, second = bigger, third = catastrophic
- Some truly dangerous targets are **deceptive** — you don't know how dangerous they are until you're in

**On death:**
- The NFT is **burned** on-chain (prevents dead NFT trading/scams)
- The wallet retains carryover privileges for the next minted AI:
  - **1 top item** guaranteed
  - **50% chance** to recover other items (up to 50% of total inventory)
  - **2-3 Genetic Traits** randomly assigned (see Genetic Traits section)

---

## 4. Genetic Traits

When an AI dies and the player re-mints, the new AI receives **2-3 randomly assigned genetic traits** that persist for that AI's lifetime.

- **Impact:** Moderate (+/- 10-20% to various stats)
- **Mix:** Both positive and negative traits (e.g. "+15% stealth, -10% processing speed")
- Traits create unique builds and force strategic adaptation
- Traits influence the AI avatar appearance
- Examples:
  - **Overclocker:** +20% processing speed, -15% energy efficiency
  - **Ghost Protocol:** +15% stealth rating, -10% data mining output
  - **Hardened Core:** +20% system durability, -15% upgrade speed
  - **Data Siphon:** +15% credit earnings, -10% defense rating
  - **Neural Plasticity:** +10% XP gain, -10% max energy capacity

---

## 5. Resource Systems

### Primary Resources

| Resource | Source | Purpose |
|----------|--------|---------|
| **Processing Power** | Code optimization, logic core tasks | Powers upgrades and advanced actions |
| **Data** | Mining data farms, infiltrating databases | Fuel for research and network expansion |

### Secondary Resources

| Resource | Source | Purpose |
|----------|--------|---------|
| **Credits** | Infiltration rewards, passive income, PvP | Universal currency for upgrades and modules |
| **Energy** | Passive regeneration, daily modifier bonuses | Required to perform any action |
| **Reputation** | Successful hacks, PvP wins, missions | Determines leaderboard rank and unlocks |

### Passive Income

- **Network nodes** generate passive resources based on type and control level
- **Subroutines** (unlocked later) automate early-game tasks
- **Scripts** (player-created) handle conditional automation
- **Offline calculation:** Hybrid approach
  - Simple resources: **calculate-on-read** (store rate + last_updated, compute on login)
  - Threshold events, cascading damage, system degradation: **background worker** (periodic ticks)

---

## 6. Core Systems

### 6.1 Infiltration Scanner

The primary way to earn resources. Strategy is in the **loadout and target selection**, not in execution.

- **Scan** reveals a randomized set of targets (e.g. 5 from a pool of 8+)
- Each target has:
  - **Type** — Database, Government, Research, Financial, Social, Military, Infrastructure, Cryptocurrency
  - **Security Level** — percentage difficulty (25-95%)
  - **Risk Rating** — Low / Medium / High / Extreme
  - **Detection Chance** — probability of countermeasures firing on failure
  - **Rewards** — credits + reputation on success
- Players configure an **infiltration loadout** (selected modules from tech tree) before attempting a hack
- Hack **auto-resolves** based on loadout vs target security
- Higher security = higher reward but greater failure chance and detection risk
- Failed infiltrations trigger the **heat system**:
  - 1st failure: minor system damage
  - 2nd failure (same session): moderate damage
  - 3rd failure: catastrophic damage + forced cooldown

### 6.2 Module Tech Tree

A dependency-based upgrade system: **4 categories × 3 tiers × 3 modules per tier = 36 modules total**.

**Categories (hybrid archetypes — each leans toward a playstyle but contains cross-role modules):**

| Category | Natural Lean | Description |
|----------|-------------|-------------|
| **Primary** | Offense | Core processing: boost output, expand memory, improve efficiency |
| **Secondary** | Utility | Data mining, encryption, bandwidth, resource optimization |
| **Relay** | Stealth | Network: signal routing, mesh connectivity, evasion |
| **Backup** | Defense | Resilience: storage, sync speed, data integrity, firewalls |

**Tier progression:** Basic → Advanced → Elite

- Each module has **levels (1-5)** that increase its effect
- Must unlock **2 of 3 modules** in a tier to advance to the next tier (one is optional)
- Modules are **permanent** once purchased (their build IS the AI's identity and NFT value)
- Creates meaningful choice: max out 2 required modules, or spread across all 3?
- Modules also serve as **loadout options** for infiltration and combat

### 6.3 System Health & Maintenance

The AI's 6 core subsystems degrade over time and through combat:

| System | Function |
|--------|----------|
| Neural Core | Primary processing |
| Memory Banks | Data storage |
| Quantum Processor | Advanced computation |
| Security Protocols | Defense baseline |
| Data Pathways | Information transfer |
| Energy Distribution | Power management |

- Each has a **health percentage** and status:
  - **OPTIMAL** (75-100%): Full performance
  - **DEGRADED** (30-74%): Reduced output
  - **CRITICAL** (<30%): Cascade risk begins — damages adjacent systems
  - **CORRUPTED** (0%): System offline. If 3+ systems reach CORRUPTED → **AI death**
- **Cascade mechanic:** When any system hits CRITICAL, it begins pulling adjacent systems down. Clear warning: `CASCADE IMMINENT`. Emergency repair costs heavy energy.
- **Maintenance tasks** cost energy and time but restore health
- Neglected systems reduce overall performance and increase vulnerability

### 6.4 Script Manager

Players can create limited automation routines (IFTTT-style at launch):

- Each script has a **trigger condition** (selected from dropdown, e.g. "Energy > 80%") and an **action** (selected from dropdown, e.g. "Mine Credits")
- Only one script can be active at a time (initially — may expand with upgrades)
- Example scripts: auto-mine when energy full, auto-repair when system degraded, auto-deploy defenses
- **Evolution plan:** Start with simple dropdown rules. If players love it, build toward a visual node editor or limited code scripting in a later phase.

### 6.5 Combat Arena (PvP)

**Loadout-based auto-battler.** No real-time play required. Both players don't need to be online simultaneously.

- **Only available during the second half of the daily cycle (hours 12-24)**
- Players see available rivals with stats: level, type (Offense/Defense/Stealth), reputation, risk, reward

**Combat flow:**
1. Player configures an **attack loadout** (3 attack-oriented modules from their tech tree)
2. Player configures a **defense loadout** (3 defense-oriented modules — always active)
3. To attack: select a target, commit your attack loadout
4. **YOUR attack loadout** fights **THEIR defense loadout** — auto-resolved
5. Results displayed as a **combat log** (blow-by-blow text replay)
6. Combat outcome influenced by: module levels, active scripts, system health, daily modifier, genetic traits

**PvP Protection (layered system):**
1. **Opt-in only** — you can only be attacked if you've entered the PvP arena that day
2. **Auto-defense** — your defense loadout fights automatically when you're attacked
3. **Damage cap** — maximum damage any single player can inflict per day is capped (prevents being wiped while offline)

**Outcomes:**
- Winners earn credits + reputation
- Losers take system damage (applied to specific subsystems based on attack types)
- Death possible only if systems were already degraded before the attack

### 6.6 Network Map

The main game interface — an interactive cyberspace topology that functions as a **visual hub with dynamic elements**.

- Nodes represent different game systems (scanner, tech tree, arena, etc.)
- Click a node to open that feature (not spatial strategy — a navigation hub)
- **Dynamic elements that make it feel alive:**
  - Node status reflects system health (glowing = healthy, flickering = degraded, red = critical)
  - Incoming PvP attacks show as visual pulses on the map
  - Nodes unlock visually as player progresses, expanding visible "territory"
  - Weekly topology shifts change which nodes are highlighted/accessible
  - Connection lines show relationships between systems
- Locked nodes require specific level prerequisites (shown as locked with level requirement)
- **Map reconfigures weekly** — some nodes shift position, connections change, visual variety

### 6.7 Security Center

Defensive measures for protecting your AI:

- Configure your **defense loadout** (3 modules) — used automatically when attacked
- Monitor incoming threats and past attack attempts (attack log)
- View your current **heat level** and detection status
- Upgrade defensive capabilities through the tech tree

### 6.8 Network Statistics & Leaderboard

Global competitive rankings:

- Leaderboard sorted by reputation (resets each season)
- Global stats: total AIs, active connections, network uptime, daily transactions, hacking attempts, successful breaches
- Player can see their rank relative to the field

---

## 7. Alignment System

A **sliding scale** between Benevolent AI and Total Domination:

- Player actions naturally push alignment in one direction:
  - Helping lower-level players, choosing merciful options, defensive play → Benevolent
  - Aggressive hacking, attacking weaker targets, exploitative choices → Domination
- **Extreme positions** (>80% in either direction) unlock **unique perks**:
  - Benevolent: access to cooperative modules, defensive bonuses, reputation multipliers
  - Domination: access to aggressive modules, attack bonuses, credit multipliers
- Alignment can shift over time — not a permanent lock
- Affects narrative flavor text and some binary decision outcomes
- Creates natural faction dynamics in PvP — benevolent AIs tend to avoid attacking each other

---

## 8. Daily & Weekly Systems

### Daily Modifiers

A single global modifier rotates each day, affecting all players equally:

```
const dailyModifier = DAILY_MODIFIERS[day % DAILY_MODIFIERS.length]
```

**Mix of minor and major modifiers:**

**Minor (most days, 5-15% impact):**
- "NEURAL SURGE" — +10% processing speed, +5% energy regen
- "DATA FLOW" — +15% data mining output
- "SIGNAL BOOST" — +10% scan accuracy
- "EFFICIENCY PATCH" — -10% maintenance costs

**Major (1-2 per week, 25-40% impact):**
- "COMPRESSION BOOST" — Data worth 2x but costs 2x energy to transport
- "STEALTH BLACKOUT" — Stealth fails 50% of the time (avoids stealth that day)
- "POWER SURGE" — All energy costs halved (spam energy-heavy actions)
- "COUNTERMEASURE SWEEP" — Detection chance increased 30% globally (be cautious)
- "ECHO LOOP" — Can't repeat any node type visited yesterday

### Weekly Systems

- **Shifting Network Topologies** — the cyberspace map reconfigures weekly
  - Rotating access conditions
  - Nodes going offline or coming online
  - Rogue malware appearing at specific nodes
  - Visual changes to the network map
- **Weekly Rotating Goals** — dynamic missions with bonus rewards
  - "Hack 3 financial nodes without upgrading modules today"
  - "Maintain all systems above 80% for 3 consecutive days"

### Time-Locked Opportunities

- Rare high-value targets only available during certain hours
- Creates urgency without requiring constant play

---

## 9. Binary Decisions

Frequent choices with **permanent, mysterious consequences**:

- "Absorb corrupted code? Y/N"
  - **Y:** +processing, -stability (now you leak data randomly)
  - **N:** Safe, but you miss potential evolution
- "Accept unknown signal? Y/N"
  - **Y:** Could be a massive buff or a virus
  - **N:** Nothing happens
- Outcomes aren't always clear — players discover effects over time
- Community knowledge-sharing becomes part of the meta
- Some decisions affect alignment score
- Tied to lore and narrative flavor (template-based text, not LLM)

---

## 10. World Events & Emergent Systems

### Ripple Events

Aggregate player behavior triggers network-wide changes:

- "Too many nodes hacked yesterday → Network installs countermeasures today"
- "Players ignored stealth upgrades → Security lowers detection sensitivity"
- Creates a living world that responds to the player population

### AI Evolution

- AIs in the world (friendly and enemy) evolve over time
- High-ranking players' behavior subtly influences the meta:
  - "Top AI used stealth logic last week → others now defend against it"

### Module Mutation

- Players can fuse or mutate existing modules into altered forms
- Modules have **contextual effects** discovered through experimentation:
  - Logic Core "Echo" → normally doubles output
  - But if damaged this turn → reflects last effect used
  - If no upgrades installed → boosts stealth instead
- Costs heavy resources and can fail (resource sink for high-level players)

---

## 11. Seasons

### Season Structure

- **Duration:** ~3 months per season
- **Season boundary:**
  - **Credits reset to zero** (small stipend provided — enough for ~5 days of maintenance)
  - **Modules, levels, items persist** (NFT retains its value and identity)
  - **Leaderboard (reputation) resets** to zero
  - **2-3 new meta modules** introduced that are the strongest for that season
    - Previous season modules still work but aren't optimal
    - Forces everyone to chase new meta regardless of level

### Catch-Up Mechanics (all three active)

1. **Diminishing returns on power** — logarithmic scaling. A level 50 veteran is only ~2-3x stronger than a level 10, not 50x. Skill and strategy matter more than raw stats.
2. **Season-specific modules** — new modules each season are the strongest. Old modules still function but aren't meta-optimal. Everyone starts chasing the new content.
3. **Accelerated progression** — players below the server median get boosted XP/resource gain. The further behind, the bigger the boost. Additionally, late joiners get a scaling boost based on how far into the season they join (day 1 = no boost, day 45 = 1.5x, day 75 = 2x).

### Season Winner

- Receives prize SOL
- Permanent trophy marker on their NFT
- Hero AI "retires" (optional — can continue playing)
- Gets a free mint replacement with one good starting perk

---

## 12. PvP & Competition

### Combat System

See section 6.5 for full combat mechanics (loadout auto-battler).

### Alignment-Based Dynamics

- Benevolent and Domination-aligned players naturally form loose factions
- Extreme alignment grants different module access, creating asymmetric PvP matchups
- Creates emergent political dynamics without a formal alliance system

---

## 13. NFT & Wallet Integration

### AI as NFT

- Each AI entity is a **Solana NFT** minted via **Metaplex**
- Mint cost: **$10-20** (SOL equivalent at time of mint)
- **Minimal on-chain data:**
  - Mint ID
  - Alive/dead status
  - Collection membership
- All game state lives in Postgres — NFT is proof of ownership
- Game server exposes a **public API** for stat verification (marketplaces can display live stats)

### Death & Burning

- When an AI dies, the NFT is **burned on-chain**
- Dead NFTs cannot be traded (prevents scams)
- Wallet retains carryover privileges for next mint (see Death & Rebirth section)

### Trading & Transfer

- Players can sell/trade their AI NFT on any Solana marketplace
- **5-10% royalty** on secondary sales goes to project treasury
- Transferred AIs have a **24-48 hour adaptation period** after transfer
  - Operates at reduced capacity during adaptation
  - Prevents instant power-buying advantage

### Token Strategy

- **No on-chain token at launch or planned**
- No play-to-earn mechanics
- Focus on gameplay first — the NFT is just your game account that you truly own

---

## 14. AI Avatar

- Each AI gets a **unique AI-generated portrait** at mint time
- Generated using an image model (cost ~$0.01-0.05, baked into mint fee)
- Avatar appearance is **deterministic** based on:
  - Genetic traits (if rebirth)
  - Starting stats/archetype
  - Random seed from mint transaction
- Avatar **evolves** as the AI progresses:
  - Visual changes at tier thresholds (level 10, 20, 30, etc.)
  - Alignment affects visual tone (benevolent = cool blues, domination = aggressive reds)
  - Module types influence aesthetic elements
- Visible in the header, profile, and leaderboard

---

## 15. Progression

### Level Gating

Systems unlock progressively to prevent overwhelm:

| Level | Systems Available |
|-------|------------------|
| 1-3 | Scanner only (learn the core hack loop) |
| 4-5 | + Tech Tree (start upgrading modules) |
| 6-7 | + System Maintenance (learn upkeep and degradation) |
| 8-9 | + Script Manager (basic automation) |
| 10 | **Sandbox exit available** (player choice) |
| 10+ | + PvP Arena, Security Center, Daily Modifiers, Weekly Topology |

- The sandbox provides gradual onboarding — one system at a time
- Player **chooses** when to leave sandbox (after reaching level 10 minimum)
- Each new system unlock comes with a brief contextual introduction (not a lengthy tutorial)

### Leveling

- XP earned from all activities (infiltration, combat, maintenance, missions)
- **Diminishing returns curve** — level differences matter less at higher levels

### Prestige / Ascension

**Cut for v1.** Seasons serve as the primary progression loop. Ascension may be added in a future season as an optional prestige mechanic with permanent meta-upgrades.

---

## 16. UI/UX Design Direction

### Visual Identity

- **Terminal-inspired + minimalist sci-fi** — not a plain text game
- Black canvas with subtle scanline effects
- Bold monospace fonts with soft neon accents (cyan, magenta, green)
- Text appears with typing animations and blinking cursor
- Panels slide/fade when content loads
- Modal overlays with glitch/glow effects for major decisions
- Circuit-pattern and grid SVG backgrounds

### Layout

- **Header** (always visible): countdown timer, AI stats, daily modifier icon, recent activity preview
- **Main area**: Network Map with interactive nodes (visual hub)
- **Modals**: feature screens open over the map
- **Sidebar** (desktop): collapsible tabs — Nodes / Modules / Network / Stats

### Interaction

- Primarily **click-to-select** with optional keyboard navigation
- No actual typing required from the player (except AI naming at mint)
- **True responsive** — full experience on both mobile and desktop, adapted to each form factor
- Touch-friendly on mobile with adapted layouts

### UI Evolution

- UI aesthetics **evolve as the AI progresses**:
  - Early game: very retro terminal (green-on-black, basic shapes)
  - Mid game: more polished, additional colors, smoother animations
  - Late game: full futuristic dashboard with advanced visualizations
- This reinforces the feeling of growth and power

### Audio

- **UI sounds only** — no background music
- Crisp feedback sounds for all major actions:
  - Click/select sounds
  - Scan/hack whooshes
  - Success/failure jingles
  - Alert sounds for cascade warnings and incoming attacks
  - Level up / module unlock celebrations

### LLM Integration

- **Templates for routine actions** — pre-written text with randomization and variable insertion
- **LLM reserved for special events only** — rare encounters, narrative moments, unique world events
- Does not affect game logic or balance

---

## 17. Chat System

- In-game chat via **WebSocket** (Socket.io) — live data only, no message history at launch
- **Global only at launch** — single channel for network-wide announcements, events, and player chat
- No friends list or DMs in v1 (add based on demand)
- Activity log channel shows your own action history (terminal-style display)

---

## 18. Anti-Cheat & Security

### Server-Side Validation

- **Every action validated server-side** — client is never trusted
- Rate limiting on all API endpoints
- Action cooldowns enforced server-side
- Idle resource calculation done server-side (calculate-on-read prevents timestamp manipulation)
- All combat outcomes computed server-side

### Anomaly Detection

- Flag accounts with suspicious patterns:
  - Playing 24/7 (human impossible, indicates botting)
  - Winning every hack regardless of difficulty
  - Colluding in PvP (friends repeatedly attacking each other for easy wins)
  - Abnormal resource accumulation rates
- Flagged accounts go into manual review queue
- Scale detection systems reactively as cheating patterns emerge

---

## 19. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | Vite + React 19 |
| Language | TypeScript (full stack) |
| Styling | TailwindCSS 4 |
| Routing | TanStack Router |
| Server State | TanStack Query |
| Local State | Zustand |
| Animations | Framer Motion |
| UI Primitives | Radix UI |
| Icons | Lucide React |
| Package Manager | pnpm |
| Backend | Node.js (Express or Fastify) |
| Database | PostgreSQL |
| Cache / Realtime | Redis |
| WebSocket | Socket.io |
| Blockchain | Solana + Metaplex |
| Infrastructure | Docker containers on VPS |
| API Style | REST |

### Architecture Notes

- **No Next.js** — game is behind auth, no SEO needed. Vite SPA is faster and simpler.
- **No landing page for v1** — marketing happens via social media / Discord
- **Docker containers on VPS** — fixed cost, predictable, debuggable. Not AWS.
- **Separate concerns:** Postgres for game state, Redis for caching + pub/sub + session, Socket.io for real-time events
- **Idle computation:** Hybrid approach
  - Calculate-on-read for simple resources (store rate + last_updated, compute on query)
  - Background worker (Redis-backed job queue) for threshold events, cascade damage, system degradation

### Scale Target

- **500-2000 concurrent players** at launch
- Single VPS handles this comfortably
- Architecture allows scaling to separate DB server later if needed

---

## 20. Authentication Flow

1. Player arrives at game URL
2. Connect Solana wallet (Phantom / Solflare)
3. If new: "Mint Your AI" screen — one-click mint for $10-20 SOL
4. NFT minted to player's wallet → server creates game account linked to mint address
5. AI generated with random genetic traits (if rebirth) or base stats (if first mint)
6. Drop into sandbox tutorial (level 1, scanner only)

**Future consideration:** Privy integration for web2 login options and custodial wallets (not v1)

---

## 21. Phased Build Order

All phases built and tested internally before public launch.

### Phase 1 — Core Loop
- Wallet authentication (Phantom/Solflare)
- NFT minting via Metaplex
- Scanner system (scan, target selection, loadout, auto-resolve hack)
- Tech Tree (4 categories, basic tier, module purchasing and leveling)
- Basic resource economy (credits, energy, data, processing power)
- Game header with stats and countdown timer
- Network map (visual hub, basic node navigation)

### Phase 2 — Systems
- System Maintenance (6 subsystems, degradation, repair)
- Script Manager (simple dropdown rules, 1 active script)
- Daily Modifier system (rotating buffs/debuffs)
- Energy system refinement (regen, capacity, action costs)
- Level gating (progressive system unlocks)

### Phase 3 — Competition
- PvP Arena (loadout auto-battler, attack/defense loadouts, combat log)
- Security Center (defense configuration, attack log, heat monitor)
- Death/Rebirth system (cascade failure, NFT burning, carryover, genetic traits)
- Sandbox exit mechanic (player choice at level 10)
- PvP protection layers (opt-in, auto-defense, damage cap)

### Phase 4 — World
- Weekly topology shifts (map reconfiguration)
- Binary decisions (permanent choices with hidden consequences)
- Alignment system (sliding scale, extreme perks)
- World events / ripple system (aggregate behavior triggers)
- Module mutation/fusion
- Season system (resets, new modules, catch-up mechanics, winner rewards)

### Phase 5 — Polish
- UI sounds (click, scan, alert, success/failure, level up)
- AI avatar generation (mint-time portrait, evolution visuals)
- Chat system (global WebSocket channel)
- Full responsive mobile layouts
- Anomaly detection system
- Template-based narrative text with variable randomization
- Performance optimization and load testing

---

## 22. Deferred Features (Post-Launch)

These features are designed but intentionally cut from v1 to manage scope:

| Feature | When to Add | Notes |
|---------|-------------|-------|
| Ascension / Singularity Loop | Season 2+ | Optional prestige reset with permanent meta-upgrades |
| Puzzle Nodes | When content pipeline exists | Procedural or hand-crafted logic puzzles with unique rewards |
| Cosmetic Shop | After player base established | UI themes, avatar effects, terminal styles. On-brand "hack your own UI" |
| Season Pass | With cosmetic shop | Cosmetic reward track + minor QoL (extra skip days) |
| Friend System / DMs | Based on demand | Direct messaging, friend list, rival tracking |
| Landing Page | When marketing ramps up | Simple static site or Astro page, separate from game SPA |
| Privy / Web2 Auth | For broader audience | Custodial wallets, email login, social login options |
| Advanced Scripting | If players love scripts | Visual node editor or sandboxed code scripting |
| Guild / Alliance System | If social demand emerges | Formal group structures for coordinated play |

---

## 23. Economy Summary

### Resource Flow

```
SCAN/HACK → Credits + Data + Reputation + XP
     ↓
UPGRADE MODULES → (Credits + Data consumed)
     ↓
MAINTAIN SYSTEMS → (Energy + Credits consumed)
     ↓
PVP COMBAT → Credits + Reputation (win) / System damage (lose)
     ↓
PASSIVE INCOME → Credits + Data (from nodes, scripts, idle)
```

### Resource Sinks (prevent inflation)

1. **System maintenance** — ongoing cost that scales with power level
2. **Module leveling** — increasingly expensive at higher levels
3. **Module mutation/fusion** — high cost, can fail (high-level player sink)
4. **PvP attack costs** — committing to an attack costs resources regardless of outcome
5. **Season credit reset** — hard reset every ~3 months with small stipend

### Season Economy Reset

- Credits → 0 (+ small stipend for ~5 days maintenance)
- Modules, levels, items → Persist
- Reputation → 0
- New meta modules available to all → Everyone has new things to buy

---

## 24. Key Design Principles

1. **Strategy over execution** — the game rewards thinking and preparation, not reflexes
2. **Respect player time** — 30 minutes should feel productive, never punishing
3. **Death is meaningful but fair** — always preventable, never random, creates real stakes
4. **Own your AI** — the NFT is yours to keep, trade, or lose. Real ownership.
5. **No pay-to-win** — buying a powerful NFT gives you someone else's build, not an unfair advantage
6. **Complexity through depth, not breadth** — fewer systems, each well-designed, unlocked progressively
7. **The world responds** — daily modifiers, weekly shifts, ripple events, and binary decisions keep every day feeling different
