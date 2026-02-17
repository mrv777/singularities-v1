-- Phase 6: Arena simulated-opponent support
ALTER TABLE combat_logs
  ADD COLUMN IF NOT EXISTS is_bot_match BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bot_profile JSONB;

CREATE INDEX IF NOT EXISTS idx_combat_logs_bot_match_date
  ON combat_logs(is_bot_match, created_at DESC);
