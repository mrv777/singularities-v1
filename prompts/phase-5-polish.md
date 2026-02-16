# Phase 5 — Polish & Launch Readiness

## Goal

Final polish pass: UI sound effects, AI avatar generation, global chat, fully responsive mobile layouts, anomaly detection, narrative text system, and performance optimization. After this phase, the game should be launch-ready.

## Context

Read `SPEC.md` at the project root for the full game specification. Focus on sections: §14 (AI Avatar), §16 (UI/UX — Audio, UI Evolution), §17 (Chat), §18 (Anti-Cheat), and general quality standards across the full spec.

## What Already Exists (from Phases 0-4)

**Complete game loop:** Wallet auth → NFT mint → scanner (loadout-based hacking) → tech tree (36 modules, 4 categories, 3 tiers, dependency chains, levels 1-5) → resource economy → level progression.

**All game systems:** System maintenance (6 subsystems, degradation, cascade), script manager (IFTTT automation), daily modifiers (minor/major rotation), energy system (regen, scaling), level gating (progressive unlock), passive income.

**PvP and stakes:** Combat arena (loadout auto-battler, opt-in, PvP hours), security center, PvP protection layers (opt-in, auto-defense, damage cap), death/rebirth (NFT burn, carryover, genetic traits), sandbox exit.

**World systems:** Weekly topology shifts, binary decisions (permanent consequences), alignment system (sliding scale, extreme perks), world events/ripple system, module mutation/fusion, season system (resets, catch-up mechanics, meta modules, winner rewards).

**Infrastructure:** Network stats/leaderboard, background workers, Redis caching, full Postgres schema.

## What to Build

### 1. UI Sound Effects (SPEC §16)

**UI sounds only — no background music.**

Create or source a set of short, crisp sound effects that fit the cyberpunk terminal aesthetic:

| Action | Sound Style | Duration |
|--------|------------|----------|
| Button click/select | Soft digital click | ~50ms |
| Navigation (open modal) | Smooth whoosh/slide | ~200ms |
| Close modal | Reverse whoosh | ~150ms |
| Scan network | Data stream sweep | ~500ms |
| Hack success | Positive digital chime + data burst | ~400ms |
| Hack failure | Error buzz / static crackle | ~300ms |
| Detection alert | Sharp alarm ping | ~300ms |
| System CRITICAL warning | Low pulsing alarm | ~600ms |
| CASCADE IMMINENT | Escalating alarm sequence | ~800ms |
| Level up | Ascending digital scale / achievement | ~600ms |
| Module unlock/upgrade | Positive confirmation tone | ~300ms |
| PvP attack initiated | Aggressive digital charge-up | ~400ms |
| PvP win | Victory fanfare (short) | ~500ms |
| PvP loss | Defeat tone | ~400ms |
| Binary decision appear | Mysterious/ominous tone | ~400ms |
| Death sequence | System shutdown cascade | ~1000ms |
| Notification | Subtle ping | ~150ms |

**Implementation:**
- Use Web Audio API or a lightweight library (Howler.js or similar)
- Store sounds as small MP3/OGG files in `packages/client/public/sounds/`
- Create a sound manager utility:
  ```typescript
  // packages/client/src/lib/sound.ts
  const sounds = {
    click: new Audio('/sounds/click.mp3'),
    hackSuccess: new Audio('/sounds/hack-success.mp3'),
    // ...
  }

  export function playSound(name: keyof typeof sounds) {
    if (!userPreferences.soundEnabled) return
    sounds[name].currentTime = 0
    sounds[name].play()
  }
  ```
- Add a sound toggle in settings/header (mute/unmute)
- Integrate `playSound()` calls at appropriate points throughout all existing UI interactions
- Sounds should be subtle and non-intrusive — cyberpunk aesthetic, not arcade

**Sound sourcing options:**
- Generate using an AI sound tool
- Use free CC0 sound packs (freesound.org, mixkit.co)
- Keep total sound asset size under 500KB

