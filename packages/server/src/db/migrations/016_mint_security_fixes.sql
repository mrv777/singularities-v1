-- Add columns to pending_mints for tx validation and correct confirmation
ALTER TABLE pending_mints
  ADD COLUMN IF NOT EXISTS mint_price_lamports BIGINT,
  ADD COLUMN IF NOT EXISTS last_valid_block_height BIGINT;
