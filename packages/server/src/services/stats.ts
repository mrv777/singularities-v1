import { type TxClient, query } from "../db/pool.js";
import {
  MODULE_MAP,
  TRAIT_MAP,
  type LoadoutType,
  type ModifierEffect,
} from "@singularities/shared";
import { getActiveModifierEffects } from "./modifiers.js";
import { computeSystemHealth } from "./maintenance.js";

type DbQuery = (
  text: string,
  params?: unknown[]
) => Promise<{ rows: Record<string, unknown>[] }>;

function makeQuery(client?: TxClient): DbQuery {
  return client
    ? (text, params) => client.query(text, params)
    : (text, params) => query(text, params);
}

export interface ResolvedStats {
  hackPower: number;
  stealth: number;
  defense: number;
  energyEfficiency: number;
  scanRange: number;
  creditBonus: number;
  dataBonus: number;
  detectionReduction: number;
  /** 0-1 multiplier from average system health */
  healthMultiplier: number;
  /** Today's daily modifier effects */
  modifierEffects: ModifierEffect;
}

/**
 * Resolve the effective stats for a player's loadout.
 *
 * 1. Sum base module effects × level
 * 2. Apply genetic trait multipliers
 * 3. Apply system-health multiplier (degraded systems = weaker)
 *
 * Daily modifier multipliers are returned but NOT baked into the stat totals
 * because they apply to different formulas (reward multipliers, detection
 * multipliers, etc.) rather than flat stat additions.
 */
export async function resolveLoadoutStats(
  playerId: string,
  loadoutType: LoadoutType,
  client?: TxClient
): Promise<ResolvedStats> {
  const dbq = makeQuery(client);

  // 1. Load equipped modules for the loadout
  const modRes = await dbq(
    `SELECT pm.module_id, pm.level FROM player_loadouts pl
     JOIN player_modules pm ON pm.player_id = pl.player_id AND pm.module_id = pl.module_id
     WHERE pl.player_id = $1 AND pl.loadout_type = $2`,
    [playerId, loadoutType]
  );

  // Sum base effects × level
  const raw = {
    hackPower: 0,
    stealth: 0,
    defense: 0,
    energyEfficiency: 0,
    scanRange: 0,
    creditBonus: 0,
    dataBonus: 0,
    detectionReduction: 0,
  };

  for (const row of modRes.rows) {
    const def = MODULE_MAP[row.module_id as string];
    if (!def) continue;
    const level = row.level as number;
    for (const key of Object.keys(raw) as (keyof typeof raw)[]) {
      raw[key] += (def.effects[key] ?? 0) * level;
    }
  }

  // 2. Apply trait multipliers
  const traitRes = await dbq(
    "SELECT trait_id FROM player_traits WHERE player_id = $1",
    [playerId]
  );
  const traitIds = traitRes.rows.map((r) => r.trait_id as string);

  for (const key of Object.keys(raw) as (keyof typeof raw)[]) {
    let multiplier = 1;
    for (const traitId of traitIds) {
      const trait = TRAIT_MAP[traitId];
      if (!trait) continue;
      if (trait.positive.stat === key) multiplier += trait.positive.modifier;
      if (trait.negative.stat === key) multiplier += trait.negative.modifier;
    }
    raw[key] = Math.round(raw[key] * multiplier);
  }

  // 3. System health multiplier
  const modifierEffects = await getActiveModifierEffects();
  const sysRes = await dbq(
    "SELECT * FROM player_systems WHERE player_id = $1",
    [playerId]
  );
  let healthMultiplier = 1;
  if (sysRes.rows.length > 0) {
    const avg =
      sysRes.rows.reduce((sum, r) => {
        const computed = computeSystemHealth(r, modifierEffects);
        return sum + (computed.health as number);
      }, 0) / sysRes.rows.length;
    healthMultiplier = Math.max(0.1, avg / 100);
  }

  return {
    ...raw,
    healthMultiplier,
    modifierEffects,
  };
}
