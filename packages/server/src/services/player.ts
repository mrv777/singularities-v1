// Row mappers: snake_case DB rows → camelCase API shape
// Used by both routes and services to avoid duplication

import { ENERGY_BASE_REGEN_PER_HOUR, ENERGY_REGEN_PER_LEVEL } from "@singularities/shared";

/**
 * Compute current energy on read using calculate-on-read pattern.
 * Regen rate scales with level: base + (level - 1) * perLevel.
 * Returns the row with computed energy value.
 */
export function computeEnergy(row: Record<string, unknown>): Record<string, unknown> {
  const storedEnergy = row.energy as number;
  const energyMax = row.energy_max as number;
  const level = (row.level as number) ?? 1;
  const updatedAt = new Date(row.energy_updated_at as string).getTime();
  const now = Date.now();
  const secondsElapsed = Math.max(0, (now - updatedAt) / 1000);
  const regenPerHour = ENERGY_BASE_REGEN_PER_HOUR + (level - 1) * ENERGY_REGEN_PER_LEVEL;
  const regenPerSecond = regenPerHour / 3600;
  const regenned = Math.floor(regenPerSecond * secondsElapsed);
  const currentEnergy = Math.min(energyMax, storedEnergy + regenned);
  return { ...row, energy: currentEnergy };
}

export function mapPlayerRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    walletAddress: row.wallet_address as string,
    mintAddress: (row.mint_address as string) ?? null,
    aiName: row.ai_name as string,
    level: row.level as number,
    xp: row.xp as number,
    credits: row.credits as number,
    energy: row.energy as number,
    energyMax: row.energy_max as number,
    processingPower: row.processing_power as number,
    data: row.data as number,
    reputation: row.reputation as number,
    alignment: row.alignment as number,
    heatLevel: row.heat_level as number,
    isAlive: row.is_alive as boolean,
    isInSandbox: row.is_in_sandbox as boolean,
    inPvpArena: row.in_pvp_arena as boolean,
    energyUpdatedAt: row.energy_updated_at as string,
    lastActiveAt: row.last_active_at as string,
    createdAt: row.created_at as string,
    seasonId: (row.season_id as number) ?? null,
    adaptationPeriodUntil: (row.adaptation_period_until as string) ?? null,
  };
}

export function mapSystemRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    playerId: row.player_id as string,
    systemType: row.system_type as string,
    health: row.health as number,
    status: row.status as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapModuleRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    playerId: row.player_id as string,
    moduleId: row.module_id as string,
    level: row.level as number,
    purchasedAt: row.purchased_at as string,
  };
}

export function mapLoadoutRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    playerId: row.player_id as string,
    loadoutType: row.loadout_type as string,
    slot: row.slot as number,
    moduleId: (row.module_id as string) ?? null,
  };
}

export function mapTraitRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    playerId: row.player_id as string,
    traitId: row.trait_id as string,
  };
}

export function mapCombatLogRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    attackerId: row.attacker_id as string,
    defenderId: row.defender_id as string,
    attackerLoadout: (row.attacker_loadout as Record<string, unknown>) ?? {},
    defenderLoadout: (row.defender_loadout as Record<string, unknown>) ?? {},
    result: row.result as string,
    damageDealt: (row.damage_dealt as Record<string, number>) ?? null,
    creditsTransferred: row.credits_transferred as number,
    reputationChange: row.reputation_change as number,
    combatLog: (row.combat_log as unknown[]) ?? [],
    xpAwarded: (row.xp_awarded as number) ?? 0,
    createdAt: row.created_at as string,
  };
}
