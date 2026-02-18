import crypto from "node:crypto";
import { redis } from "../db/redis.js";
import { query, withTransaction } from "../db/pool.js";
import { computeEnergy, mapPlayerRow } from "./player.js";
import { resolveLoadoutStats, type ResolvedStats } from "./stats.js";
import { computeSystemHealth } from "./maintenance.js";
import { awardXP } from "./progression.js";
import { getSeasonCatchUpBonuses } from "./seasons.js";
import { triggerDecision } from "./decisions.js";
import { shiftAlignment } from "./alignment.js";
import { sendActivity } from "./ws.js";
import { acquireLock, releaseLock } from "../worker/lock.js";
import { env } from "../lib/env.js";
import {
  type ScanTarget,
  type MinigameType,
  type SignalCrackFeedback,
  type SignalCrackMoveResult,
  type PortSweepMoveResult,
  type NetworkRelinkMoveResult,
  type GameMoveResult,
  type GameConfig,
  type SignalCrackConfig,
  type PortSweepConfig,
  type NetworkRelinkConfig,
  type GameMove,
  getSignalCrackDifficulty,
  getPortSweepDifficulty,
  getNetworkRelinkDifficulty,
  getDetectionMultiplier,
  MINIGAME_BALANCE,
  SCANNER_BALANCE,
  getBaseReward,
  getHeatDamageConfig,
  SYSTEM_STATUS_THRESHOLDS,
  ALIGNMENT_SHIFTS,
  HOOK_BALANCE,
  pickTemplate,
  fillTemplate,
  HACK_SUCCESS_TEMPLATES,
  HACK_SUCCESS_TRACED_TEMPLATES,
  HACK_FAIL_UNDETECTED_TEMPLATES,
  HACK_FAIL_DETECTED_TEMPLATES,
} from "@singularities/shared";

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

const GAME_KEY = (pid: string) => `minigame:${pid}`;
const LOCK_KEY = (pid: string) => `minigame:${pid}`;

// ---------------------------------------------------------------------------
// PRNG — xorshift128 seeded from VRF bytes
// ---------------------------------------------------------------------------

class Xorshift128 {
  private s: Uint32Array;

  constructor(seed: Uint8Array) {
    // Interpret first 16 bytes as four 32-bit seeds
    const view = new DataView(seed.buffer, seed.byteOffset, Math.min(seed.byteLength, 16));
    this.s = new Uint32Array(4);
    for (let i = 0; i < 4; i++) {
      this.s[i] = i * 4 < view.byteLength ? view.getUint32(i * 4, true) : (i + 1) * 0x9e3779b9;
    }
    // Ensure not all zero
    if (this.s.every((v) => v === 0)) this.s[0] = 1;
  }

  next(): number {
    let t = this.s[3];
    const s = this.s[0];
    this.s[3] = this.s[2];
    this.s[2] = this.s[1];
    this.s[1] = s;
    t ^= t << 11;
    t ^= t >>> 8;
    this.s[0] = t ^ s ^ (s >>> 19);
    return this.s[0] >>> 0;
  }

  /** Random integer in [min, max] inclusive */
  int(min: number, max: number): number {
    const range = max - min + 1;
    return min + (this.next() % range);
  }

  /** Shuffle array in-place (Fisher-Yates) */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.next() % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class MinigameError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "MinigameError";
  }
}

// ---------------------------------------------------------------------------
// Internal game state (stored in Redis, never sent to client)
// ---------------------------------------------------------------------------

interface BaseGameState {
  gameType: MinigameType;
  playerId: string;
  targetIndex: number;
  target: ScanTarget;
  startedAt: number; // epoch ms
  expiresAt: number; // epoch ms
  stats: {
    hackPower: number;
    stealth: number;
    defense: number;
    creditBonus: number;
    dataBonus: number;
    detectionReduction: number;
    healthMultiplier: number;
    hackRewardMultiplier: number;
    xpGainMultiplier: number;
    detectionChanceMultiplier: number;
  };
  moveHistory: GameMoveResult[];
  resolved: boolean;
  seed: string; // hex-encoded VRF seed
}

interface SignalCrackState extends BaseGameState {
  gameType: "signal_crack";
  secret: number[];
  guessesUsed: number;
  solved: boolean;
  /** All guesses submitted so far (needed for possibilities counter) */
  guesses: number[][];
  /** All feedbacks for each guess */
  feedbacks: SignalCrackFeedback[][];
  config: SignalCrackConfig;
}

interface PortSweepState extends BaseGameState {
  gameType: "port_sweep";
  /** Flat set of port positions as "row,col" strings */
  ports: string[];
  probesUsed: number;
  portsFound: number;
  /** Cells already probed (to prevent re-probing) */
  probed: string[];
  config: PortSweepConfig;
}

interface NetworkRelinkState extends BaseGameState {
  gameType: "network_relink";
  /** The full Hamiltonian path as [row, col] cells in order */
  solutionPath: [number, number][];
  /** Segment endpoints: [pairIndex] => [[r,c], [r,c]] */
  endpoints: Array<[[number, number], [number, number]]>;
  /** Number of pairs */
  totalPairs: number;
  /** Whether solution has been submitted */
  submitted: boolean;
  config: NetworkRelinkConfig;
}

type GameState = SignalCrackState | PortSweepState | NetworkRelinkState;

// ---------------------------------------------------------------------------
// Puzzle generation
// ---------------------------------------------------------------------------

