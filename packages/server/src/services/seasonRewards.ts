import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { query, withTransaction } from "../db/pool.js";
import { env } from "../lib/env.js";
import {
  SEASON_REWARD_POOL_SHARE,
  SEASON_PAYOUT_SHARE,
  SEASON_CARRYOVER_SHARE,
  SEASON_PRIZE_SPLITS,
} from "@singularities/shared";
import { getCurrentSeason } from "./seasons.js";
import { acquireLock, releaseLock } from "../worker/lock.js";

// ---------------------------------------------------------------------------
// Solana helpers (reuse same lazy-singleton pattern from nft.ts)
// ---------------------------------------------------------------------------

let serverKeypair: Keypair | null = null;
let connection: Connection | null = null;

function getServerKeypair(): Keypair {
  if (!serverKeypair) {
    const raw = JSON.parse(readFileSync(env.SERVER_KEYPAIR_PATH, "utf-8"));
    serverKeypair = Keypair.fromSecretKey(Uint8Array.from(raw));
  }
  return serverKeypair;
}

function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
  }
  return connection;
}

// ---------------------------------------------------------------------------
// Record mint revenue into the season reward pool
// ---------------------------------------------------------------------------

export async function recordMintRevenue(lamports: number): Promise<void> {
  const season = await getCurrentSeason();
  if (!season) return;

  const poolAmount = Math.floor(lamports * SEASON_REWARD_POOL_SHARE);

  await query(
    `INSERT INTO season_reward_pool (season_id, total_mint_revenue_lamports, pool_lamports)
     VALUES ($1, $2, $3)
     ON CONFLICT (season_id) DO UPDATE
       SET total_mint_revenue_lamports = season_reward_pool.total_mint_revenue_lamports + $2,
           pool_lamports = season_reward_pool.carryover_lamports
             + (season_reward_pool.total_mint_revenue_lamports + $2) * $4,
           updated_at = NOW()`,
    [season.id, lamports, poolAmount, SEASON_REWARD_POOL_SHARE]
  );
}

// ---------------------------------------------------------------------------
// Get reward summary for admin review
// ---------------------------------------------------------------------------

export interface RewardSummary {
  seasonId: number;
  totalMintRevenueLamports: number;
  poolLamports: number;
  carryoverLamports: number;
  paidOut: boolean;
  payableAmount: number; // pool * SEASON_PAYOUT_SHARE
  nextSeasonCarryover: number; // pool * SEASON_CARRYOVER_SHARE
  prizeSplits: { rank: number; lamports: number }[];
  existingPayouts: {
    rank: number;
    playerId: string;
    wallet: string;
    amountLamports: number;
    status: string;
    txSignature: string | null;
  }[];
}

