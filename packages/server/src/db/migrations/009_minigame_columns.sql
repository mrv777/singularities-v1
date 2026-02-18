-- Add mini-game tracking columns to infiltration_logs
ALTER TABLE infiltration_logs ADD COLUMN IF NOT EXISTS game_type TEXT;
ALTER TABLE infiltration_logs ADD COLUMN IF NOT EXISTS score INT;
ALTER TABLE infiltration_logs ADD COLUMN IF NOT EXISTS moves_count INT;
ALTER TABLE infiltration_logs ADD COLUMN IF NOT EXISTS game_duration_ms INT;
