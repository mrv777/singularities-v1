import { acquireLock, releaseLock } from "../lock.js";

const LOCK_KEY = "worker:nft_transfer_check";
const LOCK_TTL = 60_000; // 1 min

/**
 * Stub implementation for NFT transfer detection.
 * TODO: When real minting is added, implement Solana RPC polling
 * (getAccountInfo on token accounts). If owner changed:
 *   - Update wallet_address on the player
 *   - Set adaptation_period_until = NOW() + 48h
 */
export async function runNftTransferCheck(): Promise<void> {
  const token = await acquireLock(LOCK_KEY, LOCK_TTL);
  if (!token) return;

  try {
    // Stub: no-op until real minting is implemented
    // When real minting:
    // 1. Query all players with mint_address != null
    // 2. For each, check Solana token account owner via RPC
    // 3. If owner differs from stored wallet_address:
    //    - UPDATE players SET wallet_address = newOwner, adaptation_period_until = NOW() + INTERVAL '48 hours'
    //    - Log the transfer
  } finally {
    await releaseLock(LOCK_KEY, token);
  }
}
