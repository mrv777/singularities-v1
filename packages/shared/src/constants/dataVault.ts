export const DATA_VAULT_BUFF_KEYS = [
  "hackPower",
  "stealth",
  "detectionReduction",
  "dataBonus",
] as const;

export type DataVaultBuffKey = typeof DATA_VAULT_BUFF_KEYS[number];

export interface DataVaultProtocolDefinition {
  id: string;
  name: string;
  description: string;
  recommendationReason?: string;
  costs: {
    credits: number;
    data: number;
  };
  durationSeconds: number;
  buffs: Partial<Record<DataVaultBuffKey, number>>;
  recommended?: boolean;
}

export const DATA_VAULT_BALANCE = {
  dailyUseCap: 2,
  cooldownSeconds: 600,
  protocols: [
    {
      id: "focus_cache",
      name: "Focus Cache",
      description: "Convert captured telemetry into precision exploit signatures.",
      recommendationReason: "Best early progression throughput (+Hack Power) for routine PvE hacks.",
      costs: { credits: 20, data: 40 },
      durationSeconds: 20 * 60,
      buffs: { hackPower: 8 },
      recommended: true,
    },
    {
      id: "ghost_cache",
      name: "Ghost Cache",
      description: "Obfuscate your trace to reduce detection pressure.",
      costs: { credits: 15, data: 35 },
      durationSeconds: 20 * 60,
      buffs: { stealth: 10, detectionReduction: 10 },
    },
    {
      id: "harvest_cache",
      name: "Harvest Cache",
      description: "Route trace residue into extraction routines for larger telemetry pulls.",
      costs: { credits: 18, data: 45 },
      durationSeconds: 20 * 60,
      buffs: { dataBonus: 12 },
    },
    {
      id: "tandem_cache",
      name: "Tandem Cache",
      description: "Balanced attack-stealth profile for mixed PvE and low-risk PvP windows.",
      costs: { credits: 22, data: 45 },
      durationSeconds: 20 * 60,
      buffs: { hackPower: 4, stealth: 6 },
    },
  ] as const satisfies readonly DataVaultProtocolDefinition[],
} as const;

export const DATA_VAULT_PROTOCOLS: DataVaultProtocolDefinition[] =
  DATA_VAULT_BALANCE.protocols.map((protocol) => ({
    ...protocol,
    buffs: { ...protocol.buffs },
  }));

export const DATA_VAULT_PROTOCOL_MAP: Record<string, DataVaultProtocolDefinition> =
  Object.fromEntries(DATA_VAULT_PROTOCOLS.map((protocol) => [protocol.id, protocol]));
