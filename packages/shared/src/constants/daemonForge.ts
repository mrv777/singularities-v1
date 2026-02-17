export const DAEMON_TYPES = ["RECON", "SIPHON", "SENTINEL", "SABOTEUR"] as const;
export type DaemonType = (typeof DAEMON_TYPES)[number];

export interface DaemonDefinition {
  type: DaemonType;
  label: string;
  description: string;
  craftCost: { credits: number; data: number; processingPower: number };
  baseDurability: number;
  missionRewards: Record<number, { credits: number; data: number }>;
}

export const DAEMON_DEFINITIONS: Record<DaemonType, DaemonDefinition> = {
  RECON: {
    type: "RECON",
    label: "Recon Daemon",
    description: "Gathers credits and data from network recon missions.",
    craftCost: { credits: 40, data: 20, processingPower: 3 },
    baseDurability: 6,
    missionRewards: {
      30: { credits: 15, data: 10 },
      120: { credits: 45, data: 30 },
      240: { credits: 100, data: 65 },
    },
  },
  SIPHON: {
    type: "SIPHON",
    label: "Siphon Daemon",
    description: "Siphons credits from vulnerable endpoints.",
    craftCost: { credits: 50, data: 25, processingPower: 4 },
    baseDurability: 5,
    missionRewards: {
      30: { credits: 25, data: 5 },
      120: { credits: 70, data: 15 },
      240: { credits: 150, data: 30 },
    },
  },
  SENTINEL: {
    type: "SENTINEL",
    label: "Sentinel Daemon",
    description: "Guards your systems, reducing degradation by 50% while deployed.",
    craftCost: { credits: 60, data: 30, processingPower: 5 },
    baseDurability: 8,
    missionRewards: {
      30: { credits: 5, data: 5 },
      120: { credits: 15, data: 10 },
      240: { credits: 30, data: 20 },
    },
  },
  SABOTEUR: {
    type: "SABOTEUR",
    label: "Saboteur Daemon",
    description: "Returns with intel that boosts hack power temporarily.",
    craftCost: { credits: 70, data: 40, processingPower: 6 },
    baseDurability: 5,
    missionRewards: {
      30: { credits: 10, data: 8 },
      120: { credits: 30, data: 25 },
      240: { credits: 60, data: 50 },
    },
  },
};

/** Mission durations in minutes */
export const DAEMON_MISSION_DURATIONS = [30, 120, 240] as const;
export type DaemonMissionDuration = (typeof DAEMON_MISSION_DURATIONS)[number];

/** How many daemon slots by player level */
export function getDaemonSlots(level: number): number {
  if (level >= 12) return 3;
  if (level >= 9) return 2;
  return 1;
}

/** Saboteur hack power buff */
export const SABOTEUR_BUFF = {
  hackPower: 12,
  durationSeconds: 1800,
} as const;

/** Sentinel degradation reduction multiplier (applied in computeSystemHealth) */
export const SENTINEL_DEGRADATION_MULTIPLIER = 0.5;
