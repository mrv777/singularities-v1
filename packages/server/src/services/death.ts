import { query, withTransaction, type TxClient } from "../db/pool.js";
import {
  DEATH_CORRUPTED_COUNT,
  DEATH_MODULE_RECOVERY_CHANCE,
  ALL_TRAITS,
  REBIRTH_TRAIT_COUNT_MIN,
  REBIRTH_TRAIT_COUNT_MAX,
  pickTemplate,
  fillTemplate,
  DEATH_TEMPLATES,
} from "@singularities/shared";
import { broadcastSystem } from "./ws.js";
import { burnNft } from "./nft.js";

interface CarryoverModuleRecord {
  moduleId: string;
  level: number;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeModuleLevel(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
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
  let mintToBurn: string | null = null;

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
      "UPDATE players SET is_alive = false, mint_address = NULL WHERE id = $1",
      [playerId]
    );

    // Get all owned modules with levels
    const modulesRes = await client.query(
      "SELECT module_id, level FROM player_modules WHERE player_id = $1 ORDER BY level DESC",
      [playerId]
    );

    let guaranteedModuleId: string | null = null;
    const recoveredModules: CarryoverModuleRecord[] = [];

    if (modulesRes.rows.length > 0) {
      // Highest-level module is guaranteed carryover
      guaranteedModuleId = modulesRes.rows[0].module_id as string;
      const guaranteedModuleLevel = normalizeModuleLevel(modulesRes.rows[0].level);
      recoveredModules.push({ moduleId: guaranteedModuleId, level: guaranteedModuleLevel });

      // Roll for each other module
      for (let i = 1; i < modulesRes.rows.length; i++) {
        if (Math.random() < DEATH_MODULE_RECOVERY_CHANCE) {
          recoveredModules.push({
            moduleId: modulesRes.rows[i].module_id as string,
            level: normalizeModuleLevel(modulesRes.rows[i].level),
          });
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

    const aiName = player.ai_name as string;
    const mintAddress = player.mint_address as string | null;
    const deathNarrative = fillTemplate(pickTemplate(DEATH_TEMPLATES), { name: aiName });
    console.log(`[death] ${deathNarrative}\n  Player ${playerId} (wallet: ${walletAddress}) died.`);
    broadcastSystem(`${aiName} has been terminated. Systems corrupted beyond recovery.`);

    // Queue burn inside transaction; actual RPC call happens after commit
    if (mintAddress && !mintAddress.startsWith("mock_mint_")) {
      await client.query(
        `INSERT INTO pending_nft_burns (player_id, mint_address) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [playerId, mintAddress]
      );
      mintToBurn = mintAddress;
    }
  };

  if (outerClient) {
    await fn(outerClient);
  } else {
    await withTransaction(fn);
  }

  // Attempt burn outside the DB transaction to avoid holding row locks during RPC.
  // On success, remove from retry queue. On failure, the retry worker handles it.
  if (mintToBurn) {
    try {
      await burnNft(mintToBurn);
      console.log(`[death] NFT ${mintToBurn} burned successfully.`);
      await query(
        "DELETE FROM pending_nft_burns WHERE mint_address = $1",
        [mintToBurn]
      );
    } catch (err) {
      console.error(`[death] NFT burn failed for ${mintToBurn}, left in retry queue:`, err);
    }
  }
}

/**
 * Check if a wallet has pending carryover from a previous death.
 */
export async function getCarryoverForWallet(
  walletAddress: string
): Promise<{ guaranteedModuleId: string | null; recoveredModules: CarryoverModuleRecord[]; deathsCount: number } | null> {
  const res = await query(
    "SELECT * FROM wallet_carryovers WHERE wallet_address = $1",
    [walletAddress]
  );

  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  const guaranteedModuleId = (row.guaranteed_module_id as string) ?? null;
  const recoveredRaw = row.recovered_modules as unknown;
  const moduleLevels = new Map<string, number>();

  if (Array.isArray(recoveredRaw)) {
    for (const entry of recoveredRaw) {
      if (typeof entry === "string") {
        moduleLevels.set(entry, Math.max(moduleLevels.get(entry) ?? 0, 1));
        continue;
      }
      if (entry && typeof entry === "object") {
        const obj = entry as Record<string, unknown>;
        const moduleIdRaw = obj.moduleId ?? obj.module_id;
        if (typeof moduleIdRaw !== "string" || moduleIdRaw.length === 0) continue;
        const level = normalizeModuleLevel(obj.level);
        moduleLevels.set(moduleIdRaw, Math.max(moduleLevels.get(moduleIdRaw) ?? 0, level));
      }
    }
  }

  if (guaranteedModuleId) {
    moduleLevels.set(guaranteedModuleId, Math.max(moduleLevels.get(guaranteedModuleId) ?? 0, 1));
  }

  const recoveredModules: CarryoverModuleRecord[] = Array.from(moduleLevels.entries()).map(
    ([moduleId, level]) => ({ moduleId, level })
  );

  return {
    guaranteedModuleId,
    recoveredModules,
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

  const moduleLevels = new Map<string, number>();
  for (const m of carryover.recoveredModules) {
    moduleLevels.set(m.moduleId, Math.max(moduleLevels.get(m.moduleId) ?? 0, normalizeModuleLevel(m.level)));
  }
  if (carryover.guaranteedModuleId) {
    moduleLevels.set(
      carryover.guaranteedModuleId,
      Math.max(moduleLevels.get(carryover.guaranteedModuleId) ?? 0, 1)
    );
  }

  // Grant recovered modules and keep the recovered level.
  for (const [moduleId, level] of moduleLevels.entries()) {
    await client.query(
      `INSERT INTO player_modules (player_id, module_id, level)
       VALUES ($1, $2, $3)
       ON CONFLICT (player_id, module_id) DO UPDATE SET
         level = GREATEST(player_modules.level, EXCLUDED.level)`,
      [playerId, moduleId, level]
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
    recoveredModules: Array.from(moduleLevels.keys()),
    traitIds: selectedTraits.map((t) => t.id),
  };
}