function generateSignalCrackPuzzle(rng: Xorshift128, securityLevel: number): {
  secret: number[];
  config: SignalCrackConfig;
} {
  const diff = getSignalCrackDifficulty(securityLevel);
  const secret: number[] = [];

  if (diff.allowRepeats) {
    for (let i = 0; i < diff.codeLength; i++) {
      secret.push(rng.int(0, diff.digitPool - 1));
    }
  } else {
    const pool = Array.from({ length: diff.digitPool }, (_, i) => i);
    rng.shuffle(pool);
    for (let i = 0; i < diff.codeLength; i++) {
      secret.push(pool[i]);
    }
  }

  return {
    secret,
    config: {
      type: "signal_crack",
      codeLength: diff.codeLength,
      digitPool: diff.digitPool,
      maxGuesses: diff.maxGuesses,
      timeLimitMs: diff.timeLimitMs,
    },
  };
}

function generatePortSweepPuzzle(rng: Xorshift128, securityLevel: number): {
  ports: string[];
  config: PortSweepConfig;
} {
  const diff = getPortSweepDifficulty(securityLevel);
  const allCells: string[] = [];
  for (let r = 0; r < diff.gridSize; r++) {
    for (let c = 0; c < diff.gridSize; c++) {
      allCells.push(`${r},${c}`);
    }
  }
  rng.shuffle(allCells);
  const ports = allCells.slice(0, diff.portCount);

  return {
    ports,
    config: {
      type: "port_sweep",
      gridSize: diff.gridSize,
      portCount: diff.portCount,
      maxProbes: diff.maxProbes,
      timeLimitMs: diff.timeLimitMs,
    },
  };
}

/**
 * Generate a Network Relink puzzle using Hamiltonian path + segment cutting.
 * 1. Build a Hamiltonian path through the N×N grid via randomized DFS + backtracking
 * 2. Cut the path at K-1 random points → K segments (min 3 cells each)
 * 3. Each segment's endpoints become a color pair
 */
function generateNetworkRelinkPuzzle(rng: Xorshift128, securityLevel: number): {
  solutionPath: [number, number][];
  endpoints: Array<[[number, number], [number, number]]>;
  config: NetworkRelinkConfig;
} {
  const diff = getNetworkRelinkDifficulty(securityLevel);
  const N = diff.gridSize;
  const totalCells = N * N;

  // Generate Hamiltonian path using randomized Warnsdorff's rule + backtracking
  const path = generateHamiltonianPath(rng, N);

  // Cut into K segments (K = diff.pairs) with min 3 cells each
  const K = diff.pairs;
  const cutPoints = selectCutPoints(rng, path.length, K);

  const endpoints: Array<[[number, number], [number, number]]> = [];
  let start = 0;
  for (let i = 0; i < cutPoints.length; i++) {
    const end = cutPoints[i];
    endpoints.push([path[start], path[end]]);
    start = end + 1;
  }
  // Last segment
  endpoints.push([path[start], path[path.length - 1]]);

  return {
    solutionPath: path,
    endpoints,
    config: {
      type: "network_relink",
      gridSize: N,
      pairs: K,
      timeLimitMs: diff.timeLimitMs,
      endpoints,
    },
  };
}

/** Generate a Hamiltonian path through an N×N grid using randomized Warnsdorff + bounded DFS */
function generateHamiltonianPath(rng: Xorshift128, N: number): [number, number][] {
  const total = N * N;
  const DIRS: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

  // Shared helpers (hoisted outside recursion for performance)
  const idx = (r: number, c: number) => r * N + c;
  const inBounds = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N;

  // Budget: max recursive calls before bailing on a start cell.
  // Warnsdorff heuristic almost always succeeds on first try for grids <= 8×8,
  // so this is a safety net for rare worst-case configurations.
  const MAX_CALLS_PER_START = 10_000;

  const visited = new Uint8Array(total);
  const path: [number, number][] = new Array(total);
  let pathLen = 0;

  function degree(r: number, c: number): number {
    let d = 0;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && !visited[idx(nr, nc)]) d++;
    }
    return d;
  }

  function dfs(budget: { remaining: number }): boolean {
    if (pathLen === total) return true;
    if (budget.remaining-- <= 0) return false;

    const [cr, cc] = path[pathLen - 1];

    // Build neighbor list sorted by Warnsdorff degree (ascending), random tiebreak
    const neighbors: { r: number; c: number; deg: number; rnd: number }[] = [];
    for (const [dr, dc] of DIRS) {
      const nr = cr + dr, nc = cc + dc;
      if (inBounds(nr, nc) && !visited[idx(nr, nc)]) {
        neighbors.push({ r: nr, c: nc, deg: degree(nr, nc), rnd: rng.next() });
      }
    }
    neighbors.sort((a, b) => a.deg - b.deg || a.rnd - b.rnd);

    for (const { r: nr, c: nc } of neighbors) {
      const vi = idx(nr, nc);
      visited[vi] = 1;
      path[pathLen++] = [nr, nc];
      if (dfs(budget)) return true;
      pathLen--;
      visited[vi] = 0;
    }
    return false;
  }

  // Try from a few random starting cells (3 is plenty with Warnsdorff)
  const starts: [number, number][] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) starts.push([r, c]);
  }
  rng.shuffle(starts);

  const maxStarts = Math.min(starts.length, 5);
  for (let s = 0; s < maxStarts; s++) {
    visited.fill(0);
    pathLen = 0;

    const [sr, sc] = starts[s];
    visited[idx(sr, sc)] = 1;
    path[pathLen++] = [sr, sc];

    if (dfs({ remaining: MAX_CALLS_PER_START })) {
      return path.slice(0, pathLen);
    }
  }

  // Fallback: snake pattern (always Hamiltonian, instant)
  const snake: [number, number][] = [];
  for (let r = 0; r < N; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < N; c++) snake.push([r, c]);
    } else {
      for (let c = N - 1; c >= 0; c--) snake.push([r, c]);
    }
  }
  return snake;
}

