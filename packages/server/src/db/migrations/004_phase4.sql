-- Migration: 004_phase4
-- Description: Phase 4 — World Systems (topology, decisions, alignment, world events, mutations, seasons)

-- Weekly topology configurations
CREATE TABLE IF NOT EXISTS weekly_topologies (
  id SERIAL PRIMARY KEY,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  node_positions JSONB,
  boosted_node VARCHAR(64),
  boost_effect JSONB,
  hindered_node VARCHAR(64),
  hindrance_effect JSONB,
  special_node JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- World events from aggregate behavior
CREATE TABLE IF NOT EXISTS world_events (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  trigger_data JSONB,
  effect_data JSONB,
  narrative TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Season winners archive
CREATE TABLE IF NOT EXISTS season_winners (
  id SERIAL PRIMARY KEY,
  season_id INTEGER REFERENCES seasons(id),
  player_id UUID REFERENCES players(id),
  reputation INTEGER NOT NULL,
  trophy_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pending binary decisions (not yet resolved)
CREATE TABLE IF NOT EXISTS pending_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  decision_id VARCHAR(64) NOT NULL,
  triggered_by VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, decision_id)
);

-- player_modules: add mutation column
ALTER TABLE player_modules ADD COLUMN IF NOT EXISTS mutation VARCHAR(64) NULL;

-- seasons: add catch_up_config
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS catch_up_config JSONB;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weekly_topologies_week ON weekly_topologies(week_start);
CREATE INDEX IF NOT EXISTS idx_world_events_date ON world_events(date);
CREATE INDEX IF NOT EXISTS idx_pending_decisions_player ON pending_decisions(player_id);
CREATE INDEX IF NOT EXISTS idx_season_winners_season ON season_winners(season_id);
