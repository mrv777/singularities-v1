export const PROGRESSION_BALANCE = {
  sandboxExitLevel: 9,
  unlockLevels: {
    scanner: 1,
    tech_tree: 3,
    system_maintenance: 5,
    script_manager: 7,
    pvp_arena: 9,
    security_center: 9,
    daily_modifiers: 9,
    network_stats: 9,
  },
  modulePurchaseXp: 20,
} as const;

export const SCANNER_BALANCE = {
  targetSecurity: {
    baseMin: 15,
    randomRange: 12,
    levelStep: 4,
    max: 95,
  },
  hackSuccess: {
    baseChance: 58,
    minChance: 20,
    maxChance: 95,
    earlyFloorBase: 35,
    earlyFloorDropPerLevel: 3,
    earlyFloorUntilLevel: 4,
  },
  hackCost: {
    base: 4,
    securityDivisor: 9,
  },
  rewards: {
    creditsBase: 12,
    creditsPerSecurity: 1.4,
    dataBase: 6,
    dataPerSecurity: 0.75,
    reputationBase: 1,
    reputationPerSecurity: 0.1,
    xpBase: 14,
    xpPerSecurity: 0.65,
  },
  highRiskProcessingPower: {
    securityThreshold: 65,
    min: 1,
    max: 2,
  },
} as const;

export const REPAIR_BALANCE = {
  creditsBase: 8,
  creditsPerMissingHealth: 0.7,
} as const;

export const PVP_BALANCE = {
  rewardCredits: {
    baseMin: 35,
    baseMax: 80,
    levelBonusPerLevel: 4,
    stealPctMin: 0.06,
    stealPctMax: 0.14,
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