/** Select K-1 cut points that divide a path of length L into K segments of >= 3 cells each */
function selectCutPoints(rng: Xorshift128, pathLength: number, K: number): number[] {
  // We need K segments, each >= 3 cells. Cut points are the last index of each segment (except last).
  // Segment i covers [cutPoints[i-1]+1 .. cutPoints[i]], with cutPoints[-1] = -1
  // Minimum path length for K segments of 3: K * 3
  const minSegLen = 3;

  // Start by distributing minimum 3 cells to each segment
  const segLens = new Array(K).fill(minSegLen);
  let remaining = pathLength - K * minSegLen;

  // Distribute remaining cells randomly
  while (remaining > 0) {
    const seg = rng.int(0, K - 1);
    const add = Math.min(remaining, rng.int(1, Math.max(1, remaining)));
    segLens[seg] += add;
    remaining -= add;
  }

  // Shuffle segment lengths so distribution is random
  rng.shuffle(segLens);

  // Convert to cut point indices (end index of each segment except last)
  const cuts: number[] = [];
  let pos = -1;
  for (let i = 0; i < K - 1; i++) {
    pos += segLens[i];
    cuts.push(pos);
  }

  return cuts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function computeSignalCrackScore(guessesUsed: number, maxGuesses: number, solved: boolean): number {
  if (!solved) return 0;
  if (maxGuesses <= 1) return 100;
  const efficiency = (maxGuesses - guessesUsed) / (maxGuesses - 1);
  return Math.round(50 + 50 * efficiency);
}

export function computePortSweepScore(
  portsFound: number,
  totalPorts: number,
  probesUsed: number,
  maxProbes: number
): number {
  if (probesUsed === 0) return 0;
  const findScore = totalPorts > 0 ? (portsFound / totalPorts) * 50 : 0;
  const efficiency =
    maxProbes > 0
      ? Math.max(0, 1 - (probesUsed - portsFound) / (maxProbes - portsFound))
      : 0;
  const efficiencyScore = efficiency * 50;
  return Math.round(Math.min(100, findScore + efficiencyScore));
}

export function computeNetworkRelinkScore(
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

export function computeRewardMultiplier(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped === 0) return 0;
  if (clamped < 25) {
    return (clamped / 25) * 0.08;
  }
  if (clamped < 50) {
    return 0.08 + ((clamped - 25) / 25) * 0.62;
  }
  return 0.7 + ((clamped - 50) / 50) * 0.55;
}

export function hasMinigameRewardEligibility(gameType: MinigameType, moveCount: number): boolean {
  if (moveCount <= 0) return false;
  return gameType === "signal_crack" || gameType === "port_sweep" || gameType === "network_relink";
}

export function shouldResetHeatAfterMinigame(score: number, detected: boolean): boolean {
  return score >= 50 && !detected;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getStatusForHealth(health: number): string {
  if (health <= SYSTEM_STATUS_THRESHOLDS.CORRUPTED.max) return "CORRUPTED";
  if (health <= SYSTEM_STATUS_THRESHOLDS.CRITICAL.max) return "CRITICAL";
  if (health <= SYSTEM_STATUS_THRESHOLDS.DEGRADED.max) return "DEGRADED";
  return "OPTIMAL";
}

async function applyTimedBuff(playerId: string, stat: "hackPower" | "stealth", amount: number, ttl: number) {
  const key = `buff:${playerId}:${stat}`;
  const existing = await redis.get(key);
  const newValue = (existing ? parseInt(existing, 10) : 0) + amount;
  await redis.set(key, String(newValue), "EX", ttl);
}

/**
 * Compute how many codes are still consistent with all guesses + feedback so far.
 * Used for Signal Crack's "possibilities remaining" counter.
 */
function computePossibilitiesRemaining(
  digitPool: number,
  codeLength: number,
  allowRepeats: boolean,
  guesses: number[][],
  feedbacks: Array<import("@singularities/shared").SignalCrackFeedback[]>
): number {
  // Generate all possible codes
  const codes: number[][] = [];

  function generateCodes(current: number[], used: Set<number>) {
    if (current.length === codeLength) {
      codes.push([...current]);
      return;
    }
    for (let d = 0; d < digitPool; d++) {
      if (!allowRepeats && used.has(d)) continue;
      current.push(d);
      if (!allowRepeats) used.add(d);
      generateCodes(current, used);
      current.pop();
      if (!allowRepeats) used.delete(d);
    }
  }
  generateCodes([], new Set());

  // Filter codes consistent with all guesses
  let count = 0;
  for (const candidate of codes) {
    let consistent = true;
    for (let g = 0; g < guesses.length; g++) {
      const guess = guesses[g];
      const expectedFeedback = feedbacks[g];
      const fb = computeFeedbackForCandidate(candidate, guess);
      if (!feedbacksEqual(fb, expectedFeedback)) {
        consistent = false;
        break;
      }
    }
    if (consistent) count++;
  }
  return count;
}

function computeFeedbackForCandidate(
  secret: number[],
  guess: number[]
): import("@singularities/shared").SignalCrackFeedback[] {
  const feedback: import("@singularities/shared").SignalCrackFeedback[] = new Array(guess.length);
  const secretUsed = new Array(secret.length).fill(false);
  const guessUsed = new Array(guess.length).fill(false);

  // Pass 1: exact
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) {
      feedback[i] = "EXACT";
      secretUsed[i] = true;
      guessUsed[i] = true;
    }
  }
  // Pass 2: present
  for (let i = 0; i < guess.length; i++) {
    if (guessUsed[i]) continue;
    let found = false;
    for (let j = 0; j < secret.length; j++) {
      if (secretUsed[j]) continue;
      if (guess[i] === secret[j]) {
        feedback[i] = "PRESENT";
        secretUsed[j] = true;
        found = true;
        break;
      }
    }
    if (!found) feedback[i] = "MISS";
  }
  return feedback;
}

