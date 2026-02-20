-- Migration: 011_schema_fixes
-- Fix FK ON DELETE behavior, add unique constraint on weekly_topologies,
-- add infiltration_logs composite index, and add CHECK constraints.

BEGIN;

-- -------------------------------------------------------------------------
-- 1. Fix ON DELETE for combat_logs
-- -------------------------------------------------------------------------
ALTER TABLE combat_logs
  DROP CONSTRAINT combat_logs_attacker_id_fkey,
  DROP CONSTRAINT combat_logs_defender_id_fkey;

ALTER TABLE combat_logs
  ADD CONSTRAINT combat_logs_attacker_id_fkey
    FOREIGN KEY (attacker_id) REFERENCES players(id) ON DELETE SET NULL,
  ADD CONSTRAINT combat_logs_defender_id_fkey
    FOREIGN KEY (defender_id) REFERENCES players(id) ON DELETE SET NULL;

-- -------------------------------------------------------------------------
-- 2. Fix ON DELETE for infiltration_logs
-- -------------------------------------------------------------------------
ALTER TABLE infiltration_logs
  DROP CONSTRAINT infiltration_logs_player_id_fkey;

ALTER TABLE infiltration_logs
  ADD CONSTRAINT infiltration_logs_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL;

-- -------------------------------------------------------------------------
-- 3. Fix ON DELETE for season_winners
-- -------------------------------------------------------------------------
ALTER TABLE season_winners
  DROP CONSTRAINT season_winners_player_id_fkey;

ALTER TABLE season_winners
  ADD CONSTRAINT season_winners_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL;

-- -------------------------------------------------------------------------
-- 4. Fix ON DELETE for admin_settings
-- -------------------------------------------------------------------------
ALTER TABLE admin_settings
  DROP CONSTRAINT admin_settings_updated_by_fkey;

ALTER TABLE admin_settings
  ADD CONSTRAINT admin_settings_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES players(id) ON DELETE SET NULL;

-- -------------------------------------------------------------------------
-- 5. Unique constraint on weekly_topologies week_start (replace plain index)
-- -------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_weekly_topologies_week;
CREATE UNIQUE INDEX idx_weekly_topologies_week ON weekly_topologies(week_start);

-- -------------------------------------------------------------------------
-- 6. Composite index on infiltration_logs for recent-activity queries
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_infiltration_logs_player_date
  ON infiltration_logs(player_id, created_at DESC);

-- -------------------------------------------------------------------------
-- 7. CHECK constraints
-- -------------------------------------------------------------------------
ALTER TABLE players
  ADD CONSTRAINT chk_players_alignment
    CHECK (alignment BETWEEN -1.0 AND 1.0);

ALTER TABLE player_systems
  ADD CONSTRAINT chk_player_systems_health
    CHECK (health BETWEEN 0 AND 100),
  ADD CONSTRAINT chk_player_systems_status
    CHECK (status IN ('OPTIMAL', 'DEGRADED', 'CRITICAL', 'CORRUPTED'));

ALTER TABLE player_loadouts
  ADD CONSTRAINT chk_player_loadouts_slot
    CHECK (slot IN (1, 2, 3));

ALTER TABLE player_decisions
  ADD CONSTRAINT chk_player_decisions_choice
    CHECK (choice IN ('yes', 'no'));

COMMIT;
