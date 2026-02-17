import type { SystemType, SystemStatus } from "../types/player.js";

export const SYSTEM_TYPES: SystemType[] = [
  "neural_core",
  "memory_banks",
  "quantum_processor",
  "security_protocols",
  "data_pathways",
  "energy_distribution",
];

export const SYSTEM_LABELS: Record<SystemType, string> = {
  neural_core: "Neural Core",
  memory_banks: "Memory Banks",
  quantum_processor: "Quantum Processor",
  security_protocols: "Security Protocols",
  data_pathways: "Data Pathways",
  energy_distribution: "Energy Distribution",
};

export const SYSTEM_STATUS_THRESHOLDS: Record<
  SystemStatus,
  { min: number; max: number }
> = {
  OPTIMAL: { min: 75, max: 100 },
  DEGRADED: { min: 30, max: 74 },
  CRITICAL: { min: 1, max: 29 },
  CORRUPTED: { min: 0, max: 0 },
};

export const CASCADE_THRESHOLD = 30; // Below this, cascade begins
export const DEATH_CORRUPTED_COUNT = 3; // 3+ corrupted systems = death
export const DEATH_MODULE_RECOVERY_CHANCE = 0.65;
