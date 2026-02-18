# Simulation Audit - 2026-02-18 (Post-Patch)

## Balance Patch Applied

- Energy pacing:
  - `ENERGY_BASE_MAX`: `130`
  - `ENERGY_BASE_REGEN_PER_HOUR`: `360`
  - `ENERGY_REGEN_PER_LEVEL`: `8`
  - `ENERGY_MAX_PER_LEVEL`: `7`
  - `SCAN_ENERGY_COST`: `5`
  - `PVP_ENERGY_COST`: `17`
- Progression pacing:
  - XP thresholds moved to a slower curve (about 1.5x prior values).
- Catch-up tuning:
  - `xpMultiplierPerLevelBehind`: `0.35`
  - `lateJoinMaxXpBoost`: `2.4`
- Mutation gating (to avoid cautious-PvE soft lock):
  - `MUTATION_COST`: `500 credits`, `220 data`, `95 processingPower`

## Full Simulation Census (400 runs, seed 1337)

- Passed:
  - `sim:progression`
  - `sim:economy`
  - `sim:day1`
  - `sim:bots`
  - `sim:health`
  - `sim:newplayer`
  - `sim:energy`
  - `sim:pvp`
  - `sim:modules`
  - `sim:death`
  - `sim:decisions`
  - `sim:modifiers`
  - `sim:catchup`
  - `sim:endgame`
  - `sim:exploits`
- Remaining caveat:
  - `sim:worldEvents` default 7-day run still occasionally misses the 25-player hack-surge floor.
  - 30-day runs pass consistently for that check.

## Day 1 / Day 30 / Day 90 Readout

### Day 1

- `sim:day1`:
  - Level at 30m p50: `4`
  - Level at 60m p50: `6`
- `sim:newplayer`:
  - first-5-all-fail: `9.0%`
  - time to first success p90: `1.5 min`
  - time to first module purchase p90: `68.7 min`
  - feature/progression gap p90: `72.1 min`
- `sim:energy`:
  - 30-min actions: level1 `61`, level10 `81`, level25 `100`
  - 30-min downtime: level1 `39.0%`, level10 `19.5%`, level25 `0.0%`

### Day 30

- `sim:economy` (current profile, data-vault on):
  - conservative inflation ceiling: PASS (`max net=156.6 c/hr`, limit `<=165`)
  - cautious PvE mutation readiness: PASS (`avg day 11.3`)
  - all archetypes net-positive: PASS
- `sim:pvp`: fairness and EV checks all PASS.
- `sim:decisions`: parity and cadence checks PASS.
- `sim:worldEvents --days=30`: 25-player and 50-player cadence checks PASS.

### Day 90

- `sim:progression`:
  - Level 9 p50: `2.4 days`
  - Level 25 p50: `19.4 days`
  - final level p50 at day 90: `25`
  - cap-rush guardrail: PASS (not too early)
- `sim:catchup`:
  - day30 joiner to 80% median: `36 days` p50 (PASS, target <=40)
  - day60 joiner season-end level: `11` p50 (PASS, target >=9)
- `sim:endgame`:
  - 30-day credit accumulation at max level: `4737` (PASS, target <=7000)
- `sim:exploits`: anti-exploit guardrails all PASS.

## Direct Answer to "Never Limited" Feeling

The pre-patch feeling was real. Post-patch, pressure is materially higher:

- session throughput and downtime now vary by level instead of being near-zero friction across the board.
- progression is no longer week-2 cap-rush; cap timing moved to around week 3 for 2h/day median.
- cautious players remain viable and not soft-locked on mutation progression.

## External Research Used

- https://www.adjust.com/resources/guides/user-retention-rates/
- https://www.adjust.com/glossary/retention-rate/
- https://www.adjust.com/resources/reports/gaming-app-insights-report/
- https://www.appsflyer.com/resources/reports/app-marketing-state-of-gaming-app-report/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC6995957/
- https://academic.oup.com/jcmc/article/29/6/zmae019/7758801
- https://dl.acm.org/doi/10.1145/1077246.1077253
