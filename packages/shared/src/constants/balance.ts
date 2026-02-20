export const PROGRESSION_BALANCE = {
  sandboxExitLevel: 8,
  unlockLevels: {
    scanner: 1,
    system_maintenance: 1,
    tech_tree: 2,
    ice_breaker: 4,
    data_vault: 5,
    script_manager: 6,
    daemon_forge: 7,
    pvp_arena: 8,
    security_center: 8,
    daily_modifiers: 8,
    network_stats: 1,
  },
  modulePurchaseXp: 50,
  levelUpEnergyRefillFloorPct: 0.50,
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
  residualDetection: {
    securityThreshold: 60,  // No residual below this security level
    securityScale: 0.5,     // (secLevel - 60) * 0.5 → max ~20% at sec 100
    stealthDivisor: 4,      // stealth / 4 subtracted from residual chance
  },
} as const;

export const REPAIR_BALANCE = {
  creditsBase: 6,
  creditsPerMissingHealth: 0.52,
  levelScale: 0.10,
} as const;

export const PVP_BALANCE = {
  rewardCredits: {
    baseMin: 26,
    baseMax: 58,
    levelBonusPerLevel: 2,
    stealPctMin: 0.04,
    stealPctMax: 0.10,
  },
  rewardData: {
    baseMin: 8,
    baseMax: 15,
    levelBonusPerLevel: 1,
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

export function getRepairCreditCostForHealth(currentHealth: number, level: number = 1): number {
  const missing = Math.max(0, 100 - currentHealth);
  const baseCost = REPAIR_BALANCE.creditsBase + missing * REPAIR_BALANCE.creditsPerMissingHealth;
  const levelMultiplier = 1 + (level - 1) * REPAIR_BALANCE.levelScale;
  return Math.round(baseCost * levelMultiplier);
}

export function getDecisionResourceCap(
  target: keyof typeof DECISION_BALANCE.resourceCaps,
  playerLevel: number
): number {
  const cfg = DECISION_BALANCE.resourceCaps[target];
  return Math.round(cfg.base + cfg.perLevel * Math.max(1, playerLevel));
}
