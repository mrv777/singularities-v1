import { acquireLock, releaseLock } from "../lock.js";
import { query } from "../../db/pool.js";
import { checkAssetOwner, retryPendingBurns } from "../../services/nft.js";

const LOCK_KEY = "worker:nft_transfer_check";
const LOCK_TTL = 120_000; // 2 min (real RPC calls take time)

/**
 * Check all live players' NFTs for ownership transfers.
 * Also retries any pending burns that previously failed.
 */
export async function runNftTransferCheck(): Promise<void> {
  const token = await acquireLock(LOCK_KEY, LOCK_TTL);
  if (!token) return;

  try {
    // 1. Check for NFT transfers
    const players = await query(
      `SELECT id, wallet_address, mint_address FROM players
       WHERE is_alive = true AND mint_address IS NOT NULL AND mint_address NOT LIKE 'mock_mint_%'`
    );

    for (const row of players.rows) {
      const playerId = row.id as string;
      const storedWallet = row.wallet_address as string;
      const mintAddress = row.mint_address as string;

      try {
        const currentOwner = await checkAssetOwner(mintAddress);
        if (!currentOwner) continue; // asset may have been burned or not found

        if (currentOwner !== storedWallet) {
          await query(
            `UPDATE players
             SET wallet_address = $2,
                 adaptation_period_until = NOW() + INTERVAL '48 hours'
             WHERE id = $1`,
            [playerId, currentOwner]
          );
          console.log(
            `[nft-transfer] Player ${playerId}: wallet updated ${storedWallet} → ${currentOwner}`
          );
        }
      } catch (err) {
        console.error(`[nft-transfer] Failed to check ${mintAddress}:`, err);
      }
    }

    // 2. Retry pending burns
    await retryPendingBurns();
  } finally {
    await releaseLock(LOCK_KEY, token);
  }
}
