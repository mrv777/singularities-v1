-- Pending mints (prevent double-mint, store tx for confirmation)
CREATE TABLE IF NOT EXISTS pending_mints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) UNIQUE,
  mint_address VARCHAR(44) NOT NULL,
  serialized_tx TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pending burns (retry queue for failed burns)
CREATE TABLE IF NOT EXISTS pending_nft_burns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id),
  mint_address VARCHAR(44) NOT NULL,
  retry_count INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pending_burns_retry ON pending_nft_burns(retry_count, last_attempt_at);
