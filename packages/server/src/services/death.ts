import { query, withTransaction, type TxClient } from "../db/pool.js";
import {
  DEATH_CORRUPTED_COUNT,
  ALL_TRAITS,
  REBIRTH_TRAIT_COUNT_MIN,
  REBIRTH_TRAIT_COUNT_MAX,
} from "@singularities/shared";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Check if a player has enough corrupted systems to trigger death.
 * Returns true if death was triggered.
 */
export async function checkDeath(playerId: string, client?: TxClient): Promise<boolean> {
  const dbQuery = client
    ? (text: string, params?: unknown[]) => client.query(text, params)
    : (text: string, params?: unknown[]) => query(text, params);

  const res = await dbQuery(
    "SELECT COUNT(*) as corrupted FROM player_systems WHERE player_id = $1 AND status = 'CORRUPTED'",
    [playerId]
  );

  const corrupted = parseInt(res.rows[0].corrupted as string, 10);
  if (corrupted >= DEATH_CORRUPTED_COUNT) {
    // Check if player is still alive
    const playerRes = await dbQuery("SELECT is_alive FROM players WHERE id = $1", [playerId]);
    if (playerRes.rows.length > 0 && (playerRes.rows[0].is_alive as boolean)) {
      await executeDeath(playerId, client);
      return true;
    }
  }
  return false;
}

/**
 * Execute death: mark dead, calculate carryover, store for rebirth.
 */
export async function executeDeath(playerId: string, outerClient?: TxClient): Promise<void> {
  const fn = async (client: TxClient) => {
    // Lock player
    const playerRes = await client.query(
      "SELECT * FROM players WHERE id = $1 FOR UPDATE",
      [playerId]
    );
    if (playerRes.rows.length === 0) return;

    const player = playerRes.rows[0];
    if (!(player.is_alive as boolean)) return; // Already dead

    const walletAddress = player.wallet_address as string;

    // Mark dead and clear mint so player can re-register for rebirth
    await client.query(
      "UPDATE players SET is_alive = false, mint_address = NULL, ai_name = NULL WHERE id = $1",
      [playerId]
    );

    // Get all owned modules with levels
    const modulesRes = await client.query(
      "SELECT module_id, level FROM player_modules WHERE player_id = $1 ORDER BY level DESC",
      [playerId]
    );

    let guaranteedModuleId: string | null = null;
    const recoveredModules: string[] = [];

    if (modulesRes.rows.length > 0) {
      // Highest-level module is guaranteed carryover
      guaranteedModuleId = modulesRes.rows[0].module_id as string;

      // Roll 50% for each other module
      for (let i = 1; i < modulesRes.rows.length; i++) {
        if (Math.random() < 0.5) {
          recoveredModules.push(modulesRes.rows[i].module_id as string);
        }
      }
    }

    // Upsert into wallet_carryovers
    await client.query(
      `INSERT INTO wallet_carryovers (wallet_address, guaranteed_module_id, recovered_modules, deaths_count, last_death_at)
       VALUES ($1, $2, $3, 1, NOW())
       ON CONFLICT (wallet_address) DO UPDATE SET
         guaranteed_module_id = $2,
         recovered_modules = $3,
         deaths_count = wallet_carryovers.deaths_count + 1,
         last_death_at = NOW()`,
      [walletAddress, guaranteedModuleId, JSON.stringify(recoveredModules)]
    );

    // NFT burn stub — TODO: real Metaplex burn when real minting is added
    console.log(`[death] Player ${playerId} (wallet: ${walletAddress}) died. NFT burn would happen here.`);
  };

  if (outerClient) {
    await fn(outerClient);
  } else {
    await withTransaction(fn);
  }
}

/**
 * Check if a wallet has pending carryover from a previous death.
 */
export async function getCarryoverForWallet(
  walletAddress: string
): Promise<{ guaranteedModuleId: string | null; recoveredModules: string[]; deathsCount: number } | null> {
  const res = await query(
    "SELECT * FROM wallet_carryovers WHERE wallet_address = $1",
    [walletAddress]
  );

  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  return {
    guaranteedModuleId: (row.guaranteed_module_id as string) ?? null,
    recoveredModules: (row.recovered_modules as string[]) ?? [],
    deathsCount: row.deaths_count as number,
  };
}

/**
 * Apply carryover to a freshly registered player.
 * Grants recovered modules and random genetic traits.
 */
export async function processRebirth(
  playerId: string,
  walletAddress: string,
  client: TxClient
): Promise<{ recoveredModules: string[]; traitIds: string[] }> {
  const carryover = await getCarryoverForWallet(walletAddress);
  if (!carryover) return { recoveredModules: [], traitIds: [] };

  const allModules: string[] = [];
  if (carryover.guaranteedModuleId) {
    allModules.push(carryover.guaranteedModuleId);
  }
  allModules.push(...carryover.recoveredModules);

  // Grant modules (level 1 each)
  for (const moduleId of allModules) {
    await client.query(
      `INSERT INTO player_modules (player_id, module_id, level)
       VALUES ($1, $2, 1)
       ON CONFLICT (player_id, module_id) DO NOTHING`,
      [playerId, moduleId]
    );
  }

  // Roll 2-3 random genetic traits
  const traitCount = randomInt(REBIRTH_TRAIT_COUNT_MIN, REBIRTH_TRAIT_COUNT_MAX);
  const shuffled = [...ALL_TRAITS].sort(() => Math.random() - 0.5);
  const selectedTraits = shuffled.slice(0, traitCount);

  for (const trait of selectedTraits) {
    await client.query(
      `INSERT INTO player_traits (player_id, trait_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [playerId, trait.id]
    );
  }

  // Clear wallet carryover
  await client.query(
    "DELETE FROM wallet_carryovers WHERE wallet_address = $1",
    [walletAddress]
  );

  return {
    recoveredModules: allModules,
    traitIds: selectedTraits.map((t) => t.id),
  };
}
