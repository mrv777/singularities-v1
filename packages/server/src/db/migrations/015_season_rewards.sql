-- Season reward pool: one row per season tracking mint revenue and payout state
CREATE TABLE IF NOT EXISTS season_reward_pool (
  id SERIAL PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES seasons(id) UNIQUE,
  total_mint_revenue_lamports BIGINT NOT NULL DEFAULT 0,
  pool_lamports BIGINT NOT NULL DEFAULT 0,
  carryover_lamports BIGINT NOT NULL DEFAULT 0,
  paid_out BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Season payouts: one row per winner payout (rank 1-3)
CREATE TABLE IF NOT EXISTS season_payouts (
  id SERIAL PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES seasons(id),
  rank SMALLINT NOT NULL CHECK (rank BETWEEN 1 AND 3),
  player_id UUID NOT NULL REFERENCES players(id),
  wallet_address VARCHAR(44) NOT NULL,
  amount_lamports BIGINT NOT NULL,
  tx_signature VARCHAR(128),
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_season_payouts_season ON season_payouts(season_id);
CREATE INDEX IF NOT EXISTS idx_season_payouts_status ON season_payouts(status);