function feedbacksEqual(
  a: import("@singularities/shared").SignalCrackFeedback[],
  b: import("@singularities/shared").SignalCrackFeedback[]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Start game
// ---------------------------------------------------------------------------

export async function startGame(playerId: string, targetIndex: number) {
  const token = await acquireLock(LOCK_KEY(playerId), 30_000);
  if (!token) throw new MinigameError("Operation in progress, try again", 409);
  try {
    // Check no active game
    const existing = await redis.get(GAME_KEY(playerId));
    if (existing) {
      throw new MinigameError("A mini-game is already active. Resolve it first.", 409);
    }

    // Load scan targets from Redis
    const scanKey = `scan:${playerId}`;
    const cached = await redis.get(scanKey);
    if (!cached) {
      throw new MinigameError("No active scan. Run a scan first.", 400);
    }

    const targets: ScanTarget[] = JSON.parse(cached);
    const target = targets.find((t) => t.index === targetIndex);
    if (!target) {
      throw new MinigameError("Invalid target index", 400);
    }

    // Get VRF seed (or fallback)
    let seedBytes: Uint8Array;
    // TODO: when chain resolution for minigames is wired, use VRF here
    seedBytes = new Uint8Array(crypto.randomBytes(32));

    const rng = new Xorshift128(seedBytes);
    const seedHex = Buffer.from(seedBytes).toString("hex");

    // Snapshot stats at start to prevent mid-game loadout swaps
    const stats = await resolveLoadoutStats(playerId, "infiltration");
    const modEffects = stats.modifierEffects;
    const statsSnapshot = {
      hackPower: Math.round(stats.hackPower * stats.healthMultiplier),
      stealth: stats.stealth + stats.detectionReduction,
      defense: stats.defense,
      creditBonus: stats.creditBonus,
      dataBonus: stats.dataBonus,
      detectionReduction: stats.detectionReduction,
      healthMultiplier: stats.healthMultiplier,
      hackRewardMultiplier: modEffects.hackRewardMultiplier ?? 1,
      xpGainMultiplier: modEffects.xpGainMultiplier ?? 1,
      detectionChanceMultiplier: modEffects.detectionChanceMultiplier ?? 1,
    };

    // Generate puzzle FIRST, then capture timestamp so generation time
    // doesn't eat into the player's clock.
    const gameType = target.gameType;
    let gameState: GameState;

    if (gameType === "signal_crack") {
      const { secret, config } = generateSignalCrackPuzzle(rng, target.securityLevel);
      const now = Date.now();
      gameState = {
        gameType: "signal_crack",
        playerId,
        targetIndex,
        target,
        startedAt: now,
        expiresAt: now + config.timeLimitMs,
        stats: statsSnapshot,
        moveHistory: [],
        resolved: false,
        seed: seedHex,
        secret,
        guessesUsed: 0,
        solved: false,
        guesses: [],
        feedbacks: [],
        config,
      };
    } else if (gameType === "port_sweep") {
      const { ports, config } = generatePortSweepPuzzle(rng, target.securityLevel);
      const now = Date.now();
      gameState = {
        gameType: "port_sweep",
        playerId,
        targetIndex,
        target,
        startedAt: now,
        expiresAt: now + config.timeLimitMs,
        stats: statsSnapshot,
        moveHistory: [],
        resolved: false,
        seed: seedHex,
        ports,
        probesUsed: 0,
        portsFound: 0,
        probed: [],
        config,
      };
    } else {
      const { solutionPath, endpoints, config } = generateNetworkRelinkPuzzle(rng, target.securityLevel);
      const now = Date.now();
      gameState = {
        gameType: "network_relink",
        playerId,
        targetIndex,
        target,
        startedAt: now,
        expiresAt: now + config.timeLimitMs,
        stats: statsSnapshot,
        moveHistory: [],
        resolved: false,
        seed: seedHex,
        solutionPath,
        endpoints,
        totalPairs: config.pairs,
        submitted: false,
        config,
      };
    }

    // Store game state in Redis
    await redis.set(
      GAME_KEY(playerId),
      JSON.stringify(gameState),
      "EX",
      MINIGAME_BALANCE.gameStateRetentionSeconds
    );

    // Clear scan targets (one target per scan now)
    await redis.del(scanKey);

    // Build client config (strip secrets)
    const clientConfig: GameConfig = gameState.config;

    // Log activity
    sendActivity(playerId, `Infiltration sequence initiated: ${target.name} (${target.gameType.replaceAll("_", " ")})`);

    return {
      gameId: seedHex.slice(0, 16),
      gameType,
      config: clientConfig,
      expiresAt: new Date(gameState.expiresAt).toISOString(),
    };
  } finally {
    await releaseLock(LOCK_KEY(playerId), token);
  }
}

// ---------------------------------------------------------------------------
// Submit move
// ---------------------------------------------------------------------------

export async function submitMove(playerId: string, move: GameMove) {
  const token = await acquireLock(LOCK_KEY(playerId), 30_000);
  if (!token) throw new MinigameError("Operation in progress, try again", 409);
  try {
    const raw = await redis.get(GAME_KEY(playerId));
    if (!raw) throw new MinigameError("No active mini-game", 400);

    const state: GameState = JSON.parse(raw);
    if (state.resolved) {
      throw new MinigameError("Game already resolved", 400);
    }

    // Check time limit
    if (Date.now() > state.expiresAt) {
      throw new MinigameError("Time expired. Resolve the game.", 400);
    }

    // Validate move type matches game type
    if (move.type !== state.gameType) {
      throw new MinigameError(`Expected move type '${state.gameType}', got '${move.type}'`, 400);
    }

    let result: GameMoveResult;

    if (state.gameType === "signal_crack" && move.type === "signal_crack") {
      if (!Array.isArray(move.guess)) {
        throw new MinigameError("guess array is required", 400);
      }
      result = processSignalCrackMove(state, move.guess);
    } else if (state.gameType === "port_sweep" && move.type === "port_sweep") {
      if (typeof move.row !== "number" || typeof move.col !== "number") {
        throw new MinigameError("row and col numbers are required", 400);
      }
      result = processPortSweepMove(state, move.row, move.col);
    } else if (state.gameType === "network_relink" && move.type === "network_relink") {
      if (!Array.isArray(move.paths)) {
        throw new MinigameError("paths array is required", 400);
      }
      result = processNetworkRelinkMove(state, move.paths, move.drawCount);
    } else {
      throw new MinigameError("Invalid move type", 400);
    }

    state.moveHistory.push(result);

    // Save updated state
    await redis.set(
      GAME_KEY(playerId),
      JSON.stringify(state),
      "EX",
      MINIGAME_BALANCE.gameStateRetentionSeconds
    );

    return { result };
  } finally {
    await releaseLock(LOCK_KEY(playerId), token);
  }
}

// ---------------------------------------------------------------------------
// Move processors
// ---------------------------------------------------------------------------

function processSignalCrackMove(state: SignalCrackState, guess: number[]): SignalCrackMoveResult {
  if (guess.length !== state.secret.length) {
    throw new MinigameError(`Guess must be ${state.secret.length} digits`, 400);
  }
  if (state.solved) {
    throw new MinigameError("Already solved", 400);
  }

  const maxGuesses = state.config.maxGuesses;
  if (state.guessesUsed >= maxGuesses) {
    throw new MinigameError("No guesses remaining", 400);
  }

  // Validate digits are in range
  for (const d of guess) {
    if (d < 0 || d >= state.config.digitPool || !Number.isInteger(d)) {
      throw new MinigameError(`Digits must be integers 0-${state.config.digitPool - 1}`, 400);
    }
  }

  // Reject duplicate digits in guess
  if (new Set(guess).size !== guess.length) {
    throw new MinigameError("Duplicate digits are not allowed in a guess", 400);
  }

  // Compute feedback
  const feedback: SignalCrackFeedback[] = [];
  const secretUsed = new Array(state.secret.length).fill(false);
  const guessUsed = new Array(guess.length).fill(false);

  // Pass 1: exact matches
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === state.secret[i]) {
      feedback[i] = "EXACT";
      secretUsed[i] = true;
      guessUsed[i] = true;
    }
  }

  // Pass 2: present but wrong position
  for (let i = 0; i < guess.length; i++) {
    if (guessUsed[i]) continue;
    let found = false;
    for (let j = 0; j < state.secret.length; j++) {
      if (secretUsed[j]) continue;
      if (guess[i] === state.secret[j]) {
        feedback[i] = "PRESENT";
        secretUsed[j] = true;
        found = true;
        break;
      }
    }
    if (!found) {
      feedback[i] = "MISS";
    }
  }

  state.guessesUsed++;
  state.guesses.push(guess);
  state.feedbacks.push(feedback);
  const solved = feedback.every((f) => f === "EXACT");
  state.solved = solved;

  const gameOver = solved || state.guessesUsed >= maxGuesses;

  // Compute possibilities remaining using all guesses + feedbacks
  const possibilitiesRemaining = solved ? 1 : computePossibilitiesRemaining(
    state.config.digitPool,
    state.config.codeLength,
    false, // all tiers are now no-repeats
    state.guesses,
    state.feedbacks,
  );

  return {
    type: "signal_crack",
    guess,
    feedback,
    solved,
    guessesUsed: state.guessesUsed,
    guessesRemaining: maxGuesses - state.guessesUsed,
    possibilitiesRemaining,
    gameOver,
  };
}