### 2. AI Avatar Generation (SPEC §14)

**At mint time, generate a unique portrait for the AI.**

**Generation approach:**
- Use an image generation API (Stable Diffusion API, DALL-E, or Replicate)
- Prompt template based on the AI's characteristics:
  ```
  "Cyberpunk AI entity portrait, digital avatar, [color_scheme],
   [trait_visual_elements], glowing circuits, dark background,
   minimalist sci-fi style, no text"
  ```
- Color scheme derived from genetic traits (if rebirth) or random seed
- Trait visual elements: each genetic trait has associated visual descriptors
  - Overclocker → fiery orange highlights, circuit overload patterns
  - Ghost Protocol → translucent, faded edges, stealth-blue tones
  - Hardened Core → angular, armored look, metallic surfaces
  - etc.

**Avatar evolution:**
- At level milestones (10, 20, 30), regenerate the avatar with enhanced prompt:
  - Level 10: add "more sophisticated, additional detail"
  - Level 20: add "advanced, powerful, complex patterns"
  - Level 30: add "transcendent, peak power, elaborate holographic"
- Alignment affects color palette:
  - Benevolent (>0.5): cool blues, whites, soft glows
  - Neutral (-0.5 to 0.5): cyans and greens (default cyberpunk)
  - Domination (<-0.5): reds, dark purples, aggressive shapes

**Implementation:**
- Generate avatar server-side during mint flow
- Store image URL in player record: `avatar_url VARCHAR(512)`
- Store image in object storage (S3-compatible, or just serve from disk on VPS for now)
- Update NFT metadata URI to point to a JSON file that includes the avatar URL
  - This way the NFT shows the avatar on marketplaces
- `POST /api/players/register` (mint flow) → after creating player, queue avatar generation job
- Background worker: generate image, store, update player record, update NFT metadata
- `POST /api/avatar/regenerate` — triggered at level milestones or after major alignment shifts

**Frontend:**
- Avatar displayed in: game header (small), profile modal (large), leaderboard (thumbnail), combat arena opponent list (thumbnail)
- Loading state while avatar generates (show a pulsing placeholder)
- Avatar frame/border that reflects level tier (basic border → gold border → etc.)

### 3. Global Chat (SPEC §17)

**WebSocket-based live chat using Socket.io.**

**Channels (all in one connection, different "rooms"):**

1. **Global chat** — all players can send messages
   - Rate limit: max 1 message per 5 seconds per player
   - Max message length: 200 characters
   - Shows: player AI name, level badge, alignment icon, message text
   - No message history (ephemeral — messages only visible to those online when sent)

2. **System events** — broadcast-only channel (no user input)
   - World events ("NETWORK ALERT: Countermeasures installed")
   - Notable achievements ("NEXUS-7 reached Level 20!")
   - Season announcements
   - PvP highlights ("ATLAS-9 defeated NEXUS-7 in combat")
   - Death announcements ("PHANTOM-3 has been terminated")

3. **Activity log** — personal, per-player
   - Your hack results, module upgrades, system alerts, combat outcomes
   - Terminal-style display (monospace, timestamped)
   - This already partially exists — integrate with WebSocket for real-time updates

**Backend — Socket.io Setup:**
- Authenticate WebSocket connections using the same JWT/session token
- On connect: join the player to the global room and their personal activity room
- Handle events:
  - `chat:send` — player sends a global chat message (validate, rate limit, broadcast)
  - `chat:message` — broadcast to all connected clients
  - `system:event` — server broadcasts system events
  - `activity:update` — server sends personal activity updates to specific player
- Store nothing in the database (ephemeral chat)
- Emit system events from wherever they're triggered in the codebase (hack complete, combat resolved, death, level up, etc.)

