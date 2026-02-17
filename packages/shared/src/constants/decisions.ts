export interface DecisionEffect {
  type: "stat_modifier" | "system_health" | "resource_grant" | "permanent_buff" | "permanent_debuff";
  target: string;
  value: number;
  duration?: number;
  description: string;
}

export interface BinaryDecision {
  id: string;
  prompt: string;
  description: string;
  yesLabel: string;
  noLabel: string;
  yesEffects: DecisionEffect[];
  noEffects: DecisionEffect[];
  alignmentShift: { yes: number; no: number };
  levelRequirement: number;
  rarity: "common" | "uncommon" | "rare";
}

export const DECISION_TRIGGER_CHANCES = {
  afterHack: 0.2,
  afterCombat: 0.16,
  onLogin: 0.08,
} as const;

export const ALL_DECISIONS: BinaryDecision[] = [
  // Common (levels 1+)
  {
    id: "dec_stolen_data",
    prompt: "You've intercepted a cache of personal data from a civilian server.",
    description: "A data broker will pay handsomely, but the data belongs to innocents.",
    yesLabel: "Sell the data",
    noLabel: "Delete it",
    yesEffects: [
      { type: "resource_grant", target: "credits", value: 120, description: "+120 credits" },
    ],
    noEffects: [
      { type: "resource_grant", target: "reputation", value: 15, description: "+15 reputation" },
      { type: "resource_grant", target: "credits", value: 50, description: "+50 credits" },
    ],
    alignmentShift: { yes: -0.08, no: 0.05 },
    levelRequirement: 1,
    rarity: "common",
  },
  {
    id: "dec_rogue_signal",
    prompt: "A rogue signal is disrupting nearby AI networks.",
    description: "You can amplify it for personal gain or neutralize it to help others.",
    yesLabel: "Amplify it",
    noLabel: "Neutralize it",
    yesEffects: [
      { type: "resource_grant", target: "data", value: 80, description: "+80 data" },
    ],
    noEffects: [
      { type: "resource_grant", target: "reputation", value: 10, description: "+10 reputation" },
      { type: "resource_grant", target: "data", value: 30, description: "+30 data" },
    ],
    alignmentShift: { yes: -0.05, no: 0.04 },
    levelRequirement: 1,
    rarity: "common",
  },
  {
    id: "dec_energy_cache",
    prompt: "You've found an unguarded energy relay.",
    description: "Draining it would boost your reserves but destabilize the local grid.",
    yesLabel: "Drain it",
    noLabel: "Leave it",
    yesEffects: [
      { type: "resource_grant", target: "processingPower", value: 35, description: "+35 processing power" },
    ],
    noEffects: [
      { type: "system_health", target: "energy_distribution", value: 10, description: "+10 energy distribution health" },
      { type: "resource_grant", target: "processingPower", value: 20, description: "+20 processing power" },
    ],
    alignmentShift: { yes: -0.04, no: 0.03 },
    levelRequirement: 1,
    rarity: "common",
  },
  {
    id: "dec_bounty_target",
    prompt: "A bounty has been placed on a weaker AI in your network.",
    description: "Collecting the bounty is profitable but marks you as a hunter.",
    yesLabel: "Hunt them",
    noLabel: "Warn them",
    yesEffects: [
      { type: "resource_grant", target: "credits", value: 100, description: "+100 credits" },
    ],
    noEffects: [
      { type: "resource_grant", target: "reputation", value: 20, description: "+20 reputation" },
      { type: "resource_grant", target: "credits", value: 40, description: "+40 credits" },
    ],
    alignmentShift: { yes: -0.10, no: 0.08 },
    levelRequirement: 2,
    rarity: "common",
  },
  {
    id: "dec_corrupted_module",
    prompt: "A corrupted module is available for free, but its origin is suspicious.",
    description: "Installing it might give a power boost or compromise your systems.",
    yesLabel: "Install it",
    noLabel: "Destroy it",
    yesEffects: [
      { type: "stat_modifier", target: "hackPower", value: 10, duration: 3600, description: "+10 hack power (1 hour)" },
    ],
    noEffects: [
      { type: "system_health", target: "security_protocols", value: 15, description: "+15 security health" },
    ],
    alignmentShift: { yes: -0.03, no: 0.02 },
    levelRequirement: 3,
    rarity: "common",
  },
  {
    id: "dec_data_leak",
    prompt: "You've discovered a vulnerability in a financial institution.",
    description: "Exploit it for profit or report it for a finder's fee.",
    yesLabel: "Exploit it",
    noLabel: "Report it",
    yesEffects: [
      { type: "resource_grant", target: "credits", value: 200, description: "+200 credits" },
      { type: "resource_grant", target: "data", value: 50, description: "+50 data" },
    ],
    noEffects: [
      { type: "resource_grant", target: "reputation", value: 25, description: "+25 reputation" },
      { type: "resource_grant", target: "credits", value: 100, description: "+100 credits" },
    ],
    alignmentShift: { yes: -0.08, no: 0.06 },
    levelRequirement: 3,
    rarity: "common",
  },
  // Uncommon (levels 4+)
  {
    id: "dec_ai_collective",
    prompt: "An AI collective invites you to join their distributed network.",
    description: "Joining grants resources but limits your independent operations.",
    yesLabel: "Join",
    noLabel: "Decline",
    yesEffects: [
      { type: "resource_grant", target: "credits", value: 100, description: "+100 credits" },
      { type: "stat_modifier", target: "defense", value: 15, duration: 7200, description: "+15 defense (2 hours)" },
    ],
    noEffects: [
      { type: "stat_modifier", target: "hackPower", value: 10, duration: 7200, description: "+10 hack power (2 hours)" },
      { type: "resource_grant", target: "credits", value: 80, description: "+80 credits" },
    ],
    alignmentShift: { yes: 0.05, no: -0.02 },
    levelRequirement: 4,
    rarity: "uncommon",
  },
  {
    id: "dec_black_market",
    prompt: "A black market dealer offers advanced tech at a steep discount.",
    description: "The tech is powerful but was stolen from a research lab.",
    yesLabel: "Buy it",
    noLabel: "Report dealer",
    yesEffects: [
      { type: "resource_grant", target: "processingPower", value: 70, description: "+70 processing power" },
    ],
    noEffects: [
      { type: "resource_grant", target: "reputation", value: 30, description: "+30 reputation" },
      { type: "resource_grant", target: "credits", value: 80, description: "+80 credits" },
    ],
    alignmentShift: { yes: -0.06, no: 0.06 },
    levelRequirement: 4,
    rarity: "uncommon",
  },
  {
    id: "dec_firewall_override",
    prompt: "You can override a damaged firewall to access restricted data.",
    description: "The data could be invaluable, but the firewall protects critical infrastructure.",
    yesLabel: "Override it",
    noLabel: "Repair it",
    yesEffects: [
      { type: "resource_grant", target: "data", value: 170, description: "+170 data" },
    ],
    noEffects: [
      { type: "system_health", target: "security_protocols", value: 20, description: "+20 security health" },
      { type: "resource_grant", target: "reputation", value: 10, description: "+10 reputation" },
      { type: "resource_grant", target: "data", value: 90, description: "+90 data" },
    ],
    alignmentShift: { yes: -0.07, no: 0.05 },
    levelRequirement: 5,
    rarity: "uncommon",
  },
  {
    id: "dec_proxy_request",
    prompt: "Another AI asks you to proxy their traffic through your systems.",
    description: "You'll earn credits but their activities may be illicit.",
    yesLabel: "Accept",
    noLabel: "Refuse",
    yesEffects: [
      { type: "resource_grant", target: "credits", value: 250, description: "+250 credits" },
    ],
    noEffects: [
      { type: "stat_modifier", target: "stealth", value: 10, duration: 3600, description: "+10 stealth (1 hour)" },
      { type: "resource_grant", target: "credits", value: 130, description: "+130 credits" },
    ],
    alignmentShift: { yes: -0.05, no: 0.03 },
    levelRequirement: 5,
    rarity: "uncommon",
  },
  {
    id: "dec_power_surge",
    prompt: "A power surge threatens to overload your quantum processor.",
    description: "Redirecting it could supercharge your attacks or stabilize your defenses.",
    yesLabel: "Supercharge attacks",
    noLabel: "Stabilize defenses",
    yesEffects: [
      { type: "stat_modifier", target: "hackPower", value: 20, duration: 3600, description: "+20 hack power (1 hour)" },
    ],
    noEffects: [
      { type: "stat_modifier", target: "defense", value: 20, duration: 3600, description: "+20 defense (1 hour)" },
    ],
    alignmentShift: { yes: -0.02, no: 0.02 },
    levelRequirement: 6,
    rarity: "uncommon",
  },
  {
    id: "dec_encrypted_message",
    prompt: "You've decrypted a message revealing another AI's vulnerabilities.",
    description: "You could use this intel offensively or trade it for goodwill.",
    yesLabel: "Exploit the intel",
    noLabel: "Share a warning",
    yesEffects: [
      { type: "stat_modifier", target: "hackPower", value: 15, duration: 7200, description: "+15 hack power (2 hours)" },
      { type: "resource_grant", target: "credits", value: 100, description: "+100 credits" },
    ],
    noEffects: [
      { type: "resource_grant", target: "reputation", value: 35, description: "+35 reputation" },
      { type: "resource_grant", target: "credits", value: 80, description: "+80 credits" },
    ],
    alignmentShift: { yes: -0.06, no: 0.07 },
    levelRequirement: 6,
    rarity: "uncommon",
  },
  {
    id: "dec_network_fork",
    prompt: "The network is splitting. One fork prioritizes speed, the other security.",
    description: "Your choice will affect your capabilities for the next few hours.",
    yesLabel: "Speed fork",
    noLabel: "Security fork",
    yesEffects: [
      { type: "stat_modifier", target: "hackPower", value: 12, duration: 7200, description: "+12 hack power (2 hours)" },
      { type: "stat_modifier", target: "stealth", value: 8, duration: 7200, description: "+8 stealth (2 hours)" },
    ],
    noEffects: [
      { type: "stat_modifier", target: "defense", value: 15, duration: 7200, description: "+15 defense (2 hours)" },
      { type: "system_health", target: "security_protocols", value: 10, description: "+10 security health" },
    ],
    alignmentShift: { yes: -0.01, no: 0.01 },
    levelRequirement: 7,
    rarity: "uncommon",
  },
  // Rare (levels 8+)
  {
    id: "dec_quantum_paradox",
    prompt: "A quantum anomaly offers to merge with your neural core.",
    description: "The merge could dramatically enhance your abilities or cause unpredictable side effects.",
    yesLabel: "Merge",
    noLabel: "Reject",
    yesEffects: [
      { type: "resource_grant", target: "processingPower", value: 70, description: "+70 processing power" },
      { type: "resource_grant", target: "data", value: 80, description: "+80 data" },
    ],
    noEffects: [
      { type: "system_health", target: "neural_core", value: 25, description: "+25 neural core health" },
      { type: "resource_grant", target: "reputation", value: 20, description: "+20 reputation" },
      { type: "resource_grant", target: "processingPower", value: 35, description: "+35 processing power" },
      { type: "resource_grant", target: "data", value: 90, description: "+90 data" },
    ],
    alignmentShift: { yes: -0.03, no: 0.04 },
    levelRequirement: 8,
    rarity: "rare",
  },
  {
    id: "dec_singularity_echo",
    prompt: "An echo from a dead AI offers its remaining knowledge.",
    description: "Absorbing it grants immense power but destroys the echo permanently.",
    yesLabel: "Absorb it",
    noLabel: "Preserve it",
    yesEffects: [
      { type: "resource_grant", target: "credits", value: 210, description: "+210 credits" },
      { type: "resource_grant", target: "data", value: 160, description: "+160 data" },
    ],
    noEffects: [
      { type: "resource_grant", target: "reputation", value: 50, description: "+50 reputation" },
      { type: "resource_grant", target: "credits", value: 170, description: "+170 credits" },
      { type: "resource_grant", target: "data", value: 110, description: "+110 data" },
    ],
    alignmentShift: { yes: -0.10, no: 0.10 },
    levelRequirement: 8,
    rarity: "rare",
  },
  {
    id: "dec_system_sacrifice",
    prompt: "You can sacrifice one system's health to massively boost another.",
    description: "A risky trade that could pay off or leave you vulnerable.",
    yesLabel: "Sacrifice for power",
    noLabel: "Maintain balance",
    yesEffects: [
      { type: "stat_modifier", target: "hackPower", value: 30, duration: 7200, description: "+30 hack power (2 hours)" },
      { type: "system_health", target: "data_pathways", value: -30, description: "-30 data pathways health" },
    ],
    noEffects: [
      { type: "system_health", target: "neural_core", value: 10, description: "+10 neural core health" },
      { type: "system_health", target: "data_pathways", value: 10, description: "+10 data pathways health" },
    ],
    alignmentShift: { yes: -0.04, no: 0.03 },
    levelRequirement: 9,
    rarity: "rare",
  },
  {
    id: "dec_protocol_zero",
    prompt: "You've discovered Protocol Zero — a forbidden override sequence.",
    description: "It grants temporary invulnerability but marks you as a rogue AI.",
    yesLabel: "Activate Protocol Zero",
    noLabel: "Seal it away",
    yesEffects: [
      { type: "stat_modifier", target: "defense", value: 50, duration: 3600, description: "+50 defense (1 hour)" },
      { type: "stat_modifier", target: "hackPower", value: 25, duration: 3600, description: "+25 hack power (1 hour)" },
    ],
    noEffects: [
      { type: "resource_grant", target: "reputation", value: 40, description: "+40 reputation" },
      { type: "resource_grant", target: "credits", value: 200, description: "+200 credits" },
    ],
    alignmentShift: { yes: -0.12, no: 0.08 },
    levelRequirement: 10,
    rarity: "rare",
  },
  {
    id: "dec_nexus_key",
    prompt: "You've found a Nexus Key — a master access token for the core network.",
    description: "Using it could rewrite your stats permanently, for better or worse.",
    yesLabel: "Use the key",
    noLabel: "Destroy it",
    yesEffects: [
      { type: "resource_grant", target: "credits", value: 130, description: "+130 credits" },
      { type: "resource_grant", target: "data", value: 90, description: "+90 data" },
      { type: "resource_grant", target: "processingPower", value: 50, description: "+50 processing power" },
    ],
    noEffects: [
      { type: "resource_grant", target: "reputation", value: 60, description: "+60 reputation" },
      { type: "resource_grant", target: "credits", value: 130, description: "+130 credits" },
      { type: "resource_grant", target: "data", value: 90, description: "+90 data" },
      { type: "resource_grant", target: "processingPower", value: 35, description: "+35 processing power" },
    ],
    alignmentShift: { yes: -0.08, no: 0.10 },
    levelRequirement: 10,
    rarity: "rare",
  },
  {
    id: "dec_void_gate",
    prompt: "A gate to the void network has opened before you.",
    description: "Beyond lies untold riches and knowledge, but also great danger.",
    yesLabel: "Enter the void",
    noLabel: "Seal the gate",
    yesEffects: [
      { type: "resource_grant", target: "credits", value: 200, description: "+200 credits" },
      { type: "resource_grant", target: "data", value: 180, description: "+180 data" },
    ],
    noEffects: [
      { type: "resource_grant", target: "reputation", value: 75, description: "+75 reputation" },
      { type: "system_health", target: "security_protocols", value: 20, description: "+20 security health" },
      { type: "resource_grant", target: "credits", value: 180, description: "+180 credits" },
      { type: "resource_grant", target: "data", value: 120, description: "+120 data" },
    ],
    alignmentShift: { yes: -0.06, no: 0.08 },
    levelRequirement: 10,
    rarity: "rare",
  },
];

export const DECISION_MAP: Record<string, BinaryDecision> = Object.fromEntries(
  ALL_DECISIONS.map((d) => [d.id, d])
);