function processPortSweepMove(state: PortSweepState, row: number, col: number): PortSweepMoveResult {
  const { gridSize, maxProbes, portCount } = state.config;

  if (state.portsFound >= portCount) {
    throw new MinigameError("All ports already found", 400);
  }

  if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) {
    throw new MinigameError(`Coordinates must be 0-${gridSize - 1}`, 400);
  }

  const cellKey = `${row},${col}`;
  if (state.probed.includes(cellKey)) {
    throw new MinigameError("Cell already probed", 400);
  }

  if (state.probesUsed >= maxProbes) {
    throw new MinigameError("No probes remaining", 400);
  }

  state.probesUsed++;
  state.probed.push(cellKey);

  const hit = state.ports.includes(cellKey);
  let adjacency: number | null = null;

  if (hit) {
    state.portsFound++;
  } else {
    // Count adjacent ports (8-connected)
    adjacency = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        if (state.ports.includes(`${row + dr},${col + dc}`)) {
          adjacency++;
        }
      }
    }
  }

  const allFound = state.portsFound >= portCount;
  const gameOver = allFound || state.probesUsed >= maxProbes;

  return {
    type: "port_sweep",
    row,
    col,
    hit,
    adjacency,
    portsFound: state.portsFound,
    probesUsed: state.probesUsed,
    probesRemaining: maxProbes - state.probesUsed,
    allFound,
    gameOver,
  };
}

