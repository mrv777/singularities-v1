# Phase 4 — World Systems

## Goal

Build the living world layer: weekly topology shifts, binary decisions with permanent consequences, the alignment system, world events driven by aggregate player behavior, module mutation/fusion, and the full season system with resets, catch-up mechanics, and winner rewards.

## Context

Read `SPEC.md` at the project root for the full game specification. Focus on sections: §7 (Alignment), §8 (Daily/Weekly Systems), §9 (Binary Decisions), §10 (World Events), §11 (Seasons), §23 (Economy Summary).

## What Already Exists (from Phases 0-3)

**Full game loop working:**
- Wallet auth → NFT mint → scanner → hack → earn resources → upgrade modules
- Tech tree (4 categories, modules with levels, dependency chains)
- Three loadout types (infiltration, attack, defense)
- System maintenance (6 subsystems, degradation, cascade, repair)
- Script manager (IFTTT-style automation)
- Daily modifiers (rotating buffs/debuffs, minor/major mix)
- Energy system (regen, scaling with level, action costs)
- Level gating (progressive system unlock, level 1-10 sandbox)
- Passive income (calculate-on-read)
- Background worker (scripts, degradation, modifier rotation, heat decay)

**PvP and stakes:**
- Combat arena (loadout auto-battler, opt-in, PvP hours 12-24)
- Security center (defense config, threat monitor, heat display)
- PvP protection (opt-in, auto-defense, damage cap)
- Death/rebirth (cascade failure → NFT burn → carryover → re-mint with traits)
- Sandbox exit (player choice at level 10)
- NFT transfer detection with adaptation period

## What to Build

### 1. Weekly Topology Shifts (SPEC §8)

The network map should reconfigure every Monday at midnight UTC.

**Topology changes:**
- 1-2 nodes change visual position on the map (purely cosmetic but feels dynamic)
- 1 random feature node gets a temporary **boost** (e.g., "Scanner outputs +20% credits this week")
- 1 random feature node gets a temporary **hindrance** (e.g., "Tech Tree upgrades cost +15% more this week")
- Occasionally: a "rogue malware" node appears — a special one-time hackable target with high risk/high reward that disappears at end of week

**Implementation:**

```
weekly_topologies (
  id SERIAL PRIMARY KEY,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  node_positions JSONB,       -- override positions for nodes
  boosted_node VARCHAR(64),   -- which feature gets a bonus
  boost_effect JSONB,         -- { type: "credit_bonus", value: 0.2 }
  hindered_node VARCHAR(64),  -- which feature gets a penalty
  hindrance_effect JSONB,     -- { type: "cost_increase", value: 0.15 }
  special_node JSONB,         -- rogue malware / special event node (nullable)
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

- Cron job at Monday midnight UTC: generate new topology
- `GET /api/world/topology` — returns current week's topology data
- Frontend: network map reads topology data and adjusts node positions, adds visual indicators for boosted/hindered nodes
- Boosted node: green glow/highlight + tooltip explaining the bonus
- Hindered node: amber/red tint + tooltip explaining the penalty
- Special node (if present): unique pulsing appearance, clickable to attempt

### 2. Binary Decisions (SPEC §9)

Random events that present a yes/no choice with permanent, partially-hidden consequences.

**Decision pool (define in shared constants):**

```typescript
interface BinaryDecision {
  id: string
  prompt: string           // "Absorb corrupted code?"
  description: string      // flavor text explaining the situation
  yesLabel: string         // "ABSORB"
  noLabel: string          // "REJECT"
  yesEffects: Effect[]     // hidden from player until chosen
  noEffects: Effect[]      // hidden from player until chosen
  alignmentShift: number   // how much this affects alignment (-0.1 to +0.1)
  levelRequirement: number // minimum level to encounter this
  rarity: 'common' | 'uncommon' | 'rare'
}