export async function getRewardSummary(
  seasonId: number
): Promise<RewardSummary | null> {
  const poolRes = await query(
    "SELECT * FROM season_reward_pool WHERE season_id = $1",
    [seasonId]
  );
  if (poolRes.rows.length === 0) return null;

  const row = poolRes.rows[0];
  const poolLamports = Number(row.pool_lamports);
  const payableAmount = Math.floor(poolLamports * SEASON_PAYOUT_SHARE);

  const prizeSplits = SEASON_PRIZE_SPLITS.map((split, i) => ({
    rank: i + 1,
    lamports: Math.floor(payableAmount * split),
  }));

  const payoutsRes = await query(
    "SELECT * FROM season_payouts WHERE season_id = $1 ORDER BY rank",
    [seasonId]
  );

  return {
    seasonId,
    totalMintRevenueLamports: Number(row.total_mint_revenue_lamports),
    poolLamports,
    carryoverLamports: Number(row.carryover_lamports),
    paidOut: row.paid_out as boolean,
    payableAmount,
    nextSeasonCarryover: Math.floor(poolLamports * SEASON_CARRYOVER_SHARE),
    prizeSplits,
    existingPayouts: payoutsRes.rows.map((p) => ({
      rank: p.rank as number,
      playerId: p.player_id as string,
      wallet: p.wallet_address as string,
      amountLamports: Number(p.amount_lamports),
      status: p.status as string,
      txSignature: (p.tx_signature as string) || null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Execute payouts to top 3 winners
// ---------------------------------------------------------------------------

export async function executePayouts(seasonId: number): Promise<{
  payouts: { rank: number; wallet: string; lamports: number; txSignature: string | null; status: string }[];
  carryoverCreated: number;
}> {
  // Distributed lock prevents concurrent payout attempts
  const lockToken = await acquireLock(`season_payout:${seasonId}`, 120_000);
  if (!lockToken) throw new Error("Payout already in progress for this season");

  try {
    // Atomically check winners + mark as paid_out inside one transaction
    const { poolRow, winnersRows } = await withTransaction(async (client) => {
      const res = await client.query(
        "SELECT * FROM season_reward_pool WHERE season_id = $1 FOR UPDATE",
        [seasonId]
      );
      if (res.rows.length === 0) throw new Error("No reward pool found for this season");
      if (res.rows[0].paid_out as boolean) throw new Error("Payouts already executed for this season");

      // Check winners before committing paid_out — if none exist, rollback
      const wRes = await client.query(
        `SELECT sw.player_id, p.wallet_address,
                (sw.trophy_metadata->>'rank')::int as rank
         FROM season_winners sw
         JOIN players p ON p.id = sw.player_id
         WHERE sw.season_id = $1
         ORDER BY rank ASC
         LIMIT 3`,
        [seasonId]
      );
      if (wRes.rows.length === 0) {
        throw new Error("No season winners found — end the season first");
      }

      await client.query(
        "UPDATE season_reward_pool SET paid_out = true, updated_at = NOW() WHERE season_id = $1",
        [seasonId]
      );
      return { poolRow: res.rows[0], winnersRows: wRes.rows };
    });

    const poolLamports = Number(poolRow.pool_lamports);

    const conn = getConnection();
    const treasury = getServerKeypair();
    const payableAmount = Math.floor(poolLamports * SEASON_PAYOUT_SHARE);

    const payoutResults: {
      rank: number;
      wallet: string;
      lamports: number;
      txSignature: string | null;
      status: string;
    }[] = [];

    for (const winner of winnersRows) {
      const rank = winner.rank as number;
      const splitIndex = rank - 1;
      if (splitIndex >= SEASON_PRIZE_SPLITS.length) continue;

      const amountLamports = Math.floor(payableAmount * SEASON_PRIZE_SPLITS[splitIndex]);
      const wallet = winner.wallet_address as string;
      const playerId = winner.player_id as string;

      // Skip if already sent (idempotent on retry)
      const existingPayout = await query(
        "SELECT status FROM season_payouts WHERE season_id = $1 AND rank = $2",
        [seasonId, rank]
      );
      if (existingPayout.rows.length > 0 && existingPayout.rows[0].status === "sent") {
        payoutResults.push({ rank, wallet, lamports: amountLamports, txSignature: null, status: "sent" });
        continue;
      }

      let txSignature: string | null = null;
      let status = "pending";
      let errorMessage: string | null = null;

      try {
        txSignature = await sendSolTransfer(treasury, wallet, amountLamports, conn);
        status = "sent";
      } catch (err: any) {
        status = "failed";
        errorMessage = err.message?.slice(0, 500) ?? "Unknown error";
        console.error(`[seasonRewards] Payout failed for rank ${rank} (${wallet}):`, err);
      }

      await query(
        `INSERT INTO season_payouts (season_id, rank, player_id, wallet_address, amount_lamports, tx_signature, status, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (season_id, rank) DO UPDATE
           SET tx_signature = $6, status = $7, error_message = $8, updated_at = NOW()`,
        [seasonId, rank, playerId, wallet, amountLamports, txSignature, status, errorMessage]
      );

      payoutResults.push({ rank, wallet, lamports: amountLamports, txSignature, status });
    }

    // Create carryover for next season
    const carryoverAmount = Math.floor(poolLamports * SEASON_CARRYOVER_SHARE);

    const nextSeasonRes = await query(
      "SELECT id FROM seasons WHERE id > $1 ORDER BY id ASC LIMIT 1",
      [seasonId]
    );

    if (nextSeasonRes.rows.length > 0) {
      const nextSeasonId = nextSeasonRes.rows[0].id as number;
      await query(
        `INSERT INTO season_reward_pool (season_id, carryover_lamports, pool_lamports)
         VALUES ($1, $2, $2)
         ON CONFLICT (season_id) DO UPDATE
           SET carryover_lamports = $2,
               pool_lamports = season_reward_pool.total_mint_revenue_lamports * $3 + $2,
               updated_at = NOW()`,
        [nextSeasonId, carryoverAmount, SEASON_REWARD_POOL_SHARE]
      );
      // Mark source season's carryover as consumed
      await query(
        "UPDATE season_reward_pool SET carryover_applied = true WHERE season_id = $1",
        [seasonId]
      );
    }
    // If no next season yet, carryover will be applied when createSeason seeds the pool

    return { payouts: payoutResults, carryoverCreated: carryoverAmount };
  } finally {
    await releaseLock(`season_payout:${seasonId}`, lockToken);
  }
}

// ---------------------------------------------------------------------------
// Retry failed payouts
// ---------------------------------------------------------------------------

export async function retryFailedPayouts(seasonId: number): Promise<{
  retried: { rank: number; wallet: string; txSignature: string | null; status: string }[];
}> {
  const lockToken = await acquireLock(`season_payout:${seasonId}`, 120_000);
  if (!lockToken) throw new Error("Payout already in progress for this season");

  try {
    const failedRes = await query(
      "SELECT * FROM season_payouts WHERE season_id = $1 AND status = 'failed' ORDER BY rank",
      [seasonId]
    );

    if (failedRes.rows.length === 0) {
      return { retried: [] };
    }

    const conn = getConnection();
    const treasury = getServerKeypair();
    const retried: { rank: number; wallet: string; txSignature: string | null; status: string }[] = [];

    for (const row of failedRes.rows) {
      const rank = row.rank as number;
      const wallet = row.wallet_address as string;
      const amountLamports = Number(row.amount_lamports);

      let txSignature: string | null = null;
      let status = "failed";
      let errorMessage: string | null = null;

      try {
        txSignature = await sendSolTransfer(treasury, wallet, amountLamports, conn);
        status = "sent";
      } catch (err: any) {
        errorMessage = err.message?.slice(0, 500) ?? "Unknown error";
        console.error(`[seasonRewards] Retry failed for rank ${rank} (${wallet}):`, err);
      }

      await query(
        `UPDATE season_payouts
         SET tx_signature = $2, status = $3, error_message = $4, updated_at = NOW()
         WHERE season_id = $1 AND rank = $5`,
        [seasonId, txSignature, status, errorMessage, rank]
      );

      retried.push({ rank, wallet, txSignature, status });
    }

    return { retried };
  } finally {
    await releaseLock(`season_payout:${seasonId}`, lockToken);
  }
}

// ---------------------------------------------------------------------------
// Get pool info for public display
// ---------------------------------------------------------------------------

export async function getPublicPoolInfo(
  seasonId: number
): Promise<{ poolLamports: number; carryoverLamports: number } | null> {
  const res = await query(
    "SELECT pool_lamports, carryover_lamports FROM season_reward_pool WHERE season_id = $1",
    [seasonId]
  );
  if (res.rows.length === 0) return null;
  return {
    poolLamports: Number(res.rows[0].pool_lamports),
    carryoverLamports: Number(res.rows[0].carryover_lamports),
  };
}

// ---------------------------------------------------------------------------
// SOL transfer helper
// ---------------------------------------------------------------------------

async function sendSolTransfer(
  fromKeypair: Keypair,
  toWallet: string,
  lamports: number,
  conn: Connection
): Promise<string> {
  const toPubkey = new PublicKey(toWallet);
  const transferIx = SystemProgram.transfer({
    fromPubkey: fromKeypair.publicKey,
    toPubkey,
    lamports,
  });

  const { blockhash, lastValidBlockHeight } =
    await conn.getLatestBlockhash("confirmed");

  const message = new TransactionMessage({
    payerKey: fromKeypair.publicKey,
    recentBlockhash: blockhash,
    instructions: [transferIx],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([fromKeypair]);

  const sig = await conn.sendTransaction(tx, { skipPreflight: false });
  await conn.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  return sig;
}
