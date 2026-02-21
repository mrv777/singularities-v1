export const ALIGNMENT_SHIFTS = {
  attackWeaker: -0.10,
  attackStronger: 0.04,
  pvpDefenseWin: 0,
  hackCivilian: -0.01,
} as const;

export const ALIGNMENT_THRESHOLDS = {
  extreme: 0.8,
} as const;

export interface AlignmentPerkSet {
  reputationBonus: number;
  creditBonus: number;
  defenseBonus: number;
  attackBonus: number;
  stealthBonus: number;
  dataDrainBonus: number;
}

export const BENEVOLENT_PERKS: AlignmentPerkSet = {
  reputationBonus: 0.25,
  creditBonus: 0.10,
  defenseBonus: 0.15,
  attackBonus: 0,
  stealthBonus: 0,
  dataDrainBonus: 0,
};

export const DOMINATION_PERKS: AlignmentPerkSet = {
  reputationBonus: 0,
  creditBonus: 0,
  defenseBonus: 0,
  attackBonus: 0.20,
  stealthBonus: 0.10,
  dataDrainBonus: 0.15,
};
