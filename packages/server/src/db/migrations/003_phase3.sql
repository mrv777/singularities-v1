-- Phase 3: PvP Combat, Death/Rebirth, Security Center

-- Wallet carryovers for death/rebirth
CREATE TABLE IF NOT EXISTS wallet_carryovers (
  wallet_address VARCHAR(44) PRIMARY KEY,
  guaranteed_module_id VARCHAR(64),
  recovered_modules JSONB DEFAULT '[]',
  deaths_count INTEGER DEFAULT 1,
  last_death_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add adaptation period to players (for NFT transfer cooldown)
ALTER TABLE players ADD COLUMN IF NOT EXISTS adaptation_period_until TIMESTAMPTZ;

-- Add XP reward tracking for combat logs
ALTER TABLE combat_logs ADD COLUMN IF NOT EXISTS xp_awarded INTEGER DEFAULT 0;

-- Index for arena queries (finding available opponents)
CREATE INDEX IF NOT EXISTS idx_players_arena ON players(in_pvp_arena, is_alive, is_in_sandbox, level);

-- Index for combat logs date filtering
CREATE INDEX IF NOT EXISTS idx_combat_logs_created ON combat_logs(created_at);

-- Composite indexes for combat log queries (single-column versions exist in 001)
CREATE INDEX IF NOT EXISTS idx_combat_logs_attacker_date ON combat_logs(attacker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_combat_logs_defender_date ON combat_logs(defender_id, created_at DESC);
