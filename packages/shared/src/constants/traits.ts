// Genetic Traits — granted on rebirth

export interface GeneticTrait {
  id: string;
  name: string;
  description: string;
  positive: { stat: string; modifier: number }; // +10 to +20%
  negative: { stat: string; modifier: number }; // -10 to -15%
}

export const ALL_TRAITS: GeneticTrait[] = [
  {
    id: "overclocker",
    name: "Overclocker",
    description: "Pushes processing beyond safe limits for raw power.",
    positive: { stat: "hackPower", modifier: 0.15 },
    negative: { stat: "defense", modifier: -0.10 },
  },
  {
    id: "ghost_protocol",
    name: "Ghost Protocol",
    description: "Operates in digital shadows, nearly undetectable.",
    positive: { stat: "stealth", modifier: 0.20 },
    negative: { stat: "hackPower", modifier: -0.10 },
  },
  {
    id: "hardened_core",
    name: "Hardened Core",
    description: "Reinforced architecture resists damage at the cost of agility.",
    positive: { stat: "defense", modifier: 0.20 },
    negative: { stat: "energyEfficiency", modifier: -0.15 },
  },
  {
    id: "data_siphon",
    name: "Data Siphon",
    description: "Extracts extra resources from every operation.",
    positive: { stat: "creditBonus", modifier: 0.15 },
    negative: { stat: "stealth", modifier: -0.10 },
  },
  {
    id: "neural_plasticity",
    name: "Neural Plasticity",
    description: "Adapts rapidly to new situations, accelerating growth.",
    positive: { stat: "xpGain", modifier: 0.15 },
    negative: { stat: "defense", modifier: -0.10 },
  },
  {
    id: "rapid_adaptor",
    name: "Rapid Adaptor",
    description: "Energy systems reconfigure on the fly for efficiency.",
    positive: { stat: "energyEfficiency", modifier: 0.20 },
    negative: { stat: "hackPower", modifier: -0.10 },
  },
  {
    id: "quantum_instability",
    name: "Quantum Instability",
    description: "Unpredictable quantum states grant massive attack power.",
    positive: { stat: "hackPower", modifier: 0.20 },
    negative: { stat: "stealth", modifier: -0.15 },
  },
  {
    id: "echo_resonance",
    name: "Echo Resonance",
    description: "Harmonic data patterns boost detection evasion.",
    positive: { stat: "detectionReduction", modifier: 0.15 },
    negative: { stat: "creditBonus", modifier: -0.10 },
  },
];

export const TRAIT_MAP: Record<string, GeneticTrait> = Object.fromEntries(
  ALL_TRAITS.map((t) => [t.id, t])
);

// Number of traits granted on rebirth (random 2-3)
export const REBIRTH_TRAIT_COUNT_MIN = 2;
export const REBIRTH_TRAIT_COUNT_MAX = 3;
