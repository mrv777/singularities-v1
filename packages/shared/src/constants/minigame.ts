import type { TargetType } from "./scanner.js";

// ---------------------------------------------------------------------------
// Game types
// ---------------------------------------------------------------------------

export const MINIGAME_TYPES = ["signal_crack", "port_sweep", "network_relink"] as const;
export type MinigameType = (typeof MINIGAME_TYPES)[number];

export const MINIGAME_LABELS: Record<MinigameType, string> = {
  signal_crack: "Signal Crack",
  port_sweep: "Port Sweep",
  network_relink: "Network Relink",
};

export const MINIGAME_DESCRIPTIONS: Record<MinigameType, string> = {
  signal_crack: "Break the encrypted code using positional feedback",
  port_sweep: "Probe the grid to locate hidden open ports",
  network_relink: "Reconnect severed network links by drawing paths",
};

// ---------------------------------------------------------------------------
// Target type → game type mapping
// ---------------------------------------------------------------------------

export const TARGET_GAME_MAP: Record<TargetType, MinigameType> = {
  financial: "signal_crack",
  corporate: "signal_crack",
  government: "signal_crack",
  military: "port_sweep",
  infrastructure: "port_sweep",
  database: "network_relink",
  research: "network_relink",
};

// ---------------------------------------------------------------------------
// Difficulty tiers by security level
// ---------------------------------------------------------------------------

export interface SignalCrackDifficulty {
  codeLength: number;
  digitPool: number;
  maxGuesses: number;
  allowRepeats: boolean;
  timeLimitMs: number;
}

export interface PortSweepDifficulty {
  gridSize: number;
  portCount: number;
  maxProbes: number;
  timeLimitMs: number;
}

export interface NetworkRelinkDifficulty {
  gridSize: number;
  pairs: number;
  timeLimitMs: number;
}

// Security brackets: [minSecurity, maxSecurity]
type Bracket = [number, number];

const BRACKETS: Bracket[] = [
  [14, 29],
  [30, 54],
  [55, 74],
  [75, 95],
];

const SIGNAL_CRACK_TABLE: SignalCrackDifficulty[] = [
  { codeLength: 3, digitPool: 6, maxGuesses: 9, allowRepeats: false, timeLimitMs: 60_000 },
  { codeLength: 4, digitPool: 7, maxGuesses: 8, allowRepeats: false, timeLimitMs: 60_000 },
  { codeLength: 4, digitPool: 8, maxGuesses: 7, allowRepeats: false, timeLimitMs: 60_000 },
  { codeLength: 5, digitPool: 8, maxGuesses: 7, allowRepeats: false, timeLimitMs: 60_000 },
];

const PORT_SWEEP_TABLE: PortSweepDifficulty[] = [
  { gridSize: 5, portCount: 3, maxProbes: 15, timeLimitMs: 90_000 },
  { gridSize: 6, portCount: 5, maxProbes: 18, timeLimitMs: 90_000 },
  { gridSize: 7, portCount: 6, maxProbes: 21, timeLimitMs: 90_000 },
  { gridSize: 8, portCount: 8, maxProbes: 22, timeLimitMs: 90_000 },
];

const NETWORK_RELINK_TABLE: NetworkRelinkDifficulty[] = [
  { gridSize: 5, pairs: 4, timeLimitMs: 90_000 },
  { gridSize: 6, pairs: 5, timeLimitMs: 90_000 },
  { gridSize: 7, pairs: 7, timeLimitMs: 90_000 },
  { gridSize: 8, pairs: 9, timeLimitMs: 90_000 },
];

function bracketIndex(securityLevel: number): number {
  for (let i = BRACKETS.length - 1; i >= 0; i--) {
    if (securityLevel >= BRACKETS[i][0]) return i;
  }
  return 0;
}

export function getSignalCrackDifficulty(securityLevel: number): SignalCrackDifficulty {
  return SIGNAL_CRACK_TABLE[bracketIndex(securityLevel)];
}

export function getPortSweepDifficulty(securityLevel: number): PortSweepDifficulty {
  return PORT_SWEEP_TABLE[bracketIndex(securityLevel)];
}

export function getNetworkRelinkDifficulty(securityLevel: number): NetworkRelinkDifficulty {
  return NETWORK_RELINK_TABLE[bracketIndex(securityLevel)];
}

// ---------------------------------------------------------------------------
// Scoring formulas
// ---------------------------------------------------------------------------

/** Signal Crack: Solved = 50-100% (efficiency bonus). Not solved = 0%. */
export function scoreSignalCrack(guessesUsed: number, maxGuesses: number, solved: boolean): number {
  if (!solved) return 0;
  if (maxGuesses <= 1) return 100;
  // Cracking the code always guarantees at least 50% (the success threshold).
  // Efficiency determines the bonus: first-guess solve = 100%, last-guess = 50%.
  const efficiency = (maxGuesses - guessesUsed) / (maxGuesses - 1);
  return Math.round(50 + 50 * efficiency);
}

