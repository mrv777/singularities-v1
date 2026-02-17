import type { SystemType } from "../types/player.js";

// Which systems are adjacent — cascade damage propagates to these
export const SYSTEM_ADJACENCY: Record<SystemType, SystemType[]> = {
  neural_core: ["memory_banks", "quantum_processor"],
  memory_banks: ["neural_core", "data_pathways"],
  quantum_processor: ["neural_core", "energy_distribution"],
  security_protocols: ["data_pathways", "energy_distribution"],
  data_pathways: ["memory_banks", "security_protocols"],
  energy_distribution: ["quantum_processor", "security_protocols"],
};

// System labels for UI
export const SYSTEM_DESCRIPTIONS: Record<SystemType, string> = {
  neural_core: "Primary processing unit. Affects all cognitive functions.",
  memory_banks: "Data storage and retrieval. Links to pathways and core.",
  quantum_processor: "Advanced computation. Connects core and energy.",
  security_protocols: "Intrusion defense. Guards pathways and energy.",
  data_pathways: "Information routing. Bridges memory and security.",
  energy_distribution: "Power management. Feeds processor and security.",
};

// Degradation: health points lost per hour (before modifiers)
export const DEGRADATION_RATE_PER_HOUR = 1.15;

// Cascade: damage dealt to adjacent systems when a system is CRITICAL
export const CASCADE_DAMAGE_PER_TICK = 3; // per adjacent system per 30-min tick
