# Economy Reference

> Purpose: Map every credit/data/PP source and sink so we can identify balance levers.

---

## Resource Types

| Resource | Primary Use | Notes |
|----------|-------------|-------|
| **Credits** | Module upgrades, repairs, daemon craft, data vault | Primary economy currency |
| **Data** | Module upgrades, mutations, daemon craft, data vault | Secondary currency; earned slower than credits |
| **Processing Power (PP)** | Daemon craft, mutations | Rare; no passive income stream |
| **Energy** | Gates all activity (hacks, repairs, etc.) | Regenerates passively |
| **XP / Level** | Unlocks features, scales income targets | Indirectly affects economy |

---

## INCOME

### 1. Passive Income (always on)
| Metric | Value | Source |
|--------|-------|--------|
| Credits/hr | 6c | `PASSIVE_CREDITS_PER_HOUR` |
| Data/hr | 3d | `PASSIVE_DATA_PER_HOUR` |
| Daily cap | 24h = **144c / 72d** | `PASSIVE_MAX_HOURS` |
| With Signal Boost modifier (+20%) | 172.8c / 86.4d | `passiveIncomeMultiplier` |
| Catch-up multiplier (max) | +75% boost | `CATCH_UP_BASE.resourceBoostFactor` |

**Lever**: Only 6c/hr is quite low relative to hack income (see below). Passive has high cap relative to rate, meaning offline players recover most of what they'd earn anyway, reducing urgency to log in.

---

### 2. Hacking (primary income source)
**Core formula:**
```
grossCredits = (9 + 0.95 × security) × tierMult × scoreMult × 1.2
grossData    = (5 + 0.58 × security) × tierMult × scoreMult × 1.2
```

**Security target formula:** `baseMin(14) + rng(0,12) + level × 3`, capped at 95.

**Tier multipliers** (`MINIGAME_BALANCE`):
| Tier | Security | Multiplier |
|------|----------|-----------|
| T0 | < 30 | ×1.45 |
| T1 | 30–54 | ×1.75 |
| T2 | 55–74 | ×1.95 |
| T3 | 75–95 | ×2.15 |

**Score multiplier** (`getScoreMultiplier`):
| Score | Multiplier |
|-------|-----------|
| 0% | 0× |
| 1–24% | 0.08× (consolation) |
| 25–49% | ramps 0.08→0.70 |
| 50–100% | 0.70→1.25× |

**Global multiplier**: ×1.2 applied to all tiers.

**Example outputs** (at representative security levels, score 79%):
| Level | Security | Gross Credits/hack | Gross Data/hack |
|-------|----------|-------------------|-----------------|
| 1 | 17 (T0) | ~28c | ~17d |
| 5 | 29 (T0) | ~43c | ~26d |
| 10 | 44 (T1) | ~100c | ~61d |
| 15 | 59 (T2) | ~161c | ~98d |
| 20 | 74 (T2) | ~199c | ~122d |
| 25 | 89 (T3) | ~280c | ~172d |

**Hack success rate** (`SCANNER_BALANCE.hackSuccess`):
- Base: 58%, min: 22%, max: 95%
- Early floor (levels 1–4): drops from 36% → 22% at level 4
- Effective solve chance in sim: ~86% (with skill + hackPower)

**Energy cost per hack**: `3 + floor(security / 14)` → 4–10 energy
**Scan cost** (before hack): 12 energy (separate from hack cost)

**Hack volume by archetype:**
| Archetype | Hours/day | Hacks/hr | Daily hacks |
|-----------|-----------|----------|-------------|
| idle_logger | 1h | 3 | 3 |
| cautious_pve | 2h | 6 | 12 |
| mixed | 3h | 5 | 15 |
| aggressive_pvp | 3h | 3 | 9 |
| marathon_grinder | 5h | 10 | 50 |

**Lever**: `creditsBase`, `creditsPerSecurity`, tier multipliers, global 1.2× multiplier, score curve. The score curve is the single biggest variable in per-hack income — a 50% vs 85% score is a ~1.7× difference in income.

---

### 3. PVP Arena (Level 8+ unlock)
| Metric | Value | Source |
|--------|-------|--------|
| Base credits | 26–58c + (level × 2) | `PVP_BALANCE.rewardCredits` |
| Credit steal | 4–10% of defender's held credits | `stealPctMin/Max` |
| Processing Power | 1–2 PP per win | `rewardProcessingPower` |
| Energy cost | 6 energy | `PVP_ENERGY_COST` |
| Win chance model | 50% base + winBias | Archetype-dependent |

