export const ICE_LAYER_TYPES = ["FIREWALL", "TRACER", "BLACK_ICE"] as const;
export type IceLayerType = (typeof ICE_LAYER_TYPES)[number];

/** Which player stat each layer type checks against */
export const ICE_LAYER_STAT: Record<IceLayerType, "hackPower" | "stealth" | "defense"> = {
  FIREWALL: "hackPower",
  TRACER: "stealth",
  BLACK_ICE: "defense",
};

export const ICE_BREAKER_BALANCE = {
  energyCost: 18,
  dailyLimit: 3,
  cooldownSeconds: 600,

  /** Number of layers by player level */
  layerCount: (level: number): number => {
    if (level >= 10) return 5;
    if (level >= 8) return 4;
    return 3;
  },

  /** Difficulty threshold for a layer */
  layerThreshold: (type: IceLayerType, depth: number, playerLevel: number): number => {
    const bases: Record<IceLayerType, number> = { FIREWALL: 18, TRACER: 14, BLACK_ICE: 16 };
    const depthScale: Record<IceLayerType, number> = { FIREWALL: 6, TRACER: 5, BLACK_ICE: 7 };
    const levelScale: Record<IceLayerType, number> = { FIREWALL: 2, TRACER: 1.5, BLACK_ICE: 2.5 };
    return Math.round(bases[type] + depth * depthScale[type] + playerLevel * levelScale[type]);
  },

  /** Reward table indexed by depth (0-based) */
  rewards: [
    { credits: 20, data: 10, xp: 5, processingPower: 0 },
    { credits: 50, data: 30, xp: 15, processingPower: 0 },
    { credits: 90, data: 55, xp: 25, processingPower: 0 },
    { credits: 140, data: 80, xp: 40, processingPower: 1 },
    { credits: 200, data: 110, xp: 50, processingPower: 2 },
  ],

  /** On failure: retain 50% of accumulated rewards */
  failRetentionPct: 0.5,

  /** On failure: damage applied to random systems */
  failDamage: {
    systemsAffected: { min: 1, max: 2 },
    damagePerSystem: { min: 10, max: 20 },
  },
} as const;
