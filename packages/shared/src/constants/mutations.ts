export interface MutationVariant {
  id: string;
  name: string;
  description: string;
  effects: Record<string, number>;
}

export const MUTATION_VARIANTS: MutationVariant[] = [
  {
    id: "echo",
    name: "Echo",
    description: "Duplicates a fraction of module output for bonus effects.",
    effects: { hackPower: 3, creditBonus: 2 },
  },
  {
    id: "ghost",
    name: "Ghost",
    description: "Module operates in stealth mode, reducing detection.",
    effects: { stealth: 5, detectionReduction: 3 },
  },
  {
    id: "overcharge",
    name: "Overcharge",
    description: "Module outputs double but drains more energy.",
    effects: { hackPower: 6, energyEfficiency: -2 },
  },
  {
    id: "adaptive",
    name: "Adaptive",
    description: "Module adjusts to current conditions for balanced bonuses.",
    effects: { defense: 3, hackPower: 2, stealth: 2 },
  },
];

export const MUTATION_VARIANT_MAP: Record<string, MutationVariant> = Object.fromEntries(
  MUTATION_VARIANTS.map((m) => [m.id, m])
);

export const MUTATION_COST = {
  credits: 750,
  data: 300,
  processingPower: 140,
} as const;

export const MUTATION_SUCCESS_RATE = 0.65;
export const MUTATION_MIN_LEVEL = 3;