**Net value**: Credits stolen from defenders can exceed the base reward at high defender balances. PP is the key late-game value — 1–2 PP/match × 12 matches/day = 12–24 PP/day for aggressive_pvp archetype.

**Lever**: PVP is the main PP faucet for non-hackers. If PP feels too scarce/abundant, stealPct and PP reward range are the levers.

---

### 4. Ice Breaker (Level 4+ unlock)
| Depth | Credits | Data | PP | XP |
|-------|---------|------|----|----|
| 0 | 20c | 10d | 0 | 5 |
| 1 | 50c | 30d | 0 | 15 |
| 2 | 90c | 55d | 0 | 25 |
| 3 | 140c | 80d | 1 | 40 |
| 4 | 200c | 110d | 2 | 50 |

- 3 attempts/day, 18 energy each, 600s cooldown
- Failure: retain 50% of accumulated rewards

**Daily ceiling (3 deep runs to depth 4)**: ~600c + ~330d + ~6PP
**Lever**: Depth rewards and PP drops. Currently PP only appears at depth 3+, making Ice Breaker the most reliable PP source for PvE players.

---

### 5. Decisions (Random Events)
Formula: `(base + perLevel × playerLevel) × rarityScale × (1 + (level-1) × 0.04)`

| Resource | Base | Per Level | At L10 Common | At L20 Common |
|----------|------|-----------|---------------|---------------|
| Credits | 150 | 40 | 550c | 950c |
| Data | 80 | 25 | 330d | 580d |
| PP | 10 | 4 | 50 PP | 90 PP |

Rarity scales: common 1.0×, uncommon 0.85×, rare 0.75×.

**Lever**: Decisions are windfall events. The per-level scaling means late-game decisions are large rewards — a potential inflation source if decision frequency is high.

---

### 6. Daemon Forge (Level 7+ unlock)
Deployed daemons return resources over time:

| Daemon | Duration | Credits returned | Data returned |
|--------|----------|-----------------|--------------|
| RECON | 30–240m | 15–100c | 10–65d |
| SIPHON | 30–240m | 25–150c | 5–30d |
| SENTINEL | 30–240m | 5–30c (defense focus) | 5–20d |
| SABOTEUR | 30–240m | 10–60c | 8–50d |

Slots: 1 (L1–8), 2 (L9–11), 3 (L12+).
Crafting costs come out of Credit/Data/PP (see Expenses below).
Net positive on credits/data assuming full use.

---

### 7. Daily Modifiers (Level 8+ unlock)
Additive/multiplicative effects, no direct income but scale output:
- Signal Boost: +20% passive income
- Harvest Moon: +25% hack rewards, +20% passive income
- Data Bloom: +15% hack rewards
- Neural Resonance: +50% XP, +20% passive income
- Power Surge: −15% energy cost (effectively +15% hack throughput)

---

### 8. Processing Power — Sources Summary
PP has no passive generation. All sources are activity-gated:

| Source | PP per event | Frequency |
|--------|-------------|-----------|
| High-security hack (sec ≥65, score ≥75%) | 1–2 PP | ~15% of T3 hacks |
| PVP win | 1–2 PP | Per match |
| Ice Breaker depth 3 | 1 PP | 3×/day |
| Ice Breaker depth 4 | 2 PP | 3×/day |
| Decisions (PP reward) | Variable (10+) | Occasional |
| Season stipend | 25 PP | Once per new season |

**Daily PP ceiling by archetype (rough)**:
- idle_logger: ~0–2 PP/day (near zero)
- cautious_pve: ~3–6 PP/day (IB-dependent)
- mixed: ~8–15 PP/day
- marathon_grinder: ~15–25 PP/day

---

## EXPENSES

### 1. Module Upgrades (Primary One-Time Sink)

**Upgrade cost formula:**
```
level 0→1: baseCost.credits
level N→N+1 (N≥1): baseCost.credits + costPerLevel.credits × N
```
Max level per module: 6 (6 upgrades total).

**Cost to fully max one module:**
| Tier | Example | 0→1 | 1→2 | 2→3 | 3→4 | 4→5 | 5→6 | **Total** |
|------|---------|-----|-----|-----|-----|-----|-----|---------|
| Basic | Brute Force | 150 | 245 | 340 | 435 | 530 | 625 | **2,325c** |
| Basic | Packet Flood | 160 | 260 | 360 | 460 | 560 | 660 | **2,460c** |
| Basic | Port Scanner | 140 | 230 | 320 | 410 | 500 | 590 | **2,190c** |
| Advanced | Exploit | 225 | 415 | 605 | 795 | 985 | 1175 | **4,200c** |
| Advanced | Zero-Hour | 270 | 480 | 690 | 900 | 1110 | 1320 | **4,770c** |
| Elite | Neural Strike | 640 | 1180 | 1720 | 2260 | 2800 | 3340 | **11,940c** |
| Elite | Quantum Crack | 720 | 1320 | 1920 | 2520 | 3120 | 3720 | **13,320c** |

