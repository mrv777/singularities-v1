export const PROGRESSION_BALANCE = {
  sandboxExitLevel: 8,
  unlockLevels: {
    scanner: 1,
    system_maintenance: 1,
    tech_tree: 2,
    script_manager: 4,
    data_vault: 5,
    ice_breaker: 6,
    daemon_forge: 7,
    pvp_arena: 8,
    security_center: 8,
    daily_modifiers: 8,
    network_stats: 1,
  },
  modulePurchaseXp: 6,
  levelUpEnergyRefillFloorPct: 0.35,
} as const;

export const SCANNER_BALANCE = {
  targetSecurity: {
    baseMin: 14,
    randomRange: 12,
    levelStep: 3,
    max: 95,
  },
  hackSuccess: {
    baseChance: 58,
    minChance: 22,
    maxChance: 95,
    earlyFloorBase: 36,
    earlyFloorDropPerLevel: 3,
    earlyFloorUntilLevel: 4,
  },
  hackCost: {
    base: 3,
    securityDivisor: 14,
  },
  rewards: {
    creditsBase: 9,
    creditsPerSecurity: 0.95,
    dataBase: 5,
    dataPerSecurity: 0.58,
    reputationBase: 1,
    reputationPerSecurity: 0.1,
    xpBase: 9,
    xpPerSecurity: 0.22,
  },
  highRiskProcessingPower: {
    securityThreshold: 65,
    min: 1,
    max: 2,
  },
} as const;

export const REPAIR_BALANCE = {
  creditsBase: 6,
  creditsPerMissingHealth: 0.52,
} as const;

export const PVP_BALANCE = {
  rewardCredits: {
    baseMin: 26,
    baseMax: 58,
    levelBonusPerLevel: 2,
    stealPctMin: 0.04,
    stealPctMax: 0.10,
  },
  rewardProcessingPower: {
    min: 1,
    max: 2,
  },
} as const;

export const DECISION_BALANCE = {
  rarityResourceScale: {
    common: 1,
    uncommon: 0.85,
    rare: 0.75,
  },
  levelScalePerLevel: 0.04,
  resourceCaps: {
    credits: { base: 150, perLevel: 40 },
    data: { base: 80, perLevel: 25 },
    processingPower: { base: 10, perLevel: 4 },
    reputation: { base: 20, perLevel: 8 },
  },
} as const;

export const HOOK_BALANCE = {
  firstSuccessDailyBuff: {
    hackPower: 8,
    stealth: 5,
    durationSeconds: 3600,
  },
} as const;

export function getEarlyHackSuccessFloor(playerLevel: number): number {
  if (playerLevel > SCANNER_BALANCE.hackSuccess.earlyFloorUntilLevel) {
    return SCANNER_BALANCE.hackSuccess.minChance;
  }
  const floor = SCANNER_BALANCE.hackSuccess.earlyFloorBase
    - (playerLevel - 1) * SCANNER_BALANCE.hackSuccess.earlyFloorDropPerLevel;
  return Math.max(SCANNER_BALANCE.hackSuccess.minChance, floor);
}

export function getRepairCreditCostForHealth(currentHealth: number): number {
  const missing = Math.max(0, 100 - currentHealth);
  return Math.round(REPAIR_BALANCE.creditsBase + missing * REPAIR_BALANCE.creditsPerMissingHealth);
}

export function getDecisionResourceCap(
  target: keyof typeof DECISION_BALANCE.resourceCaps,
  playerLevel: number
): number {
  const cfg = DECISION_BALANCE.resourceCaps[target];
  return Math.round(cfg.base + cfg.perLevel * Math.max(1, playerLevel));
}
