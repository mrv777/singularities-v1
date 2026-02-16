-- Phase 2: Game Systems
-- Script execution logs, indexes for daily_modifiers and active scripts

-- Script execution logs
CREATE TABLE IF NOT EXISTS script_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  script_id UUID REFERENCES player_scripts(id) ON DELETE SET NULL,
  trigger_condition VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  success BOOLEAN DEFAULT true,
  credits_earned INTEGER DEFAULT 0,
  data_earned INTEGER DEFAULT 0,
  energy_spent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_script_logs_player ON script_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_daily_modifiers_date ON daily_modifiers(date);
CREATE INDEX IF NOT EXISTS idx_player_scripts_active ON player_scripts(is_active) WHERE is_active = true;