/** Port Sweep: (portsFound/totalPorts) * 50 + probeEfficiency * 50 */
export function scorePortSweep(
  portsFound: number,
  totalPorts: number,
  probesUsed: number,
  maxProbes: number
): number {
  if (probesUsed === 0) return 0;
  const findScore = totalPorts > 0 ? (portsFound / totalPorts) * 50 : 0;
  const efficiency = maxProbes > 0 ? Math.max(0, 1 - (probesUsed - portsFound) / Math.max(1, maxProbes - portsFound)) : 0;
  const efficiencyScore = efficiency * 50;
  return Math.round(Math.min(100, findScore + efficiencyScore));
}

/** Network Relink: 60% for connected pairs + up to 40% for grid coverage (time-gated) */
export function scoreNetworkRelink(
  connectedPairs: number,
  totalPairs: number,
  filledCells: number,
  totalCells: number,
  elapsedMs: number,
  timeLimitMs: number,
): number {
  const graceMs = totalPairs * 2_000;
  const timeEfficiency = timeLimitMs > graceMs
    ? Math.max(0, 1 - Math.max(0, elapsedMs - graceMs) / (timeLimitMs - graceMs))
    : 1;
  const pairsScore = totalPairs > 0 ? (connectedPairs / totalPairs) * 60 : 0;
  const coverageScore = totalCells > 0 ? (filledCells / totalCells) * timeEfficiency * 40 : 0;
  return Math.round(pairsScore + coverageScore);
}

// ---------------------------------------------------------------------------
// Gradient reward multiplier
// ---------------------------------------------------------------------------

/**
 * Reward multiplier by score.
 * - 0% => 0 (no payout for no/failed participation)
 * - 1-24% => up to 8% (token consolation only)
 * - 25-49% => ramps to ~70%
 * - 50-100% => unchanged high-performance range (70%..125%)
 */
export function getScoreMultiplier(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped === 0) return 0;
  if (clamped < 25) {
    return (clamped / 25) * 0.08;
  }
  if (clamped < 50) {
    return 0.08 + ((clamped - 25) / 25) * 0.62;
  }
  return 0.70 + ((clamped - 50) / 50) * 0.55;
}

// ---------------------------------------------------------------------------
// Detection thresholds based on score
// ---------------------------------------------------------------------------

/** Returns detection multiplier: >= 50% = 0 (safe), 25-49% = 0.5, 0-24% = 1.0 */
export function getDetectionMultiplier(score: number): number {
  if (score >= 50) return 0;
  if (score >= 25) return 0.5;
  return 1.0;
}

// ---------------------------------------------------------------------------
// Balance constants
// ---------------------------------------------------------------------------

export const MINIGAME_BALANCE = {
  /** Base rewards are ~3x current scanner values since only 1 target per scan */
  rewardMultiplier: 3,
  /** Global scalar applied to credits, data, and XP minigame rewards */
  globalRewardMultiplier: 1.2,
  /** Credits & data multipliers by tier [T0, T1, T2, T3] — XP/rep stay at rewardMultiplier */
  economicMultiplierByTier: [1.45, 1.75, 1.95, 2.15] as const,
  /** Minimum score to earn processing power */
  processingPowerScoreThreshold: 75,
  /** Minimum security for processing power drop */
  processingPowerSecurityThreshold: 65,
  /** Redis TTL for active game state (10 minutes) */
  gameTtlSeconds: 600,
  /**
   * Keep unresolved state around long enough to force explicit resolution.
   * Gameplay still uses `gameTtlSeconds`; this only controls Redis retention.
   */
  gameStateRetentionSeconds: 2_592_000,
  /** Energy cost covered entirely by SCAN_ENERGY_COST; no separate per-hack cost */
  energyCost: 0,
} as const;

// ---------------------------------------------------------------------------
// Modifiers
// ---------------------------------------------------------------------------

export type SignalCrackModifier = "blackout" | "corrupted";
export type PortSweepModifier = "decoys" | "mines";
export type NetworkRelinkModifier = "relay" | "interference";
export type MinigameModifier = SignalCrackModifier | PortSweepModifier | NetworkRelinkModifier;

export const MODIFIER_LABELS: Record<MinigameModifier, string> = {
  blackout: "Blackout",
  corrupted: "Corrupted",
  decoys: "Decoys",
  mines: "Mines",
  relay: "Relay",
  interference: "Interference",
};

export const MODIFIER_DESCRIPTIONS: Record<MinigameModifier, string> = {
  blackout: "Possibilities counter hidden",
  corrupted: "One feedback digit per guess is corrupted",
  decoys: "Some non-port cells appear as hits",
  mines: "Some non-port cells cost 2 probes on miss",
  relay: "Paths must pass through relay nodes",
  interference: "Some cells are permanently blocked",
};

export const MODIFIER_ROLL = {
  /** Chance to get any modifier at T2 */
  T2_CHANCE: 0.60,
  /** Chance to get any modifier at T3 */
  T3_CHANCE: 0.75,
  /** At T3, probability to roll the T3-specific modifier vs the T2 modifier */
  T3_WEIGHT_OWN: 0.80,
} as const;

// ---------------------------------------------------------------------------
// Network Relink colors (cyberpunk neon, up to 9 pairs)
// ---------------------------------------------------------------------------

export const RELINK_COLORS = [
  "#00ff88", "#ff00ff", "#00ccff", "#ff6600", "#ffff00",
  "#ff3366", "#9933ff", "#33ff99", "#ff9933",
] as const;
