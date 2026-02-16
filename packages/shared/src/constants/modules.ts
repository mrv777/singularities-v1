export type ModuleCategory = "primary" | "secondary" | "relay" | "backup";
export type ModuleTier = "basic" | "advanced" | "elite";

export interface ModuleDefinition {
  id: string;
  name: string;
  category: ModuleCategory;
  tier: ModuleTier;
  description: string;
  maxLevel: number;
  baseCost: { credits: number; data: number };
  costPerLevel: { credits: number; data: number };
  dependencies: string[];
  effects: {
    hackPower?: number;
    stealth?: number;
    defense?: number;
    energyEfficiency?: number;
    scanRange?: number;
    creditBonus?: number;
    dataBonus?: number;
    detectionReduction?: number;
  };
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

// ─── 36 Module Definitions: 4 categories × 3 tiers × 3 modules ───

export const ALL_MODULES: ModuleDefinition[] = [
  // ═══ PRIMARY (Offense) ═══
  // Basic
  {
    id: "pri_b_bruteforce",
    name: "Brute Force Engine",
    category: "primary",
    tier: "basic",
    description: "Raw computational force for breaking weak encryptions.",
    maxLevel: 5,
    baseCost: { credits: 50, data: 20 },
    costPerLevel: { credits: 30, data: 15 },
    dependencies: [],
    effects: { hackPower: 5 },
  },
  {
    id: "pri_b_packetflood",
    name: "Packet Flood Array",
    category: "primary",
    tier: "basic",
    description: "Overwhelms target networks with junk data packets.",
    maxLevel: 5,
    baseCost: { credits: 60, data: 15 },
    costPerLevel: { credits: 35, data: 12 },
    dependencies: [],
    effects: { hackPower: 4, detectionReduction: -2 },
  },
  {
    id: "pri_b_portscanner",
    name: "Port Scanner Pro",
    category: "primary",
    tier: "basic",
    description: "Identifies vulnerable entry points in target systems.",
    maxLevel: 5,
    baseCost: { credits: 40, data: 25 },
    costPerLevel: { credits: 25, data: 18 },
    dependencies: [],
    effects: { hackPower: 3, scanRange: 2 },
  },
  // Advanced
  {
    id: "pri_a_exploit",
    name: "Exploit Framework",
    category: "primary",
    tier: "advanced",
    description: "Automated exploit chains for known vulnerabilities.",
    maxLevel: 5,
    baseCost: { credits: 150, data: 80 },
    costPerLevel: { credits: 75, data: 40 },
    dependencies: ["pri_b_bruteforce", "pri_b_packetflood", "pri_b_portscanner"],
    effects: { hackPower: 10 },
  },
  {
    id: "pri_a_zerohour",
    name: "Zero-Hour Payload",
    category: "primary",
    tier: "advanced",
    description: "Delivers custom payloads that bypass standard defenses.",
    maxLevel: 5,
    baseCost: { credits: 180, data: 60 },
    costPerLevel: { credits: 85, data: 35 },
    dependencies: ["pri_b_bruteforce", "pri_b_packetflood", "pri_b_portscanner"],
    effects: { hackPower: 8, stealth: 3 },
  },
  {
    id: "pri_a_overload",
    name: "System Overload",
    category: "primary",
    tier: "advanced",
    description: "Pushes target systems past their operational limits.",
    maxLevel: 5,
    baseCost: { credits: 160, data: 70 },
    costPerLevel: { credits: 80, data: 38 },
    dependencies: ["pri_b_bruteforce", "pri_b_packetflood", "pri_b_portscanner"],
    effects: { hackPower: 12, energyEfficiency: -1 },
  },
  // Elite
  {
    id: "pri_e_neuralstrike",
    name: "Neural Strike",
    category: "primary",
    tier: "elite",
    description: "AI-guided precision attack that adapts in real-time.",
    maxLevel: 5,
    baseCost: { credits: 400, data: 200 },
    costPerLevel: { credits: 180, data: 90 },
    dependencies: ["pri_a_exploit", "pri_a_zerohour", "pri_a_overload"],
    effects: { hackPower: 20, stealth: 5 },
  },
  {
    id: "pri_e_quantumcrack",
    name: "Quantum Crack",
    category: "primary",
    tier: "elite",
    description: "Quantum-assisted decryption of hardened security layers.",
    maxLevel: 5,
    baseCost: { credits: 450, data: 180 },
    costPerLevel: { credits: 200, data: 85 },
    dependencies: ["pri_a_exploit", "pri_a_zerohour", "pri_a_overload"],
    effects: { hackPower: 25 },
  },
  {
    id: "pri_e_abyss",
    name: "Abyss Protocol",
    category: "primary",
    tier: "elite",
    description: "Erases all traces while maximizing data extraction.",
    maxLevel: 5,
    baseCost: { credits: 420, data: 220 },
    costPerLevel: { credits: 190, data: 100 },
    dependencies: ["pri_a_exploit", "pri_a_zerohour", "pri_a_overload"],
    effects: { hackPower: 18, stealth: 8, creditBonus: 5 },
  },

  // ═══ SECONDARY (Utility) ═══
  // Basic
  {
    id: "sec_b_datamine",
    name: "Data Mining Rig",
    category: "secondary",
    tier: "basic",
    description: "Extracts additional data fragments from hacked targets.",
    maxLevel: 5,
    baseCost: { credits: 45, data: 15 },
    costPerLevel: { credits: 25, data: 10 },
    dependencies: [],
    effects: { dataBonus: 3 },
  },
  {
    id: "sec_b_bandwidth",
    name: "Bandwidth Booster",
    category: "secondary",
    tier: "basic",
    description: "Increases data transfer rates during operations.",
    maxLevel: 5,
    baseCost: { credits: 55, data: 10 },
    costPerLevel: { credits: 30, data: 8 },
    dependencies: [],
    effects: { energyEfficiency: 2 },
  },
  {
    id: "sec_b_creditsiphon",
    name: "Credit Siphon",
    category: "secondary",
    tier: "basic",
    description: "Skims additional credits from financial transactions.",
    maxLevel: 5,
    baseCost: { credits: 60, data: 20 },
    costPerLevel: { credits: 35, data: 12 },
    dependencies: [],
    effects: { creditBonus: 3 },
  },
  // Advanced
  {
    id: "sec_a_deepextract",
    name: "Deep Extraction",
    category: "secondary",
    tier: "advanced",
    description: "Accesses hidden data layers for premium resources.",
    maxLevel: 5,
    baseCost: { credits: 140, data: 70 },
    costPerLevel: { credits: 70, data: 35 },
    dependencies: ["sec_b_datamine", "sec_b_bandwidth", "sec_b_creditsiphon"],
    effects: { dataBonus: 8, creditBonus: 3 },
  },
  {
    id: "sec_a_resourceopt",
    name: "Resource Optimizer",
    category: "secondary",
    tier: "advanced",
    description: "Reduces energy cost of all operations.",
    maxLevel: 5,
    baseCost: { credits: 160, data: 55 },
    costPerLevel: { credits: 75, data: 30 },
    dependencies: ["sec_b_datamine", "sec_b_bandwidth", "sec_b_creditsiphon"],
    effects: { energyEfficiency: 5 },
  },
  {
    id: "sec_a_profitmatrix",
    name: "Profit Matrix",
    category: "secondary",
    tier: "advanced",
    description: "Algorithmic credit optimization for maximum yield.",
    maxLevel: 5,
    baseCost: { credits: 170, data: 60 },
    costPerLevel: { credits: 80, data: 32 },
    dependencies: ["sec_b_datamine", "sec_b_bandwidth", "sec_b_creditsiphon"],
    effects: { creditBonus: 8 },
  },
  // Elite
  {
    id: "sec_e_omniharvest",
    name: "Omni-Harvest",
    category: "secondary",
    tier: "elite",
    description: "Extracts every possible resource from compromised systems.",
    maxLevel: 5,
    baseCost: { credits: 380, data: 190 },
    costPerLevel: { credits: 170, data: 85 },
    dependencies: ["sec_a_deepextract", "sec_a_resourceopt", "sec_a_profitmatrix"],
    effects: { dataBonus: 15, creditBonus: 10 },
  },
  {
    id: "sec_e_perpetual",
    name: "Perpetual Engine",
    category: "secondary",
    tier: "elite",
    description: "Self-sustaining energy loop reduces all operational costs.",
    maxLevel: 5,
    baseCost: { credits: 400, data: 170 },
    costPerLevel: { credits: 180, data: 80 },
    dependencies: ["sec_a_deepextract", "sec_a_resourceopt", "sec_a_profitmatrix"],
    effects: { energyEfficiency: 12 },
  },
  {
    id: "sec_e_blackmarket",
    name: "Black Market Link",
    category: "secondary",
    tier: "elite",
    description: "Connects to underground markets for premium credit rates.",
    maxLevel: 5,
    baseCost: { credits: 420, data: 200 },
    costPerLevel: { credits: 190, data: 95 },
    dependencies: ["sec_a_deepextract", "sec_a_resourceopt", "sec_a_profitmatrix"],
    effects: { creditBonus: 18, hackPower: 3 },
  },

  // ═══ RELAY (Stealth) ═══
  // Basic
  {
    id: "rel_b_proxy",
    name: "Proxy Chain",
    category: "relay",
    tier: "basic",
    description: "Routes traffic through multiple nodes to obscure origin.",
    maxLevel: 5,
    baseCost: { credits: 50, data: 20 },
    costPerLevel: { credits: 28, data: 14 },
    dependencies: [],
    effects: { stealth: 4 },
  },
  {
    id: "rel_b_spoof",
    name: "Signal Spoofer",
    category: "relay",
    tier: "basic",
    description: "Generates false network signatures to confuse trackers.",
    maxLevel: 5,
    baseCost: { credits: 55, data: 18 },
    costPerLevel: { credits: 30, data: 12 },
    dependencies: [],
    effects: { stealth: 3, detectionReduction: 3 },
  },
  {
    id: "rel_b_lowprofile",
    name: "Low-Profile Mode",
    category: "relay",
    tier: "basic",
    description: "Reduces digital footprint during active operations.",
    maxLevel: 5,
    baseCost: { credits: 45, data: 22 },
    costPerLevel: { credits: 26, data: 15 },
    dependencies: [],
    effects: { detectionReduction: 5 },
  },
  // Advanced
  {
    id: "rel_a_ghostnet",
    name: "Ghost Network",
    category: "relay",
    tier: "advanced",
    description: "Creates an invisible overlay network for operations.",
    maxLevel: 5,
    baseCost: { credits: 150, data: 75 },
    costPerLevel: { credits: 72, data: 38 },
    dependencies: ["rel_b_proxy", "rel_b_spoof", "rel_b_lowprofile"],
    effects: { stealth: 10, detectionReduction: 5 },
  },
  {
    id: "rel_a_meshcloak",
    name: "Mesh Cloak",
    category: "relay",
    tier: "advanced",
    description: "Distributes your signature across thousands of nodes.",
    maxLevel: 5,
    baseCost: { credits: 165, data: 65 },
    costPerLevel: { credits: 78, data: 35 },
    dependencies: ["rel_b_proxy", "rel_b_spoof", "rel_b_lowprofile"],
    effects: { stealth: 8, hackPower: 2 },
  },
  {
    id: "rel_a_darkroute",
    name: "Dark Route",
    category: "relay",
    tier: "advanced",
    description: "Uses encrypted darknet paths that bypass all monitors.",
    maxLevel: 5,
    baseCost: { credits: 155, data: 70 },
    costPerLevel: { credits: 75, data: 36 },
    dependencies: ["rel_b_proxy", "rel_b_spoof", "rel_b_lowprofile"],
    effects: { detectionReduction: 10, energyEfficiency: 2 },
  },
  // Elite
  {
    id: "rel_e_phantom",
    name: "Phantom Protocol",
    category: "relay",
    tier: "elite",
    description: "Renders your AI completely invisible during infiltration.",
    maxLevel: 5,
    baseCost: { credits: 400, data: 210 },
    costPerLevel: { credits: 185, data: 95 },
    dependencies: ["rel_a_ghostnet", "rel_a_meshcloak", "rel_a_darkroute"],
    effects: { stealth: 20, detectionReduction: 15 },
  },
  {
    id: "rel_e_mirage",
    name: "Mirage Engine",
    category: "relay",
    tier: "elite",
    description: "Projects false targets to misdirect security systems.",
    maxLevel: 5,
    baseCost: { credits: 380, data: 200 },
    costPerLevel: { credits: 175, data: 90 },
    dependencies: ["rel_a_ghostnet", "rel_a_meshcloak", "rel_a_darkroute"],
    effects: { stealth: 15, hackPower: 5, detectionReduction: 8 },
  },
  {
    id: "rel_e_void",
    name: "Void Walker",
    category: "relay",
    tier: "elite",
    description: "Operates in the gaps between network packets—undetectable.",
    maxLevel: 5,
    baseCost: { credits: 440, data: 230 },
    costPerLevel: { credits: 200, data: 105 },
    dependencies: ["rel_a_ghostnet", "rel_a_meshcloak", "rel_a_darkroute"],
    effects: { stealth: 18, detectionReduction: 20 },
  },

  // ═══ BACKUP (Defense) ═══
  // Basic
  {
    id: "bak_b_firewall",
    name: "Basic Firewall",
    category: "backup",
    tier: "basic",
    description: "Blocks incoming counter-attacks from alert targets.",
    maxLevel: 5,
    baseCost: { credits: 50, data: 18 },
    costPerLevel: { credits: 28, data: 12 },
    dependencies: [],
    effects: { defense: 5 },
  },
  {
    id: "bak_b_integrity",
    name: "Data Integrity Check",
    category: "backup",
    tier: "basic",
    description: "Prevents data corruption from hostile countermeasures.",
    maxLevel: 5,
    baseCost: { credits: 45, data: 22 },
    costPerLevel: { credits: 25, data: 14 },
    dependencies: [],
    effects: { defense: 3, dataBonus: 1 },
  },
  {
    id: "bak_b_autorestore",
    name: "Auto-Restore",
    category: "backup",
    tier: "basic",
    description: "Automatically repairs minor system damage after operations.",
    maxLevel: 5,
    baseCost: { credits: 55, data: 15 },
    costPerLevel: { credits: 30, data: 10 },
    dependencies: [],
    effects: { defense: 4 },
  },
  // Advanced
  {
    id: "bak_a_hardshell",
    name: "Hardened Shell",
    category: "backup",
    tier: "advanced",
    description: "Multi-layered protection against detection consequences.",
    maxLevel: 5,
    baseCost: { credits: 150, data: 70 },
    costPerLevel: { credits: 72, data: 36 },
    dependencies: ["bak_b_firewall", "bak_b_integrity", "bak_b_autorestore"],
    effects: { defense: 10 },
  },
  {
    id: "bak_a_redundancy",
    name: "System Redundancy",
    category: "backup",
    tier: "advanced",
    description: "Duplicates critical systems to survive heavy damage.",
    maxLevel: 5,
    baseCost: { credits: 165, data: 65 },
    costPerLevel: { credits: 78, data: 34 },
    dependencies: ["bak_b_firewall", "bak_b_integrity", "bak_b_autorestore"],
    effects: { defense: 8, energyEfficiency: 2 },
  },
  {
    id: "bak_a_countermeasure",
    name: "Active Countermeasure",
    category: "backup",
    tier: "advanced",
    description: "Strikes back at security systems that detect you.",
    maxLevel: 5,
    baseCost: { credits: 175, data: 60 },
    costPerLevel: { credits: 82, data: 32 },
    dependencies: ["bak_b_firewall", "bak_b_integrity", "bak_b_autorestore"],
    effects: { defense: 6, hackPower: 4 },
  },
  // Elite
  {
    id: "bak_e_fortress",
    name: "Digital Fortress",
    category: "backup",
    tier: "elite",
    description: "Impenetrable defense matrix that absorbs all damage.",
    maxLevel: 5,
    baseCost: { credits: 420, data: 200 },
    costPerLevel: { credits: 190, data: 92 },
    dependencies: ["bak_a_hardshell", "bak_a_redundancy", "bak_a_countermeasure"],
    effects: { defense: 22 },
  },
  {
    id: "bak_e_regen",
    name: "Regeneration Matrix",
    category: "backup",
    tier: "elite",
    description: "Nanoscale repair systems that heal damage in real-time.",
    maxLevel: 5,
    baseCost: { credits: 400, data: 210 },
    costPerLevel: { credits: 185, data: 95 },
    dependencies: ["bak_a_hardshell", "bak_a_redundancy", "bak_a_countermeasure"],
    effects: { defense: 18, energyEfficiency: 5 },
  },
  {
    id: "bak_e_aegis",
    name: "Aegis Protocol",
    category: "backup",
    tier: "elite",
    description: "Ultimate defense: renders your core systems untouchable.",
    maxLevel: 5,
    baseCost: { credits: 450, data: 220 },
    costPerLevel: { credits: 200, data: 100 },
    dependencies: ["bak_a_hardshell", "bak_a_redundancy", "bak_a_countermeasure"],
    effects: { defense: 25, stealth: 5 },
  },
];

export const MODULE_MAP: Record<string, ModuleDefinition> = Object.fromEntries(
  ALL_MODULES.map((m) => [m.id, m])
);
