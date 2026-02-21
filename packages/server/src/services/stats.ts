import { type TxClient, query } from "../db/pool.js";
import {
  MODULE_MAP,
  TRAIT_MAP,
  type LoadoutType,
  type ModifierEffect,
} from "@singularities/shared";
import { getActiveModifierEffects } from "./modifiers.js";
import { computeSystemHealth } from "./maintenance.js";
import { applyAlignmentToStats } from "./alignment.js";
import { getCurrentTopology, getTopologyEffects } from "./topology.js";
import { getWorldEventEffects } from "./worldEvents.js";
import { getMutationEffect } from "./mutations.js";
import { getActiveDecisionBuffs } from "./decisions.js";

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
  efficiency: number;
  creditBonus: number;
  dataBonus: number;
  /** 0-1 multiplier from average system health */
  healthMultiplier: number;
  /** Distinct module categories in this loadout (for diversity bonus) */
  categoryCount: number;
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
    `SELECT pm.module_id, pm.level, pm.mutation FROM player_loadouts pl
     JOIN player_modules pm ON pm.player_id = pl.player_id AND pm.module_id = pl.module_id
     WHERE pl.player_id = $1 AND pl.loadout_type = $2`,
    [playerId, loadoutType]
  );

  // Sum base effects × level
  const raw = {
    hackPower: 0,
    stealth: 0,
    defense: 0,
    efficiency: 0,
    creditBonus: 0,
    dataBonus: 0,
  };

  for (const row of modRes.rows) {
    const def = MODULE_MAP[row.module_id as string];
    if (!def) continue;
    const level = row.level as number;
    for (const key of Object.keys(raw) as (keyof typeof raw)[]) {
      raw[key] += (def.effects[key] ?? 0) * level;
    }

    // Phase 4: Add mutation bonuses
    const mutation = row.mutation as string | null;
    if (mutation) {
      const mutEffects = getMutationEffect(mutation);
      for (const key of Object.keys(raw) as (keyof typeof raw)[]) {
        raw[key] += mutEffects[key] ?? 0;
      }
    }
  }

  // Count distinct module categories (for diversity bonus)
  const categories = new Set<string>();
  for (const row of modRes.rows) {
    const catDef = MODULE_MAP[row.module_id as string];
    if (catDef) categories.add(catDef.category);
  }
  const categoryCount = categories.size;

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
    healthMultiplier = Math.min(1.0, Math.max(0.1, avg / 100 + raw.efficiency * 0.003));
  }

  // Phase 4: Apply alignment perks at extreme values
  const playerRes = await dbq("SELECT alignment FROM players WHERE id = $1", [playerId]);
  const alignment = playerRes.rows.length > 0 ? (playerRes.rows[0].alignment as number) : 0;
  const aligned = applyAlignmentToStats(alignment, raw);

  // Phase 4: Apply temporary decision buffs
  const decisionBuffs = await getActiveDecisionBuffs(playerId);
  for (const [key, value] of Object.entries(decisionBuffs)) {
    if (key in aligned) aligned[key as keyof typeof aligned] += value;
  }

  // Phase 4: Factor in topology and world event effects into modifier effects
  try {
    const [topology, worldEffects] = await Promise.all([
      getCurrentTopology(),
      getWorldEventEffects(),
    ]);
    const topoEffects = getTopologyEffects(topology);

    // Merge topology and world event effects into modifier effects (multiplicative)
    for (const [key, value] of Object.entries(topoEffects)) {
      if (key in modifierEffects) {
        (modifierEffects as Record<string, number>)[key] =
          ((modifierEffects as Record<string, number>)[key] ?? 1) * value;
      }
    }
    for (const [key, value] of Object.entries(worldEffects)) {
      if (key in modifierEffects) {
        (modifierEffects as Record<string, number>)[key] =
          ((modifierEffects as Record<string, number>)[key] ?? 1) * value;
      }
    }
  } catch {
    // Non-critical — topology/events may not be available
  }

  return {
    ...aligned,
    healthMultiplier,
    categoryCount,
    modifierEffects,
  };
}

/**
 * Count distinct module categories in a loadout (for diversity bonus).
 */
export async function countLoadoutCategories(
  playerId: string,
  loadoutType: LoadoutType,
  client?: TxClient
): Promise<number> {
  const dbq = makeQuery(client);
  const res = await dbq(
    `SELECT DISTINCT m.module_id FROM player_loadouts m
     WHERE m.player_id = $1 AND m.loadout_type = $2 AND m.module_id IS NOT NULL`,
    [playerId, loadoutType]
  );
  const categories = new Set<string>();
  for (const row of res.rows) {
    const def = MODULE_MAP[row.module_id as string];
    if (def) categories.add(def.category);
  }
  return categories.size;
}

/**
 * Count distinct categories from a list of module IDs (for simulations).
 */
export function getLoadoutCategoryCount(
  moduleIds: (string | null)[]
): number {
  const categories = new Set<string>();
  for (const id of moduleIds) {
    if (id && MODULE_MAP[id]) {
      categories.add(MODULE_MAP[id].category);
    }
  }
  return categories.size;
}
