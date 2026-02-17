export const TOPOLOGY_NODES = [
  "scanner",
  "tech_tree",
  "ice_breaker",
  "script_manager",
  "pvp_arena",
  "security_center",
] as const;

export type TopologyNode = (typeof TOPOLOGY_NODES)[number];

export interface TopologyEffect {
  label: string;
  description: string;
  modifiers: Record<string, number>;
}

export const BOOST_EFFECTS: TopologyEffect[] = [
  {
    label: "Overclocked",
    description: "Systems running at peak efficiency",
    modifiers: { hackRewardMultiplier: 1.20, xpGainMultiplier: 1.15 },
  },
  {
    label: "Amplified Signal",
    description: "Enhanced connectivity boosts all outputs",
    modifiers: { hackRewardMultiplier: 1.15, passiveIncomeMultiplier: 1.25 },
  },
  {
    label: "Power Surge",
    description: "Extra energy flooding the grid",
    modifiers: { energyCostMultiplier: 0.80 },
  },
  {
    label: "Data Bloom",
    description: "Data flows freely through optimized channels",
    modifiers: { hackRewardMultiplier: 1.25 },
  },
];

export const HINDRANCE_EFFECTS: TopologyEffect[] = [
  {
    label: "Degraded",
    description: "Systems struggling under heavy load",
    modifiers: { hackRewardMultiplier: 0.85, degradationRateMultiplier: 1.30 },
  },
  {
    label: "Signal Jamming",
    description: "Interference reducing effectiveness",
    modifiers: { detectionChanceMultiplier: 1.25 },
  },
  {
    label: "Power Drain",
    description: "Energy being siphoned from the grid",
    modifiers: { energyCostMultiplier: 1.20 },
  },
  {
    label: "Corrupted Paths",
    description: "Data corruption slowing operations",
    modifiers: { hackRewardMultiplier: 0.80, xpGainMultiplier: 0.90 },
  },
];

export const ROGUE_MALWARE_CHANCE = 0.30;

export const ROGUE_MALWARE_CONFIG = {
  name: "Rogue Malware Node",
  securityLevel: 85,
  rewards: {
    credits: 500,
    data: 300,
    reputation: 50,
    xp: 100,
  },
} as const;
