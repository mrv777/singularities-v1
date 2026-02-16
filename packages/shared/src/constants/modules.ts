export type ModuleCategory = "primary" | "secondary" | "relay" | "backup";
export type ModuleTier = "basic" | "advanced" | "elite";

export interface ModuleDefinition {
  id: string;
  name: string;
  category: ModuleCategory;
  tier: ModuleTier;
  description: string;
  maxLevel: number;
  baseCost: number;
  effects: Record<string, number>;
}

export const MODULE_CATEGORIES: Record<
  ModuleCategory,
  { label: string; lean: string; description: string }
> = {
  primary: {
    label: "Primary",
    lean: "Offense",
    description:
      "Core processing: boost output, expand memory, improve efficiency",
  },
  secondary: {
    label: "Secondary",
    lean: "Utility",
    description:
      "Data mining, encryption, bandwidth, resource optimization",
  },
  relay: {
    label: "Relay",
    lean: "Stealth",
    description: "Network: signal routing, mesh connectivity, evasion",
  },
  backup: {
    label: "Backup",
    lean: "Defense",
    description:
      "Resilience: storage, sync speed, data integrity, firewalls",
  },
};

export const MODULE_TIERS: ModuleTier[] = ["basic", "advanced", "elite"];

export const TIER_UNLOCK_REQUIREMENT = 2; // Must unlock 2 of 3 modules in tier to advance
export const MAX_MODULE_LEVEL = 5;
