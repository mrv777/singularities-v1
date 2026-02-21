-- Migration: 012_tutorial
-- Add tutorial_step column to players for onboarding flow tracking.
-- Default 'done' so existing players are unaffected; registration sets 'boot'.

BEGIN;

ALTER TABLE players ADD COLUMN IF NOT EXISTS tutorial_step VARCHAR(32) DEFAULT 'done';

COMMIT;
