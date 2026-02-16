// Row mappers: snake_case DB rows → camelCase API shape
// Used by both routes and services to avoid duplication

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