function processNetworkRelinkMove(
  state: NetworkRelinkState,
  paths: Array<{ pairIndex: number; cells: [number, number][] }>,
  drawCount: number,
): NetworkRelinkMoveResult {
  if (state.submitted) {
    throw new MinigameError("Solution already submitted", 400);
  }

  const N = state.config.gridSize;
  const totalCells = N * N;
  const totalPairs = state.totalPairs;

  // Validate and score the submitted paths
  const usedCells = new Set<string>();
  let connectedPairs = 0;

  for (const path of paths) {
    if (path.pairIndex < 0 || path.pairIndex >= totalPairs) continue;
    if (!path.cells || path.cells.length < 2) continue;

    const ep = state.endpoints[path.pairIndex];
    if (!ep) continue;

    // Check path starts at one endpoint and ends at the other
    const [startR, startC] = path.cells[0];
    const [endR, endC] = path.cells[path.cells.length - 1];
    const [[ep1r, ep1c], [ep2r, ep2c]] = ep;

    const startsAtEp = (startR === ep1r && startC === ep1c && endR === ep2r && endC === ep2c)
      || (startR === ep2r && startC === ep2c && endR === ep1r && endC === ep1c);
    if (!startsAtEp) continue;

    // Validate adjacency and bounds for each step
    let valid = true;
    const pathCells = new Set<string>();
    for (let i = 0; i < path.cells.length; i++) {
      const [r, c] = path.cells[i];
      if (r < 0 || r >= N || c < 0 || c >= N) { valid = false; break; }

      const key = `${r},${c}`;
      if (usedCells.has(key) || pathCells.has(key)) { valid = false; break; }
      pathCells.add(key);

      if (i > 0) {
        const [pr, pc] = path.cells[i - 1];
        const dr = Math.abs(r - pr);
        const dc = Math.abs(c - pc);
        // Must be 4-directional adjacent (not diagonal)
        if (dr + dc !== 1) { valid = false; break; }
      }
    }

    if (!valid) continue;

    // Mark cells as used
    for (const [r, c] of path.cells) {
      usedCells.add(`${r},${c}`);
    }
    connectedPairs++;
  }

  state.submitted = true;

  const filledCells = usedCells.size;
  const elapsedMs = Date.now() - state.startedAt;
  const score = computeNetworkRelinkScore(connectedPairs, totalPairs, filledCells, totalCells, elapsedMs, state.config.timeLimitMs);

  return {
    type: "network_relink",
    connectedPairs,
    totalPairs,
    filledCells,
    totalCells,
    score,
    gameOver: true,
  };
}

// ---------------------------------------------------------------------------
// Resolve game → compute score, apply rewards/damage
// ---------------------------------------------------------------------------

