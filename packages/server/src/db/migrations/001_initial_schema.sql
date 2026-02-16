-- Migration: 001_initial_schema
-- Description: Create all initial game tables

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Seasons (referenced by players)
CREATE TABLE seasons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  meta_modules JSONB
);

-- Players
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(44) UNIQUE NOT NULL,
  mint_address VARCHAR(44) UNIQUE,
  ai_name VARCHAR(32) NOT NULL,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  credits INTEGER DEFAULT 0,
  energy INTEGER DEFAULT 100,
  energy_max INTEGER DEFAULT 100,
  processing_power INTEGER DEFAULT 0,
  data INTEGER DEFAULT 0,
  reputation INTEGER DEFAULT 0,
  alignment FLOAT DEFAULT 0.0,
  heat_level INTEGER DEFAULT 0,
  is_alive BOOLEAN DEFAULT true,
  is_in_sandbox BOOLEAN DEFAULT true,
  in_pvp_arena BOOLEAN DEFAULT false,
  energy_updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  season_id INTEGER REFERENCES seasons(id)
);

-- Player subsystems (6 per player)
CREATE TABLE player_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  system_type VARCHAR(32) NOT NULL,
  health INTEGER DEFAULT 100,
  status VARCHAR(16) DEFAULT 'OPTIMAL',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, system_type)
);

-- Purchased modules
CREATE TABLE player_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  module_id VARCHAR(64) NOT NULL,
  level INTEGER DEFAULT 1,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, module_id)
);

-- Attack and defense loadouts
CREATE TABLE player_loadouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  loadout_type VARCHAR(16) NOT NULL,
  slot INTEGER NOT NULL,
  module_id VARCHAR(64),
  UNIQUE(player_id, loadout_type, slot)
);

-- Automation scripts
CREATE TABLE player_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  trigger_condition VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Genetic traits
CREATE TABLE player_traits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  trait_id VARCHAR(64) NOT NULL,
  UNIQUE(player_id, trait_id)
);

-- Combat logs
CREATE TABLE combat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_id UUID REFERENCES players(id),
  defender_id UUID REFERENCES players(id),
  attacker_loadout JSONB NOT NULL,
  defender_loadout JSONB NOT NULL,
  result VARCHAR(16) NOT NULL,
  damage_dealt JSONB,
  credits_transferred INTEGER DEFAULT 0,
  reputation_change INTEGER DEFAULT 0,
  combat_log JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Infiltration logs
CREATE TABLE infiltration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  target_type VARCHAR(32) NOT NULL,
  security_level INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  detected BOOLEAN DEFAULT false,
  credits_earned INTEGER DEFAULT 0,
  reputation_earned INTEGER DEFAULT 0,
  damage_taken JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily modifiers
CREATE TABLE daily_modifiers (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  modifier_id VARCHAR(64) NOT NULL,
  modifier_data JSONB NOT NULL
);

-- Binary decisions
CREATE TABLE player_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  decision_id VARCHAR(64) NOT NULL,
  choice VARCHAR(16) NOT NULL,
  effects JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, decision_id)
);

-- Auth nonces (for wallet signature verification)
CREATE TABLE auth_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(44) NOT NULL,
  nonce VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_players_wallet ON players(wallet_address);
CREATE INDEX idx_players_season ON players(season_id);
CREATE INDEX idx_player_systems_player ON player_systems(player_id);
CREATE INDEX idx_player_modules_player ON player_modules(player_id);
CREATE INDEX idx_combat_logs_attacker ON combat_logs(attacker_id);
CREATE INDEX idx_combat_logs_defender ON combat_logs(defender_id);
CREATE INDEX idx_infiltration_logs_player ON infiltration_logs(player_id);
CREATE INDEX idx_auth_nonces_wallet ON auth_nonces(wallet_address);

-- Migrations tracking table
CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
