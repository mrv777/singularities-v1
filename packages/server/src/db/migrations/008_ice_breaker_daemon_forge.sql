-- ICE Breaker logs (run history, rewards are finalized at extract/fail)
CREATE TABLE IF NOT EXISTS ice_breaker_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  layers_attempted INT NOT NULL DEFAULT 0,
  layers_cleared INT NOT NULL DEFAULT 0,
  extracted BOOLEAN NOT NULL DEFAULT FALSE,
  credits_earned INT NOT NULL DEFAULT 0,
  data_earned INT NOT NULL DEFAULT 0,
  xp_earned INT NOT NULL DEFAULT 0,
  processing_power_earned INT NOT NULL DEFAULT 0,
  system_damage JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ice_breaker_logs_player ON ice_breaker_logs(player_id);

-- Daemon Forge: player-owned daemons
CREATE TABLE IF NOT EXISTS player_daemons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  daemon_type TEXT NOT NULL,
  durability_remaining INT NOT NULL,
  mission_duration INT,
  deployed_at TIMESTAMPTZ,
  completes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_daemons_player ON player_daemons(player_id);
CREATE INDEX IF NOT EXISTS idx_player_daemons_active ON player_daemons(player_id, completes_at)
  WHERE completes_at IS NOT NULL;
