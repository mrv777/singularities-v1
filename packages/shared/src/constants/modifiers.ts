export interface ModifierEffect {
  energyCostMultiplier?: number;
  hackRewardMultiplier?: number;
  degradationRateMultiplier?: number;
  repairCostMultiplier?: number;
  passiveIncomeMultiplier?: number;
  detectionChanceMultiplier?: number;
  xpGainMultiplier?: number;
  heatDecayMultiplier?: number;
}

export interface ModifierDefinition {
  id: string;
  name: string;
  description: string;
  severity: "minor" | "major";
  effects: ModifierEffect;
}

export const MODIFIER_POOL: ModifierDefinition[] = [
  // 6 Minor modifiers
  {
    id: "power_surge",
    name: "Power Surge",
    description: "Grid fluctuations reduce energy costs.",
    severity: "minor",
    effects: { energyCostMultiplier: 0.85 },
  },
  {
    id: "data_bloom",
    name: "Data Bloom",
    description: "Network overflow increases hack rewards.",
    severity: "minor",
    effects: { hackRewardMultiplier: 1.15 },
  },
  {
    id: "entropy_wave",
    name: "Entropy Wave",
    description: "Background noise accelerates system degradation.",
    severity: "minor",
    effects: { degradationRateMultiplier: 1.25 },
  },
  {
    id: "market_dip",
    name: "Market Dip",
    description: "Repair parts are cheaper on the black market.",
    severity: "minor",
    effects: { repairCostMultiplier: 0.75 },
  },
  {
    id: "signal_boost",
    name: "Signal Boost",
    description: "Strong signals increase passive income.",
    severity: "minor",
    effects: { passiveIncomeMultiplier: 1.2 },
  },
  {
    id: "stealth_fog",
    name: "Stealth Fog",
    description: "Atmospheric interference lowers detection chance.",
    severity: "minor",
    effects: { detectionChanceMultiplier: 0.8 },
  },
  // 5 Major modifiers
  {
    id: "system_overload",
    name: "System Overload",
    description: "Critical infrastructure strain doubles degradation but boosts XP.",
    severity: "major",
    effects: { degradationRateMultiplier: 1.5, xpGainMultiplier: 1.75 },
  },
  {
    id: "blackout_protocol",
    name: "Blackout Protocol",
    description: "Emergency power conservation. Less energy, less detection.",
    severity: "major",
    effects: { energyCostMultiplier: 1.3, detectionChanceMultiplier: 0.5 },
  },
  {
    id: "harvest_moon",
    name: "Harvest Moon",
    description: "Maximum resource extraction window. Everything pays more.",
    severity: "major",
    effects: { hackRewardMultiplier: 1.25, passiveIncomeMultiplier: 1.2, degradationRateMultiplier: 1.3 },
  },
  {
    id: "corrosion_storm",
    name: "Corrosion Storm",
    description: "Severe environment damage. Repairs cost more but heat decays faster.",
    severity: "major",
    effects: { degradationRateMultiplier: 1.75, repairCostMultiplier: 1.5, heatDecayMultiplier: 2.0 },
  },
  {
    id: "neural_resonance",
    name: "Neural Resonance",
    description: "AI alignment event. XP gains and passive income surge.",
    severity: "major",
    effects: { xpGainMultiplier: 1.5, passiveIncomeMultiplier: 1.2, energyCostMultiplier: 1.15 },
  },
];

export const MODIFIER_MAP: Record<string, ModifierDefinition> = Object.fromEntries(
  MODIFIER_POOL.map((m) => [m.id, m])
);

export const MINOR_MODIFIERS = MODIFIER_POOL.filter((m) => m.severity === "minor");
export const MAJOR_MODIFIERS = MODIFIER_POOL.filter((m) => m.severity === "major");
