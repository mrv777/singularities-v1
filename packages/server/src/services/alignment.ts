import { query, type TxClient } from "../db/pool.js";
import {
  ALIGNMENT_THRESHOLDS,
  BENEVOLENT_PERKS,
  DOMINATION_PERKS,
  type AlignmentPerkSet,
} from "@singularities/shared";

type DbQuery = (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

function makeQuery(client?: TxClient): DbQuery {
  return client
    ? (text, params) => client.query(text, params)
    : (text, params) => query(text, params);
}

export async function shiftAlignment(
  playerId: string,
  amount: number,
  client?: TxClient
): Promise<number> {
  const dbq = makeQuery(client);
  const res = await dbq("SELECT alignment FROM players WHERE id = $1", [playerId]);
  if (res.rows.length === 0) return 0;

  const current = res.rows[0].alignment as number;
  const newAlignment = Math.max(-1, Math.min(1, current + amount));

  await dbq("UPDATE players SET alignment = $1 WHERE id = $2", [newAlignment, playerId]);
  return newAlignment;
}

export function getAlignmentPerks(alignment: number): AlignmentPerkSet | null {
  if (alignment >= ALIGNMENT_THRESHOLDS.extreme) return BENEVOLENT_PERKS;
  if (alignment <= -ALIGNMENT_THRESHOLDS.extreme) return DOMINATION_PERKS;
  return null;
}

export function applyAlignmentToStats<
  T extends { hackPower: number; stealth: number; defense: number; creditBonus: number; dataBonus: number }
>(alignment: number, stats: T): T {
  const perks = getAlignmentPerks(alignment);
  if (!perks) return stats;

  return {
    ...stats,
    hackPower: Math.round(stats.hackPower * (1 + perks.attackBonus)),
    stealth: Math.round(stats.stealth * (1 + perks.stealthBonus)),
    defense: Math.round(stats.defense * (1 + perks.defenseBonus)),
    creditBonus: Math.round(stats.creditBonus * (1 + perks.creditBonus)),
    dataBonus: Math.round(stats.dataBonus * (1 + perks.dataDrainBonus)),
  };
}