export async function resolveGame(playerId: string) {
  const token = await acquireLock(LOCK_KEY(playerId), 30_000);
  if (!token) throw new MinigameError("Operation in progress, try again", 409);
  try {
    const raw = await redis.get(GAME_KEY(playerId));
    if (!raw) throw new MinigameError("No active mini-game", 400);

    const state: GameState = JSON.parse(raw);
    if (state.resolved) {
      throw new MinigameError("Game already resolved", 400);
    }
    state.resolved = true;

    // Compute score
    const score = computeScore(state);
    const moveCount = state.moveHistory.length;
    const rewardsEligible = hasMinigameRewardEligibility(state.gameType, moveCount);
    const gameDurationMs = Date.now() - state.startedAt;
    const target = state.target;
    const statsSnap = state.stats;

    // Get season multiplier
    let resourceMultiplier = 1;
    try {
      const catchUpBonuses = await getSeasonCatchUpBonuses(playerId);
      resourceMultiplier = catchUpBonuses.resourceMultiplier;
    } catch { /* non-critical */ }

    const result = await withTransaction(async (client) => {
      const pRes = await client.query("SELECT * FROM players WHERE id = $1 FOR UPDATE", [playerId]);
      const playerRow = computeEnergy(pRes.rows[0]);

      // Calculate gradient rewards
      const baseRewards = getBaseReward(target.securityLevel);
      const scoreMult = rewardsEligible ? computeRewardMultiplier(score) : 0;
      const creditMultiplier = 1 + statsSnap.creditBonus / 100;
      const dataMultiplier = 1 + statsSnap.dataBonus / 100;

      const finalCredits = Math.floor(
        baseRewards.credits * MINIGAME_BALANCE.rewardMultiplier * scoreMult * creditMultiplier
        * statsSnap.hackRewardMultiplier * resourceMultiplier
      );
      const finalData = Math.floor(
        baseRewards.data * MINIGAME_BALANCE.rewardMultiplier * scoreMult * dataMultiplier
        * statsSnap.hackRewardMultiplier * resourceMultiplier
      );
      const finalReputation = Math.floor(baseRewards.reputation * MINIGAME_BALANCE.rewardMultiplier * scoreMult);
      const finalXp = Math.floor(
        baseRewards.xp * MINIGAME_BALANCE.rewardMultiplier * scoreMult * statsSnap.xpGainMultiplier
      );

      // Processing power only at score >= 75% on security >= 65
      const processingPowerReward =
        score >= MINIGAME_BALANCE.processingPowerScoreThreshold
        && target.securityLevel >= MINIGAME_BALANCE.processingPowerSecurityThreshold
          ? Math.max(1, Math.floor(
              randomInt(
                SCANNER_BALANCE.highRiskProcessingPower.min,
                SCANNER_BALANCE.highRiskProcessingPower.max
              ) * resourceMultiplier
            ))
          : 0;

      // Detection based on score
      const detectionMult = getDetectionMultiplier(score);
      let detected = false;
      let damage = undefined;

      if (detectionMult > 0) {
        const effectiveDetection = Math.max(5, Math.min(95,
          (target.detectionChance - statsSnap.stealth / 2) * statsSnap.detectionChanceMultiplier * detectionMult
        ));
        const detectionRoll = randomInt(1, 100);
        detected = detectionRoll <= effectiveDetection;
      }

      // Residual detection on clean hacks at high security.
      // High-security targets run persistent intrusion monitoring that logs breach
      // signatures even on clean exits. Relay routing (stealth) masks the traces.
      if (!detected && score >= 50) {
        const { securityThreshold, securityScale, stealthDivisor } = SCANNER_BALANCE.residualDetection;
        const residual = Math.max(0,
          (target.securityLevel - securityThreshold) * securityScale - statsSnap.stealth / stealthDivisor
        );
        if (residual > 0) {
          detected = randomInt(1, 100) <= residual;
        }
      }

      if (detected) {
        const heatLevel = playerRow.heat_level as number;
        const config = getHeatDamageConfig(heatLevel);

        const systemsRes = await client.query(
          "SELECT * FROM player_systems WHERE player_id = $1 FOR UPDATE",
          [playerId]
        );
        const systems = systemsRes.rows;
        const affectedCount = Math.min(config.systemsAffected, systems.length);
        for (let i = systems.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [systems[i], systems[j]] = [systems[j], systems[i]];
        }
        const affected = systems.slice(0, affectedCount);

        const damageSystems: Array<{ systemType: string; damage: number }> = [];
        for (const sys of affected) {
          const computed = computeSystemHealth(sys, {});
          const currentHealth = computed.health as number;
          const dmg = randomInt(config.minDamage, config.maxDamage);
          const newHealth = Math.max(0, currentHealth - dmg);
          const newStatus = getStatusForHealth(newHealth);
          await client.query(
            `UPDATE player_systems SET health = $2, status = $3, updated_at = NOW() WHERE id = $1`,
            [sys.id, newHealth, newStatus]
          );
          damageSystems.push({ systemType: sys.system_type as string, damage: dmg });
        }

        await client.query(
          `UPDATE players SET heat_level = heat_level + 1 WHERE id = $1`,
          [playerId]
        );

        damage = { systems: damageSystems };
      }

      // Apply rewards
      if (shouldResetHeatAfterMinigame(score, detected)) {
        // Reset heat only for meaningful successful infiltration outcomes.
        await client.query(
          `UPDATE players
           SET credits = credits + $2,
               data = data + $3,
               reputation = reputation + $4,
               processing_power = processing_power + $5,
               heat_level = 0
           WHERE id = $1`,
          [playerId, finalCredits, finalData, finalReputation, processingPowerReward]
        );
      } else {
        // All other outcomes keep current heat progression.
        await client.query(
          `UPDATE players
           SET credits = credits + $2,
               data = data + $3,
               reputation = reputation + $4,
               processing_power = processing_power + $5
           WHERE id = $1`,
          [playerId, finalCredits, finalData, finalReputation, processingPowerReward]
        );
      }

      const rewards = {
        credits: finalCredits,
        data: finalData,
        reputation: finalReputation,
        xp: finalXp,
        processingPower: processingPowerReward > 0 ? processingPowerReward : undefined,
      };

      // Award XP
      const xpResult = await awardXP(playerId, finalXp, client);

      // Hook: first successful game each day
      if (score >= 50) {
        const dailyBuffKey = `daily:first_success_buff:${playerId}:${todayDateString()}`;
        const alreadyGranted = await redis.get(dailyBuffKey);
        if (!alreadyGranted) {
          await redis.set(dailyBuffKey, "1", "EX", 86400);
          await applyTimedBuff(
            playerId, "hackPower",
            HOOK_BALANCE.firstSuccessDailyBuff.hackPower,
            HOOK_BALANCE.firstSuccessDailyBuff.durationSeconds
          );
          await applyTimedBuff(
            playerId, "stealth",
            HOOK_BALANCE.firstSuccessDailyBuff.stealth,
            HOOK_BALANCE.firstSuccessDailyBuff.durationSeconds
          );
        }
      }

      // Build narrative
      let narrative: string;
      if (score >= 50 && detected) {
        // Clean hack, but high-security persistent monitoring logged the breach signature
        const damageReport = damage?.systems.map(d => `${d.systemType}: -${d.damage}HP`).join(", ") ?? "";
        narrative = fillTemplate(pickTemplate(HACK_SUCCESS_TRACED_TEMPLATES), {
          target: target.name,
          security: target.securityLevel,
          credits: finalCredits,
          data: finalData,
          reputation: finalReputation,
          damageReport,
        });
        if (xpResult.levelUp) {
          narrative += `\n> LEVEL UP! Now level ${xpResult.newLevel}`;
        }
      } else if (score >= 50) {
        narrative = fillTemplate(pickTemplate(HACK_SUCCESS_TEMPLATES), {
          target: target.name,
          security: target.securityLevel,
          power: statsSnap.hackPower,
          credits: finalCredits,
          data: finalData,
          reputation: finalReputation,
          processingPower: processingPowerReward,
          rounds: state.moveHistory.length,
        });
        if (xpResult.levelUp) {
          narrative += `\n> LEVEL UP! Now level ${xpResult.newLevel}`;
        }
      } else if (detected) {
        const damageReport = damage?.systems.map(d => `${d.systemType}: -${d.damage}HP`).join(", ") ?? "";
        narrative = fillTemplate(pickTemplate(HACK_FAIL_DETECTED_TEMPLATES), {
          target: target.name,
          detection: Math.round(target.detectionChance),
          damageReport,
        });
      } else {
        narrative = fillTemplate(pickTemplate(HACK_FAIL_UNDETECTED_TEMPLATES), {
          target: target.name,
          security: target.securityLevel,
          stealth: statsSnap.stealth,
          power: statsSnap.hackPower,
        });
      }

      // Log infiltration
      await client.query(
        `INSERT INTO infiltration_logs
           (player_id, target_type, security_level, success, detected,
            credits_earned, reputation_earned, damage_taken, chain_verified, tx_signature,
            game_type, score, moves_count, game_duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          playerId,
          target.type,
          target.securityLevel,
          score >= 50,
          detected,
          rewards.credits,
          rewards.reputation,
          damage ? JSON.stringify(damage.systems) : null,
          false, // chainVerified — will be true when VRF wired
          null,  // txSignature
          target.gameType,
          score,
          moveCount,
          gameDurationMs,
        ]
      );

      const finalRes = await client.query("SELECT * FROM players WHERE id = $1", [playerId]);
      const finalPlayer = computeEnergy(finalRes.rows[0]);

      return {
        score,
        rewards,
        detected,
        damage,
        narrative,
        levelUp: xpResult.levelUp,
        newLevel: xpResult.newLevel,
        player: mapPlayerRow({
          ...finalRes.rows[0],
          energy: finalPlayer.energy,
        }),
        chainVerified: false,
        txSignature: null,
      };
    });

    // Clean up Redis
    await redis.del(GAME_KEY(playerId));

    // Send activity notification
    try {
      const msg = score >= 50
        ? `Game completed on ${target.name} (score: ${score}%) — +${result.rewards.credits} CR`
        : `Game failed on ${target.name} (score: ${score}%)${result.detected ? " (DETECTED)" : ""}`;
      sendActivity(playerId, msg);
    } catch { /* non-critical */ }

    // Post-game alignment shifts & decision triggers
    if (moveCount > 0) {
      try {
        if (["database", "research", "infrastructure"].includes(target.type)) {
          await shiftAlignment(playerId, ALIGNMENT_SHIFTS.hackCivilian);
        }
        await triggerDecision(playerId, "afterHack");
      } catch { /* non-critical */ }
    }

    return result;
  } finally {
    await releaseLock(LOCK_KEY(playerId), token);
  }
}

// ---------------------------------------------------------------------------
// Score computation
// ---------------------------------------------------------------------------

function computeScore(state: GameState): number {
  switch (state.gameType) {
    case "signal_crack":
      return computeSignalCrackScore(state.guessesUsed, state.config.maxGuesses, state.solved);
    case "port_sweep":
      return computePortSweepScore(
        state.portsFound,
        state.config.portCount,
        state.probesUsed,
        state.config.maxProbes
      );
    case "network_relink": {
      // Score comes from the move result if submitted, otherwise 0
      const lastMove = state.moveHistory[state.moveHistory.length - 1];
      if (lastMove && lastMove.type === "network_relink") {
        return lastMove.score;
      }
      return 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Game status (for resume on reconnect)
// ---------------------------------------------------------------------------

export async function getGameStatus(playerId: string) {
  const raw = await redis.get(GAME_KEY(playerId));
  if (!raw) {
    return { active: false };
  }

  const state: GameState = JSON.parse(raw);

  // Check if expired
  if (Date.now() > state.expiresAt && !state.resolved) {
    return {
      active: true,
      gameId: state.seed.slice(0, 16),
      gameType: state.gameType,
      config: state.config,
      moveHistory: state.moveHistory,
      expiresAt: new Date(state.expiresAt).toISOString(),
      startedAt: new Date(state.startedAt).toISOString(),
      expired: true,
    };
  }

  return {
    active: true,
    gameId: state.seed.slice(0, 16),
    gameType: state.gameType,
    config: state.config,
    moveHistory: state.moveHistory,
    expiresAt: new Date(state.expiresAt).toISOString(),
    startedAt: new Date(state.startedAt).toISOString(),
  };
}
