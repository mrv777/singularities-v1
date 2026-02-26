-- Track whether a season's carryover has been consumed by a successor
ALTER TABLE season_reward_pool
  ADD COLUMN IF NOT EXISTS carryover_applied BOOLEAN NOT NULL DEFAULT false;

-- Dedupe burn queue (makes ON CONFLICT DO NOTHING actually work)
ALTER TABLE pending_nft_burns
  ADD CONSTRAINT uq_pending_burns_mint_address UNIQUE (mint_address);
