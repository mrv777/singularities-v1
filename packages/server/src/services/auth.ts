import { randomBytes } from "node:crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { query } from "../db/pool.js";
import { SYSTEM_TYPES } from "@singularities/shared";
import { mapPlayerRow, computeEnergy } from "./player.js";
import { getCurrentSeason } from "./seasons.js";

const NONCE_EXPIRY_MINUTES = 5;

export async function createChallenge(walletAddress: string) {
  const nonce = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + NONCE_EXPIRY_MINUTES * 60 * 1000);

  // Clean up old nonces for this wallet
  await query("DELETE FROM auth_nonces WHERE wallet_address = $1", [
    walletAddress,
  ]);

  await query(
    "INSERT INTO auth_nonces (wallet_address, nonce, expires_at) VALUES ($1, $2, $3)",
    [walletAddress, nonce, expiresAt]
  );

  const message = `Sign this message to authenticate with Singularities.\n\nNonce: ${nonce}`;
  return { nonce, message };
}

export async function verifySignature(
  walletAddress: string,
  signature: string,
  nonce: string
): Promise<boolean> {
  // Check nonce exists and is not expired
  const result = await query<{ id: string }>(
    "SELECT id FROM auth_nonces WHERE wallet_address = $1 AND nonce = $2 AND expires_at > NOW()",
    [walletAddress, nonce]
  );

  if (result.rows.length === 0) return false;

  // Verify signature BEFORE deleting the nonce — if verification fails,
  // the nonce stays valid so the user can retry with a correct signature
  const message = `Sign this message to authenticate with Singularities.\n\nNonce: ${nonce}`;
  const messageBytes = new TextEncoder().encode(message);

  let signatureBytes: Uint8Array;
  let publicKeyBytes: Uint8Array;
  try {
    signatureBytes = bs58.decode(signature);
    publicKeyBytes = bs58.decode(walletAddress);
  } catch {
    return false;
  }

  const valid = nacl.sign.detached.verify(
    messageBytes,
    signatureBytes,
    publicKeyBytes
  );

  // Only consume the nonce on successful verification
  if (valid) {
    await query("DELETE FROM auth_nonces WHERE wallet_address = $1", [
      walletAddress,
    ]);
  }

  return valid;
}

export async function findOrCreatePlayer(walletAddress: string) {
  const aiName = `AI-${walletAddress.slice(0, 6).toUpperCase()}`;

  // Get current season so new players join it immediately
  const season = await getCurrentSeason();
  const seasonId = season?.id ?? null;

  // Atomic upsert: INSERT or no-op if already exists
  const inserted = await query<{ id: string }>(
    `INSERT INTO players (wallet_address, ai_name, season_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (wallet_address) DO NOTHING
     RETURNING id`,
    [walletAddress, aiName, seasonId]
  );

  // Always SELECT the final state (works for both new and existing)
  const result = await query(
    "SELECT * FROM players WHERE wallet_address = $1",
    [walletAddress]
  );

  // Idempotent: ensure all 6 systems exist for this player (backfills existing players too)
  const playerId = result.rows[0].id;
  const values = SYSTEM_TYPES.map((_, i) => `($1, $${i + 2})`).join(", ");
  await query(
    `INSERT INTO player_systems (player_id, system_type) VALUES ${values}
     ON CONFLICT (player_id, system_type) DO NOTHING`,
    [playerId, ...SYSTEM_TYPES]
  );

  return mapPlayerRow(computeEnergy(result.rows[0]));
}
