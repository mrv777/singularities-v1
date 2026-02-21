# Quantum Lab + Data Vault Plan

## Decision Summary
- Ship `Data Vault` now as a low-complexity node with deterministic outcomes.
- Delay `Quantum Lab` to post-sandbox (`level 9`) and keep it disabled (`coming soon`).

This keeps first-session depth high without forcing players to learn two new strategic systems at once.

## Unlock Timing
- `data_vault`: level 7
- `quantum_lab`: level 9 (deferred)

## Data Vault (Implemented)

### Core loop
1. Open Data Vault.
2. Pick one protocol.
3. Pay clear costs (`credits` + `data`).
4. Receive immediate timed buff.

### Guardrails
- Deterministic outputs (no hidden fail chance).
- One active protocol at a time.
- 10-minute cooldown between activations.
- Daily use cap: 2.

### Protocols
- `Focus Cache` (recommended)
  - Cost: 20 credits, 40 data
  - Duration: 20m
  - Effect: +8 hack power
- `Ghost Cache`
  - Cost: 15 credits, 35 data
  - Duration: 20m
  - Effects: +20 stealth

### Why this shape
- Clear sink for excess day-1/day-2 data.
- Strong session-level agency without spreadsheet overhead.
- Keeps choice count small while still offering playstyle variation.

## Quantum Lab (Deferred)

### Current state
- Node stays visible but locked/disabled.
- Unlock level moved to 9 so it does not compete with scanner + tech tree + scripts onboarding.

### Revisit criteria
Only ship when one of these is true:
- Day-1 retention and session depth are stable and we need deeper midgame planning.
- Data Vault usage saturates and players request more strategic spend options.

## Simulation Verification Targets
- Day-1 (30-60m): players should still level multiple times and unlock additional systems.
- Hook quality: early hack success should improve or hold.
- Economy safety: no runaway credit inflation from the new node.

## Next Option (if needed)
If we need more depth later without overload:
1. Add one `Quantum Lab Lite` action only.
2. Keep deterministic output.
3. Reuse same cooldown/cap pattern as Data Vault.