> **NOTE**: The inline code comment says "~320–400c to reach L5" for basic tier, which doesn't match the formula above. The comment appears stale — the actual cost is 10–20× higher. **This discrepancy should be investigated.**

**Estimated total sink pool (all 36 modules fully maxed)**:
- Basic tier (9 modules × ~2,300c avg): ~**20,700c**
- Advanced tier (9 modules × ~4,500c avg): ~**40,500c**
- Elite tier (9 modules × ~12,000c avg): ~**108,000c**
- **Total module credits: ~169,200c** (exact value printed by `inflationAnalysis.ts`)
- **Total module data**: similar proportional scale

**Lever**: Module costs are massive and intentionally absorb multiple seasons of income. Players focusing their 3 active slots will spend on only a small subset of modules. The total sink pool effectively prevents any player from "completing" the economy in one season.

---

### 2. Mutations (Secondary One-Time Sink)
- Cost per attempt: **500c + 220d + 95 PP**
- Success rate: **65%**
- Expected cost per module: `500 / 0.65 ≈ 770c`, `220 / 0.65 ≈ 338d`, `95 / 0.65 ≈ 146 PP`
- Min module level to mutate: 3
- 36 total modules × ~770c expected = **~27,720c total mutation credit sink**
- **PP sink**: 36 × ~146 PP = **~5,256 PP total** if all modules are mutated

**Lever**: Mutation is the main PP sink. At ~146 PP expected per module and only ~5–25 PP/day income depending on archetype, mutations are naturally gated. The 65% success rate also creates jitter — failed attempts (35% chance) feel punishing when PP is scarce.

---

### 3. System Repairs (Recurring Sink)
**Credit cost formula:**
```
cost = (6 + (100 - currentHealth) × 0.52) × (1 + (level - 1) × 0.10)
```
Heals 30 HP. Cooldown: 300s per system.

**Example costs:**
| Health | Level 1 | Level 5 | Level 10 | Level 20 |
|--------|---------|---------|---------|---------|
| 100 HP (just for energy) | 6c | 8c | 11c | 17c |
| 70 HP (30 missing) | 22c | 29c | 42c | 63c |
| 50 HP (50 missing) | 32c | 42c | 62c | 92c |
| 20 HP (80 missing) | 48c | 62c | 91c | 137c |

**System degradation rate**: 1.15 HP/hr baseline.
- Sentinel daemon: reduces degradation by 50% → ~0.58 HP/hr
- System Overload modifier: applies `degradationRateMultiplier` (can increase rate significantly)

**Cascade damage** (if system reaches 0 HP): 3 HP to each adjacent system every 30 min.

**Repair/income ratio guardrail**: ≤50% of gross income (55% for idle_logger).

**Lever**: The level scaling on repairs is the most critical balance lever here. At level 20, a 50HP repair costs **92c** vs 32c at level 1 — nearly 3×. This creates a natural drain that keeps late-game players spending even after modules are bought. If repairs feel punishing, `creditsPerMissingHealth` (0.52) and `levelScale` (0.10) are the main knobs.

---

### 4. Energy (Time Tax on All Activities)

**Energy system:**
| Metric | Value |
|--------|-------|
| Base max energy | 50 |
| Max per level | +7 per level |
| Base regen/hr | 30 |
| Regen per level | +2/hr |
| At level 10 | Max: 113, Regen: 50/hr |
| At level 25 | Max: 218, Regen: 80/hr |

**Energy costs:**
| Action | Cost |
|--------|------|
| Scan | 12 |
| Hack | 3 + floor(sec/14) ≈ 4–10 |
| Repair | 12 |
| Ice Breaker | 18 |
| Module upgrade | 5 |
| PVP match | 6 |

**Energy-gated daily capacity at level 10 (50 regen/hr):**
- 6 hacks/hr: 12 (scan) + ~7 (hack avg) = ~19/hr → only **2.6 hrs continuous play** at 6 hacks/hr before energy-limited
- In practice: players pace themselves, energy is soft cap not hard wall