**Frontend — Chat Panel:**
- Collapsible panel at the bottom or side of the screen
- Tabs: "Global" / "Events" / "Activity"
- Messages appear with typing-style animation (or at least smooth fade-in)
- Auto-scroll to newest
- Input field for global chat (with character counter)
- Cyberpunk styling: dark background, colored message text (cyan for chat, amber for events, green for activity)
- Mobile: full-width bottom sheet that can be pulled up

### 4. Full Responsive Mobile Layouts (SPEC §16)

Audit and polish ALL existing UI for mobile (375px - 768px viewport).

**Key adaptations:**

**Network Map:**
- Mobile: nodes in a vertical scrollable list or simplified 2-column grid (instead of spatial map)
- Or: zoomed-in view of the map that's swipeable/pannable
- Maintain all dynamic elements (glow, status indicators, locked state)

**Modals:**
- Mobile: full-screen sheets instead of floating modals
- Slide up from bottom with drag-to-dismiss
- All content should be scrollable within the sheet

**Game Header:**
- Mobile: condensed header showing only critical info (energy, credits, level)
- Tap to expand and see all stats
- Daily modifier badge always visible

**Scanner:**
- Mobile: targets in a scrollable card list (one per row)
- Loadout selection as a bottom sheet

**Tech Tree:**
- Mobile: one category at a time (swipeable tabs)
- Modules in a vertical list within each category
- Tier headers as section dividers

**Combat Arena:**
- Mobile: opponent list as full-width cards
- Combat log in a scrollable terminal view

**Chat Panel:**
- Mobile: full-screen overlay when opened
- Floating action button to open chat

**General mobile considerations:**
- All tap targets minimum 44x44px
- No hover-dependent interactions (use tap/long-press instead)
- Font sizes readable without zooming (minimum 14px body text)
- Test on 375px (iPhone SE), 390px (iPhone 14), and 768px (iPad) viewports

### 5. Anomaly Detection (SPEC §18)

**Server-side behavioral analysis running as a background job.**

**Checks (daily cron):**

1. **24/7 play detection:**
   - If a player has actions logged in 20+ of the last 24 hours → flag
   - Query: `SELECT player_id, COUNT(DISTINCT EXTRACT(HOUR FROM created_at)) as active_hours FROM infiltration_logs WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY player_id HAVING COUNT(...) > 20`

2. **Impossible win rate:**
   - If a player has 95%+ hack success rate over 50+ attempts on high-difficulty targets → flag
   - Or: 90%+ PvP win rate over 20+ battles

3. **PvP collusion detection:**
   - If two players repeatedly attack each other (>5 times in a week) with minimal damage → flag
   - Pattern: low-damage fights between the same pair

4. **Resource anomaly:**
   - If resource gain rate is >3x the expected rate for their level → flag

**Implementation:**

```
anomaly_flags (
  id SERIAL PRIMARY KEY,
  player_id UUID REFERENCES players(id),
  flag_type VARCHAR(64) NOT NULL,  -- '24_7_play', 'impossible_winrate', 'pvp_collusion', 'resource_anomaly'
  details JSONB NOT NULL,
  severity VARCHAR(16) DEFAULT 'low',  -- low, medium, high
  reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

- Daily cron runs all checks, creates flags for suspicious accounts
- `GET /api/admin/anomalies` — admin endpoint to view flagged accounts (for manual review)
- No auto-banning — flags are for manual review only
- Log anomaly checks to see false positive rate and tune thresholds over time

### 6. Template-Based Narrative Text

Enhance all game text with varied, flavorful templates.

**Template system:**
```typescript
// packages/shared/src/constants/narratives.ts

const HACK_SUCCESS_TEMPLATES = [
  "Firewall bypassed. {credits} credits extracted from {target_name}.",
  "Access granted. Siphoning {credits} credits from {target_type} node.",
  "Clean penetration. {target_name} compromised — {credits} credits secured.",
  "Data stream intercepted. {credits} credits and {reputation} reputation gained.",
  // ... 10-15 variants per category
]

