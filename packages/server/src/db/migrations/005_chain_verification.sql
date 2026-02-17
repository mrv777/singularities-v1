-- Add on-chain verification columns to infiltration_logs
ALTER TABLE infiltration_logs
  ADD COLUMN chain_verified BOOLEAN DEFAULT false,
  ADD COLUMN tx_signature TEXT DEFAULT NULL;