**Lever**: Energy is what prevents infinite play. The regen/hr and per-level scaling directly control how much a highly active player can do. `ENERGY_BASE_REGEN_PER_HOUR` (30) and `ENERGY_REGEN_PER_LEVEL` (2) are the key values.

---

### 5. Data Vault Protocols (Optional Recurring Cost)
| Protocol | Credit cost | Data cost | Effect |
|----------|-------------|-----------|--------|
| Focus Cache | 20c | 40d | +8 hackPower |
| Ghost Cache | 15c | 35d | +20 stealth |
| Harvest Cache | 18c | 45d | +12 dataBonus |
| Tandem Cache | 22c | 45d | +4 hackPower, +6 stealth |

- 2 uses/day, 10min cooldown, 20min duration
- Focus Cache is the dominant choice (hackPower → better hack outcomes)

**ROI on Focus Cache at T2/T3**: +8 hackPower adds ~5–10% to hack success rates. At 6 hacks/hr for 2 hours, if it converts 1 extra failure to success (worth ~150c), the 20c cost is easily justified. **Data vault is essentially "pay data to earn more credits"** — good sink.

---

### 6. Daemon Forge Crafting Costs
| Daemon | Credits | Data | PP |
|--------|---------|------|-----|
| RECON | 40c | 20d | 3 PP |
| SIPHON | 50c | 25d | 4 PP |
| SENTINEL | 60c | 30d | 5 PP |
| SABOTEUR | 70c | 40d | 6 PP |

Net positive on credits/data; primary PP sink alongside mutations.

---

### 7. Script Manager (Level 6+ unlock)
- Energy multiplier: 0.5× (half energy cost vs normal hacking)
- Reward efficiency: 0.65× (65% rewards)
- Max active scripts: 3, max total: 8

Scripts are a passive income booster but with diminishing returns — primarily useful for idle players who want some activity while energy-limited.

---

## ECONOMY SUMMARY BY ARCHETYPE

From `inflationAnalysis.ts` and `economySimulation.ts` models:

| Archetype | Hours/day | Gross $/day (est.) | Recurring costs/day | Module spend/day | Net trajectory |
|-----------|-----------|-------------------|--------------------|-----------------|-|
| idle_logger | 1h | ~200–300c | ~100–150c | Low | Slow accumulation |
| cautious_pve | 2h | ~500–800c | ~200–350c | Medium | Steady positive |
| mixed | 3h | ~900–1,400c | ~350–550c | Medium-high | Strong positive |
| aggressive_pvp | 3h | ~700–1,100c | ~300–500c | Medium | PVP supplements |
| marathon_grinder | 5h | ~3,000–5,000c | ~1,200–2,000c | Very high | Fastest sink drain |

**One-time sink exhaustion timeline (estimated):**
- Marathon grinder: modules maxed by **day ~55–70** (guardrail: not before day 55)
- Mixed/PVP: **never fully max all modules in 90 days** (focus on loadout)
- Casual/Idle: **never finish even basic tier fully** — always have things to buy

---

## BALANCE GUARDRAILS (from simulation files)

These are the automated checks in `economySimulation.ts` and `inflationAnalysis.ts`:

| Guardrail | Target | Notes |
|-----------|--------|-------|
| Repair/income ratio | ≤50% (idle: ≤55%) | Prevents death spiral |
| Net income | Positive for all archetypes | No archetype should go broke |
| Inflation ceiling | ≤165c/hr net (at 30+ days) | Prevents runaway credits |
| Mutation accessibility | cautious_pve reaches mutation by day 14 | Onboarding milestone |
| Module completion | Marathon grinder NOT before day 55 | Prevents premature sink drain |
| Post-completion surplus | ≤400c/day implied | Prevents end-game boredom |
| XP progression | No >6.5× jumps between consecutive levels | Smooth leveling |

---

## KEY BALANCE LEVERS

### Credits (Faucets)
| Lever | Location | Impact |
|-------|----------|--------|
| `creditsBase` + `creditsPerSecurity` | `SCANNER_BALANCE.rewards` | Scales ALL hack income |
| Tier multipliers (T0–T3) | `MINIGAME_BALANCE` | Controls reward gradient per security tier |
| Global ×1.2 multiplier | `MINIGAME_BALANCE.globalRewardMultiplier` | Flat multiplier on all hacks |
| Score curve | `getScoreMultiplier()` | Biggest skill-income correlation |
| `PASSIVE_CREDITS_PER_HOUR` | `passive.ts` | Baseline for offline players |
| PVP steal % | `PVP_BALANCE.rewardCredits.stealPctMin/Max` | Late-game PVP income |
| Decision `resourceCaps` | `DECISION_BALANCE` | Windfall event sizes |