const HACK_FAILURE_TEMPLATES = [
  "ACCESS DENIED. {target_name} detected your intrusion.",
  "Firewall held. {target_name} remains secure.",
  "Intrusion detected — countermeasures deployed.",
  // ...
]

const COMBAT_TEMPLATES = {
  attack_round: [
    "{attacker} deploys {module_name}...",
    "{attacker} launches {module_name} offensive...",
  ],
  defense_round: [
    "{defender}'s {module_name} absorbs {damage}% of the attack.",
    "{defender} activates {module_name} — {damage}% damage mitigated.",
  ],
  // ...
}

function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? key))
}

function randomTemplate(templates: string[], vars: Record<string, string | number>): string {
  const template = templates[Math.floor(Math.random() * templates.length)]
  return fillTemplate(template, vars)
}
```

**Apply templates to:**
- Hack success/failure messages
- Combat log entries (blow-by-blow)
- System status alerts
- Level up notifications
- Module unlock/upgrade messages
- Binary decision prompts and outcomes
- World event announcements
- Death sequence narration
- Script execution results

Write at least 5-10 variants for each category to prevent repetition.

### 7. UI Evolution (SPEC §16)

The visual aesthetic evolves with player level:

**Early game (Level 1-9):**
- Very retro: green-on-black terminal
- Minimal animations, basic shapes
- Simple borders (1px solid)
- Font: monospace, green (#00ff88) text on black
- Scanline effect prominent

**Mid game (Level 10-19):**
- More colors: cyan (#00f0ff), magenta (#ff00ff) accents
- Smoother animations (Framer Motion spring configs)
- Glowing borders (box-shadow)
- Scanline effect reduced
- More visual flair on interactions

**Late game (Level 20+):**
- Full futuristic dashboard
- Gradient borders, holographic effects
- Complex animations (particle effects on actions, aurora backgrounds)
- Clean, polished UI
- Minimal/no scanline (evolved beyond terminal)

**Implementation:**
- Define a `uiTier` computed from player level: `tier1` (1-9), `tier2` (10-19), `tier3` (20+)
- CSS variables or Tailwind theme variants per tier
- Zustand store tracks current UI tier
- Transition between tiers: smooth CSS transition over ~2 seconds when leveling into a new tier
- Don't rebuild UI — use CSS custom properties to shift colors, shadows, animation configs

### 8. Performance Optimization & Load Testing

**Frontend:**
- Audit bundle size: target <500KB initial JS (code-split routes)
- Lazy-load feature modals (React.lazy + Suspense)
- Optimize re-renders: memoize expensive components, check TanStack Query stale times
- Image optimization: avatars served as WebP, appropriate sizes
- Test on throttled connections (3G simulation)

**Backend:**
- Add database indexes for frequent queries:
  - `players(wallet_address)`, `players(mint_address)`, `players(is_alive, is_in_sandbox)`
  - `player_modules(player_id)`
  - `combat_logs(attacker_id)`, `combat_logs(defender_id)`
  - `infiltration_logs(player_id, created_at)`
  - `daily_modifiers(date)`
- Connection pooling for Postgres (pg-pool or built into ORM)
- Redis caching for:
  - Player data (short TTL, 30 seconds)
  - Daily modifier (long TTL, until midnight)
  - Leaderboard (medium TTL, 5 minutes)
  - Scan targets (already cached from Phase 1)
- Rate limiting on all API endpoints (express-rate-limit or equivalent)
- API response time target: <200ms for reads, <500ms for writes

**Load testing:**
- Use a tool (k6, artillery, or autocannon) to simulate:
  - 500 concurrent users fetching player data
  - 100 concurrent hack attempts
  - 50 concurrent PvP attacks
  - 200 WebSocket connections for chat
- Identify bottlenecks and optimize
- Target: sustain 2000 concurrent players on a single VPS ($40-80/month tier)

## Validation Checklist

After this phase, verify:

**UI Sounds:**
- [ ] Click/select sounds play on button interactions
- [ ] Navigation sounds on modal open/close
- [ ] Hack success/failure sounds play correctly
- [ ] Alert sounds for system warnings
- [ ] Level up sound triggers on level change
- [ ] Combat sounds for PvP actions
- [ ] Sound toggle (mute/unmute) works and persists
- [ ] Sounds don't overlap or create cacophony during rapid actions
- [ ] Total sound asset size <500KB

**AI Avatar:**
- [ ] Avatar generates during mint flow (may take a few seconds)
- [ ] Placeholder shows while avatar loads
- [ ] Avatar displays in header, profile, leaderboard, and arena
- [ ] Avatar reflects genetic traits (if rebirth)
- [ ] Avatar regenerates at level milestones (10, 20, 30)
- [ ] NFT metadata updated with avatar URL (visible on Solana explorers)

**Chat:**
- [ ] WebSocket connects on game load
- [ ] Global chat: can send and receive messages
- [ ] Rate limiting: 1 message per 5 seconds enforced
- [ ] System events channel broadcasts game events (hacks, combat, deaths, world events)
- [ ] Activity log shows personal action history in real-time
- [ ] Chat tabs work (Global / Events / Activity)
- [ ] Chat renders correctly on mobile (full-screen overlay)

**Mobile Responsive:**
- [ ] Network map usable on 375px viewport
- [ ] All modals render as full-screen sheets on mobile
- [ ] Game header condenses properly on small screens
- [ ] Scanner targets readable on mobile
- [ ] Tech tree navigable on mobile (tabs/swipe)
- [ ] Combat arena usable on mobile
- [ ] Chat panel works as bottom sheet on mobile
- [ ] All tap targets ≥44x44px
- [ ] No horizontal scroll on any screen
- [ ] Test on: 375px (iPhone SE), 390px (iPhone 14), 768px (iPad)

**Anomaly Detection:**
- [ ] Daily cron runs behavioral analysis
- [ ] 24/7 play detection flags accounts with >20 active hours
- [ ] Impossible win rate detection works
- [ ] PvP collusion detection identifies repeated low-damage fights
- [ ] Resource anomaly detection catches abnormal gain rates
- [ ] Flags stored in anomaly_flags table with details
- [ ] Admin endpoint returns flagged accounts

**Narrative Text:**
- [ ] Hack results use varied template text (not the same message every time)
- [ ] Combat logs use varied blow-by-blow templates
- [ ] System alerts have flavorful text
- [ ] Level up messages have variety
- [ ] At least 5 variants per message category
- [ ] Template variables filled correctly (no {undefined} in output)

**UI Evolution:**
- [ ] Level 1-9: green terminal aesthetic, prominent scanlines
- [ ] Level 10-19: multi-color, glowing borders, smoother animations
- [ ] Level 20+: full futuristic dashboard, holographic effects
- [ ] Tier transitions are smooth (not jarring)
- [ ] UI tier updates immediately on level up

**Performance:**
- [ ] Frontend bundle <500KB initial load
- [ ] Feature modals lazy-loaded
- [ ] API responses <200ms for reads under load
- [ ] WebSocket handles 200+ simultaneous connections
- [ ] Database queries have appropriate indexes
- [ ] Redis caching reduces DB load
- [ ] Load test: 500 concurrent users sustained without errors
- [ ] No memory leaks after extended play session (30+ minutes)

**End-to-End Launch Readiness:**
- [ ] Complete new player flow: connect wallet → mint → tutorial → scanner → hack → upgrade → level up → unlock systems → exit sandbox → PvP
- [ ] Complete death flow: systems degrade → cascade → death → NFT burned → re-mint → carryover applied → new traits
- [ ] Complete season flow: play → earn reputation → season ends → credits reset → new modules → leaderboard reset
- [ ] All features work on desktop (1440px) and mobile (375px)
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] All API endpoints authenticated and rate-limited
- [ ] Docker build completes and runs in production mode
- [ ] Environment variables documented in .env.example
