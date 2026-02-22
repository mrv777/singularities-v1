-- Login streak columns for daily login reward tracking
ALTER TABLE players ADD COLUMN IF NOT EXISTS login_streak INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_streak_date DATE;