### Credits (Drains)
| Lever | Location | Impact |
|-------|----------|--------|
| `creditsPerMissingHealth` (0.52) | `REPAIR_BALANCE` | Per-HP repair cost |
| `levelScale` (0.10) | `REPAIR_BALANCE` | Level scaling on repairs |
| Module `baseCost` + `costPerLevel` | `ALL_MODULES` | Core long-term sink |
| `MUTATION_COST.credits` (500) | `mutations.ts` | High-end PP+credit sink |
| Data vault costs | `DATA_VAULT_PROTOCOLS` | Daily soft drain |

### Processing Power (Faucets)
| Lever | Location | Impact |
|-------|----------|--------|
| `highRiskProcessingPower` thresholds | `SCANNER_BALANCE` | T3 hack PP rate |
| `rewardProcessingPower` | `PVP_BALANCE` | PVP PP rewards |
| Ice Breaker depth 3/4 rewards | `ICE_BREAKER_BALANCE` | PvE PP source |

### Processing Power (Drains)
| Lever | Location | Impact |
|-------|----------|--------|
| `MUTATION_COST.processingPower` (95) | `mutations.ts` | Main PP sink |
| Daemon crafting PP costs | `DAEMON_FORGE` | Secondary PP sink |

### Data (Faucets)
| Lever | Location | Impact |
|-------|----------|--------|
| `dataBase` + `dataPerSecurity` | `SCANNER_BALANCE.rewards` | All hack data income |
| `PASSIVE_DATA_PER_HOUR` (3) | `passive.ts` | Offline baseline |

### Data (Drains)
| Lever | Location | Impact |
|-------|----------|--------|
| Module `costPerLevel.data` | `ALL_MODULES` | Proportional to level progression |
| `MUTATION_COST.data` (220) | `mutations.ts` | High-end data sink |
| Data vault data costs | `DATA_VAULT_PROTOCOLS` | Daily drain (35–45d/use) |

---

## POTENTIAL ISSUES TO INVESTIGATE

1. **Module cost comment mismatch**: Comment says "~320–400c to reach L5 for basic" but actual formula yields ~2,300c. Either the comment is stale from a previous balance pass or the formula was changed. Verify which is intended.

2. **Repair scaling at high levels**: At level 20, a 50HP repair costs 92c vs 32c at level 1. If high-level players spend most time at T3 (getting hit frequently), repair costs could become oppressive. The simulation guardrail (50% repair ratio) should catch this, but worth checking actual simulation output.

3. **PP scarcity for PvE-only players**: cautious_pve has no PVP and gets PP only from T3 hacks (needs score ≥75% AND security ≥65) and Ice Breaker depths 3–4. This may bottleneck mutations for casual players. The day-14 mutation guardrail helps, but only for the first mutation.

4. **Data vault data cost**: Each use costs 35–45 data. At 2 uses/day = 70–90d/day drained, vs passive income of 72d/day. Heavy vault users may be data-negative from passive alone — they must hack to sustain vault usage. This may be intentional.

5. **Idle logger viability**: At 1h/day with 3 hacks/hour and no IB/vault, this archetype may have almost zero PP income. If mutations are required for meaningful progression, idle players may be permanently locked out of that system.

6. **Post-completion economy**: Once modules are maxed (marathon grinder, day 55+), the only recurring sinks are repairs and daemon crafting. The implied 400c/day surplus cap suggests this is manageable, but there's no explicit new sink introduced at that point.

---

## KEY FILES

| File | Purpose |
|------|---------|
| `packages/shared/src/constants/balance.ts` | SCANNER_BALANCE, REPAIR_BALANCE, PVP_BALANCE, DECISION_BALANCE |
| `packages/shared/src/constants/modules.ts` | All 36 module definitions with costs |
| `packages/shared/src/constants/passive.ts` | Passive income rates and caps |
| `packages/shared/src/constants/mutations.ts` | Mutation cost and success rate |
| `packages/shared/src/constants/daemonForge.ts` | Daemon craft costs and rewards |
| `packages/shared/src/constants/dataVault.ts` | Vault protocol costs |
| `packages/shared/src/constants/iceBreaker.ts` | IB reward table |
| `packages/shared/src/constants/game.ts` | Energy system constants |
| `packages/server/src/simulations/economySimulation.ts` | 7-day archetype simulation with guardrails |
| `packages/server/src/simulations/inflationAnalysis.ts` | 90-day full-season inflation tracking |
| `packages/server/src/simulations/progressionSimulation.ts` | Level progression pacing |