interface Effect {
  type: 'stat_modifier' | 'system_health' | 'resource_grant' | 'permanent_buff' | 'permanent_debuff'
  target: string        // which stat/system
  value: number         // amount
  duration: 'permanent' | 'session' | 'hours_24' | 'hours_48'
  description: string   // revealed after choice
}
```

**Example decisions:**
1. "CORRUPTED DATA FRAGMENT DETECTED — Absorb?"
   - Yes: +15% processing power permanently, but -5% system stability (all systems degrade 5% faster)
   - No: Nothing happens

2. "UNKNOWN SIGNAL ON SECURE CHANNEL — Accept transmission?"
   - Yes: 60% chance +500 credits, 40% chance lose 10% on a random system
   - No: +5 reputation (cautious behavior noted)

3. "ROGUE AI OFFERS ALLIANCE — Merge code?"
   - Yes: +20% stealth for 48h, alignment shifts -0.15 (toward domination)
   - No: +10% defense for 48h, alignment shifts +0.1 (toward benevolent)

4. "DECRYPT CLASSIFIED DATABASE — Proceed?"
   - Yes: Large credit reward, but heat +3 and detection chance +10% for 24h
   - No: Nothing

Create at least 15-20 decisions covering a range of rarities and level requirements.

**When decisions trigger:**
- After completing a hack (10% chance per hack)
- After a combat encounter (15% chance)
- On daily login (5% chance)
- Each decision can only be encountered once per AI lifetime (tracked in `player_decisions`)

**Backend:**
- `GET /api/decisions/pending` — check if player has a pending decision to make (triggered by recent action)
- `POST /api/decisions/choose` — submit choice (yes/no)
  - Apply effects
  - Record in `player_decisions` (permanent — cannot undo)
  - Return revealed effects
- Decision triggering: after hacks and combat, roll chance. If triggered, select a decision the player hasn't seen yet. Store as pending.

**Frontend:**
- When a decision triggers, show a dramatic modal overlay:
  - Glitch effect on the background
  - Decision prompt in large text with typing animation
  - Flavor text description
  - Two buttons: YES / NO (with their labels)
  - No indication of what the effects are (mystery is the point)
- After choosing, reveal the effects with another typing animation:
  - "ABSORBED: Processing power enhanced by 15%. WARNING: System stability compromised."
- Decision history accessible somewhere (maybe in a "Logs" or "History" section)

### 3. Alignment System (SPEC §7)

**Sliding scale: -1.0 (Total Domination) to +1.0 (Benevolent AI)**

**What shifts alignment:**
- Attacking weaker players (>5 levels below): -0.05 per attack
- Attacking stronger players: +0.02 per attack
- Choosing "risky/aggressive" binary decisions: varies per decision
- Choosing "cautious/merciful" binary decisions: varies per decision
- Successful PvP defense (you were attacked, you won): +0.01
- Hacking civilian/social targets: -0.02
- Hacking military/government targets: neutral (they're "the system")
- Certain module mutations: alignment shift

**Extreme alignment perks (>0.8 or <-0.8):**

Benevolent (>0.8):
- Cooperative Module: "Shield Ally" — can reduce damage taken by another player you designate
- +15% reputation gain from all sources
- +10% defense loadout effectiveness
- Reduced aggro from other Benevolent players (they're less likely to target you)

Domination (<-0.8):
- Aggressive Module: "Data Drain" — successful attacks steal 10% more credits
- +15% credit gain from all sources
- +10% attack loadout effectiveness
- Reduced detection chance on extreme-risk hacks

**Implementation:**
- `alignment` field already exists on players (FLOAT, -1.0 to 1.0)
- Update alignment after relevant actions
- `GET /api/players/me` includes alignment value and active perks
- Alignment affects matchmaking display (show alignment badge on arena opponents)
- Alignment-exclusive modules unlock only at extreme values

**Frontend:**
- Alignment indicator in the header or profile: visual scale from red (domination) through neutral gray to blue (benevolent)
- Tooltip shows current value and active perks
- When alignment crosses an extreme threshold (±0.8), dramatic notification: "ALIGNMENT SHIFT: BENEVOLENT PROTOCOL ENGAGED"

### 4. World Events / Ripple System (SPEC §10)

Aggregate player behavior triggers global effects.

**Server-side aggregation (daily cron job):**

At midnight UTC, analyze the previous day's activity across all players:

```typescript
interface RippleAnalysis {
  totalHacks: number
  totalHacksByType: Record<string, number>  // how many of each target type
  totalPvPBattles: number
  averageStealthUsage: number               // % of players using stealth modules
  averageDefenseInvestment: number          // average defense loadout power
  totalModuleUpgrades: number
  totalDeaths: number
}
```

**Ripple event triggers:**
- If total hacks > threshold → "NETWORK ALERT: Countermeasures installed. Detection +10% tomorrow."
- If stealth usage < 20% → "SURVEILLANCE REDUCED: Detection -10% tomorrow."
- If PvP battles > threshold → "CONFLICT ESCALATION: PvP rewards +20% tomorrow."
- If total deaths > 0 → "FALLEN AI DETECTED: Network instability. Random system disruptions."
- If module upgrades > threshold → "ARMS RACE: Module costs +10% tomorrow."

**Implementation:**

```
world_events (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  trigger_data JSONB,          -- what caused this event
  effect_data JSONB,           -- what it does
  narrative TEXT,              -- flavor text
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

- Daily cron: analyze, generate 0-2 ripple events, store in `world_events`
- Ripple effects apply as additional daily modifiers (stack with the normal daily modifier)
- `GET /api/world/events` — returns active events for today
- Events shown in the global chat/activity feed

**Frontend:**
- World events appear as banner notifications on login
- Event feed in the chat/activity log area
- Network map might show visual effects for active world events (e.g., red tint during "CONFLICT ESCALATION")

### 5. Module Mutation / Fusion (SPEC §10)

High-level resource sink where players can fuse or mutate modules.

**Mutation:**
- Take one owned module → attempt to mutate it into an enhanced variant
- Cost: heavy credits + data + processing power
- Success rate: 60-70%
- On success: module gains a special bonus effect (contextual effect)
- On failure: module loses 1 level (minimum 1), resources lost
- Each module can only be mutated once

**Contextual effects (discovered through experimentation):**
- "Echo" variant: normally doubles output, but if damaged this turn reflects last effect
- "Ghost" variant: adds stealth bonus to a non-stealth module
- "Overcharge" variant: +50% effect but consumes 2x energy when used
- "Adaptive" variant: bonus changes based on which loadout it's in (attack vs defense)

**Implementation:**
- Add to `player_modules`: `mutation VARCHAR(64) NULL` — the mutation variant
- `POST /api/modules/mutate` — attempt mutation
  - Validate module exists, not already mutated
  - Deduct resources
  - Roll success: 60-70% chance
  - On success: assign random mutation variant, apply bonus
  - On failure: reduce module level by 1, resources still consumed
- Mutation effects factor into loadout power calculations and combat resolution

**Frontend:**
- In the Tech Tree modal, mutated modules show a special visual indicator (glow, icon change)
- "Mutate" button on eligible modules (level 3+ recommended, not already mutated)
- Mutation attempt animation: glitch effect on the module → success/failure reveal
- Mutation effects described in module detail view

### 6. Season System (SPEC §11)

**Season structure:**

```
seasons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(64) NOT NULL,          -- "Season 1: Genesis Protocol"
  started_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,        -- ~3 months from start
  is_active BOOLEAN DEFAULT true,
  meta_modules JSONB,                  -- 2-3 new strongest modules for this season
  catch_up_config JSONB                -- scaling boost parameters
)
```

**Season transition (end of season):**

1. **Determine winner:** Player with highest reputation is the season winner
2. **Winner rewards:**
   - Record winner in a `season_winners` table
   - Mark a trophy on their NFT metadata (via Metaplex metadata update)
   - Grant a free re-mint perk (stored on wallet)
3. **Reset for all players:**
   - Credits → 0
   - Grant small stipend (enough for ~5 days maintenance)
   - Reputation → 0
   - Processing Power → 0, Data → 0
   - **Persist:** Level, modules (with levels), genetic traits, alignment, items
   - Heat → 0
   - All systems → 100% health
4. **Introduce new meta modules:**
   - 2-3 new modules added to the tech tree that are the strongest for this season
   - Previous season's "meta modules" become "legacy" — still work but slightly weaker (e.g., -10% effectiveness)
5. **Start new season record**

**Catch-up mechanics (SPEC §11):**

Three simultaneous systems:

1. **Diminishing returns:** Already in the combat formula — logarithmic power scaling. A level 50 is ~2-3x a level 10, not 50x. Ensure this is consistent across all stat calculations.

2. **Season-specific modules:** New modules each season are the strongest. Everyone chases them. Define these in the season's `meta_modules` JSONB.

3. **Accelerated progression:**
   - Compute server median level daily
   - Players below median get boosted XP: `xp_multiplier = 1 + (median_level - player_level) / median_level`
   - Late joiner boost: `join_boost = 1 + (days_into_season / season_total_days) * 1.0`
     - Day 1: 1.0x (no boost)
     - Day 45 (of 90): 1.5x
     - Day 75: 1.83x
   - Boosts stack multiplicatively

**Backend:**
- `GET /api/seasons/current` — current season info, meta modules, days remaining
- `GET /api/seasons/leaderboard` — top players by reputation this season
- `POST /api/admin/season/end` — trigger season transition (admin only, or scheduled cron)
- Season catch-up boost applied in XP calculation functions
- Season meta modules added to the module constants (loaded from season data)

**Frontend:**
- Season info displayed somewhere visible (header badge or dedicated section)
- Days remaining in season
- Season-specific modules highlighted in tech tree (special border/glow)
- Leaderboard shows current season rankings
- Season transition: dramatic full-screen event when a season ends
  - "SEASON 1 COMPLETE"
  - Winner announcement
  - "Your credits have been reset. New modules available."
  - Overview of what changed

### 7. Network Statistics Enhancement (SPEC §6.8)

Now that we have real multiplayer data, flesh out the stats screen:

- Total AIs alive
- Total AIs in current season
- Total hacks today / this season
- Total PvP battles today
- Current world events active
- Season leaderboard (top 20)
- Player's rank
- Season countdown

## Validation Checklist

After this phase, verify:

**Weekly Topology:**
- [ ] Topology data generates at the start of each week (or can be triggered for testing)
- [ ] Network map reflects topology changes (boosted node highlighted, hindered node indicated)
- [ ] Boosted node's bonus actually applies to game calculations
- [ ] Hindered node's penalty actually applies
- [ ] Special "rogue malware" node appears occasionally and is interactable

**Binary Decisions:**
- [ ] Decisions trigger after hacks (10% chance) and combat (15% chance)
- [ ] Decision modal shows with dramatic styling and typing animation
- [ ] Choosing YES/NO applies the hidden effects
- [ ] Effects are revealed after choosing
- [ ] Each decision can only be encountered once per AI lifetime
- [ ] Permanent effects persist (verify by logging out and back in)
- [ ] At least 15 decisions are defined in the pool

**Alignment:**
- [ ] Alignment shifts based on player actions (attacking weaker players, binary decisions, etc.)
- [ ] Alignment indicator displays in UI
- [ ] Crossing ±0.8 threshold triggers notification and unlocks extreme perks
- [ ] Extreme alignment perks actually apply to combat/gameplay calculations
- [ ] Alignment badge shows on arena opponent listings

**World Events:**
- [ ] Daily cron analyzes aggregate player behavior
- [ ] Ripple events generate when thresholds are crossed
- [ ] Ripple effects apply as additional modifiers
- [ ] Events display in the activity feed / as banners
- [ ] Visual effects on network map when events are active

**Module Mutation:**
- [ ] Can attempt mutation on eligible modules (level 3+, not already mutated)
- [ ] Mutation costs heavy resources (credits + data + processing power)
- [ ] 60-70% success rate works correctly
- [ ] Success grants a special variant with contextual effect
- [ ] Failure reduces module level by 1, resources consumed
- [ ] Mutated modules show visual indicator in tech tree
- [ ] Mutation effects factor into loadout power and combat

**Seasons:**
- [ ] Season data displays correctly (name, days remaining, meta modules)
- [ ] Season leaderboard shows top players by reputation
- [ ] Season transition resets credits, reputation, resources to appropriate values
- [ ] Modules, levels, traits persist through season reset
- [ ] Small stipend granted at season start
- [ ] New meta modules appear in the tech tree and are purchasable
- [ ] Previous season's meta modules marked as "legacy" with reduced effectiveness
- [ ] Season winner recorded with trophy
- [ ] Catch-up: XP multiplier applied for below-median players
- [ ] Catch-up: late joiner boost scales based on days into season

**Network Statistics:**
- [ ] Stats page shows real aggregate data (total AIs, hacks, battles, events)
- [ ] Leaderboard reflects current season reputation
- [ ] Player's rank is visible

**General:**
- [ ] All new endpoints auth-protected and server-validated
- [ ] No regressions in Phase 1-3 features
- [ ] TypeScript compiles without errors
- [ ] Test with multiple accounts to verify world events and season mechanics
