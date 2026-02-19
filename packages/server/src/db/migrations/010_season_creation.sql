-- Track whether a season was ended by an admin (don't auto-create next) vs naturally expired
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS admin_ended BOOLEAN DEFAULT false;

-- Prevent concurrent active seasons
CREATE UNIQUE INDEX IF NOT EXISTS seasons_one_active ON seasons (is_active) WHERE is_active = true;
