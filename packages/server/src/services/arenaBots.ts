import type { ArenaOpponent } from "@singularities/shared";
import {
  COMBAT_ATTACK_PHRASES,
  COMBAT_DEFEND_PHRASES,
  PVP_DEFAULT_DEFENSE_POWER,
  PVP_LEVEL_RANGE,
  PVP_LOSER_DAMAGE_MAX_PCT,
  PVP_LOSER_DAMAGE_MIN_PCT,
  PVP_LOSER_SYSTEMS_MAX,
  PVP_LOSER_SYSTEMS_MIN,
  PVP_REWARD_CREDITS_LEVEL_BONUS,
  PVP_REWARD_CREDITS_MAX,
  PVP_REWARD_CREDITS_MIN,
  PVP_REWARD_DATA_MIN,
  PVP_REWARD_DATA_MAX,
  PVP_REWARD_DATA_LEVEL_BONUS,
  PVP_REWARD_PROCESSING_POWER_MAX,
  PVP_REWARD_PROCESSING_POWER_MIN,
  PVP_REWARD_XP,
  PVP_WIN_CHANCE_MAX,
  PVP_WIN_CHANCE_MIN,
  PVP_WIN_CHANCE_SCALE,
  SYSTEM_TYPES,
} from "@singularities/shared";
import type { TxClient } from "../db/pool.js";
import type { CombatOutcome } from "./combat.js";
import { generateCombatNarrative } from "./combat.js";
import { resolveLoadoutStats } from "./stats.js";

export const BOT_TARGET_PREFIX = "bot";
export const BOT_POOL_SIZE = 12;
export const BOT_TARGET_OPPONENT_FLOOR = 8;
export const BOT_MAX_BACKFILL_PER_REQUEST = 4;
export const BOT_MAX_ATTACKS_PER_DAY = 5;
export const BOT_MAX_PLAYER_LEVEL = 45;

export type ArenaBotTier = "novice" | "adaptive" | "elite";

export interface ArenaBotProfile {
  id: string;
  aiName: string;
  tier: ArenaBotTier;
  level: number;
  playstyle: string;
  alignment: number;
  reputation: number;
  defensePower: number;
  rewardMultiplier: number;
  virtualCredits: number;
}

const TIER_BASE_REWARD_MULTIPLIER: Record<ArenaBotTier, number> = {
  novice: 0.52,
  adaptive: 0.62,
  elite: 0.72,
};

const TIER_BASE_DEFENSE_BONUS: Record<ArenaBotTier, number> = {
  novice: -18,
  adaptive: -2,
  elite: 4,
};

const BOT_PLAYSTYLES = ["Offense", "Defense", "Stealth", "Balanced"] as const;
const BOT_NAME_PREFIXES = ["SYN", "GRID", "NULL", "AXIS", "ECHO", "CIPHER"];
const BOT_NAME_CORES = ["PHANTOM", "SENTRY", "WRAITH", "ION", "MIMIC", "PROXY"];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: string, salt: string): number {
  return hashString(`${seed}:${salt}`) / 4294967295;
}

function seededInt(seed: string, min: number, max: number, salt: string): number {
  const unit = seededUnit(seed, salt);
  return Math.floor(unit * (max - min + 1)) + min;
}

function parseTier(raw: string): ArenaBotTier | null {
  if (raw === "novice" || raw === "adaptive" || raw === "elite") return raw;
  return null;
}

function buildBotName(seed: string): string {
  const prefix = BOT_NAME_PREFIXES[seededInt(seed, 0, BOT_NAME_PREFIXES.length - 1, "name_prefix")];
  const core = BOT_NAME_CORES[seededInt(seed, 0, BOT_NAME_CORES.length - 1, "name_core")];
  const suffix = seededInt(seed, 10, 99, "name_suffix");
  return `${prefix}-${core}-${suffix}`;
}

function createArenaBotProfile(
  id: string,
  tier: ArenaBotTier,
  level: number,
  seed: string
): ArenaBotProfile {
  const rewardVariance = seededInt(seed, -4, 4, "reward_variance") / 100;
  const rewardMultiplier = clamp(
    TIER_BASE_REWARD_MULTIPLIER[tier] + rewardVariance,
    0.35,
    0.80
  );
  const defensePower = Math.max(
    PVP_DEFAULT_DEFENSE_POWER,
    8 + level * 2 + TIER_BASE_DEFENSE_BONUS[tier] + seededInt(seed, -3, 3, "defense")
  );
  const playstyle = BOT_PLAYSTYLES[seededInt(seed, 0, BOT_PLAYSTYLES.length - 1, "playstyle")];
  const alignment = seededInt(seed, -100, 100, "alignment") / 100;
  const reputation = Math.max(0, level * 100 + seededInt(seed, -80, 120, "reputation"));
  const virtualCredits = Math.max(60, 70 + level * 14 + seededInt(seed, -20, 40, "credits"));

  return {
    id,
    aiName: buildBotName(seed),
    tier,
    level,
    playstyle,
    alignment,
    reputation,
    defensePower,
    rewardMultiplier,
    virtualCredits,
  };
}

export function buildBotPool(
  playerId: string,
  playerLevel: number,
  dateKey: string,
  size = BOT_POOL_SIZE
): ArenaBotProfile[] {
  const minLevel = Math.max(1, playerLevel - PVP_LEVEL_RANGE);
  const maxLevel = playerLevel + PVP_LEVEL_RANGE;
  const pool: ArenaBotProfile[] = [];

  for (let i = 0; i < size; i++) {
    const seed = hashString(`${playerId}:${dateKey}:${i}`).toString(16);
    const tierRoll = seededUnit(seed, "tier");
    const tier: ArenaBotTier = tierRoll < 0.5 ? "novice" : (tierRoll < 0.85 ? "adaptive" : "elite");
    const levelOffset = tier === "novice"
      ? seededInt(seed, -2, 0, "level")
      : tier === "adaptive"
        ? seededInt(seed, -1, 1, "level")
        : seededInt(seed, 0, 2, "level");
    const level = clamp(playerLevel + levelOffset, minLevel, maxLevel);
    const id = `${BOT_TARGET_PREFIX}:${dateKey}:${tier}:${level}:${seed}`;

    pool.push(createArenaBotProfile(id, tier, level, seed));
  }

  return pool;
}

export function parseBotTargetId(targetId: string, dateKey: string): ArenaBotProfile | null {
  const parts = targetId.split(":");
  if (parts.length !== 5 || parts[0] !== BOT_TARGET_PREFIX) return null;
  if (parts[1] !== dateKey) return null;

  const tier = parseTier(parts[2]);
  if (!tier) return null;

  const level = Number(parts[3]);
  if (!Number.isInteger(level) || level < 1) return null;

  const seed = parts[4];
  if (!/^[a-f0-9]+$/i.test(seed)) return null;

  return createArenaBotProfile(targetId, tier, level, seed);
}

export function isBotTargetId(targetId: string): boolean {
  return targetId.startsWith(`${BOT_TARGET_PREFIX}:`);
}

export function isBotTargetAllowedForPlayer(
  playerId: string,
  playerLevel: number,
  targetId: string,
  dateKey: string
): boolean {
  if (playerLevel > BOT_MAX_PLAYER_LEVEL) return false;
  const bot = parseBotTargetId(targetId, dateKey);
  if (!bot) return false;
  if (Math.abs(playerLevel - bot.level) > PVP_LEVEL_RANGE) return false;

  const pool = buildBotPool(playerId, playerLevel, dateKey);
  return pool.some((candidate) => candidate.id === targetId);
}

export function withBotBackfill(
  playerId: string,
  playerLevel: number,
  dateKey: string,
  humanOpponents: ArenaOpponent[]
): ArenaOpponent[] {
  if (playerLevel > BOT_MAX_PLAYER_LEVEL) return humanOpponents;
  if (humanOpponents.length >= BOT_TARGET_OPPONENT_FLOOR) return humanOpponents;

  const needed = Math.min(
    BOT_MAX_BACKFILL_PER_REQUEST,
    BOT_TARGET_OPPONENT_FLOOR - humanOpponents.length
  );
  if (needed <= 0) return humanOpponents;

  const bots: ArenaOpponent[] = buildBotPool(playerId, playerLevel, dateKey)
    .slice(0, needed)
    .map((bot) => ({
      id: bot.id,
      aiName: bot.aiName,
      level: bot.level,
      reputation: bot.reputation,
      playstyle: bot.playstyle,
      alignment: bot.alignment,
      isBot: true,
      botTier: bot.tier,
      disclosureLabel: "SIMULATED OPPONENT",
    }));

  return [...humanOpponents, ...bots];
}

export function getBotAttackRedisKey(playerId: string, dateKey: string): string {
  return `pvp_bot_attacks:${playerId}:${dateKey}`;
}

export async function resolveAttackAgainstBot(
  attackerId: string,
  bot: ArenaBotProfile,
  client: TxClient
): Promise<CombatOutcome> {
  const attackerRes = await client.query(
    "SELECT ai_name FROM players WHERE id = $1",
    [attackerId]
  );
  const attackerName = (attackerRes.rows[0]?.ai_name as string) ?? "ATTACKER";

  const attackerStats = await resolveLoadoutStats(attackerId, "attack", client);
  const finalAttack = Math.round(attackerStats.hackPower * attackerStats.healthMultiplier)
    || PVP_DEFAULT_DEFENSE_POWER;
  const finalDefense = bot.defensePower;

  const rawChance = 50 + (finalAttack - finalDefense) / PVP_WIN_CHANCE_SCALE * 100;
  const winChance = Math.max(PVP_WIN_CHANCE_MIN, Math.min(PVP_WIN_CHANCE_MAX, rawChance));
  const attackerWon = randomInt(1, 100) <= winChance;
  const rounds = randomInt(3, 5);
  const narrative = generateCombatNarrative(
    attackerName,
    bot.aiName,
    rounds,
    attackerWon,
    finalAttack,
    finalDefense,
    winChance
  );
  const combatLogEntries = buildCombatLogEntries(attackerName, bot.aiName, rounds, finalAttack, finalDefense, attackerWon);

  if (attackerWon) {
    const baseCredits = randomInt(PVP_REWARD_CREDITS_MIN, PVP_REWARD_CREDITS_MAX)
      + bot.level * PVP_REWARD_CREDITS_LEVEL_BONUS;
    const credits = Math.max(8, Math.floor(baseCredits * bot.rewardMultiplier));
    const xp = Math.max(10, Math.floor(PVP_REWARD_XP * bot.rewardMultiplier));
    const processingPower = Math.random() < Math.min(0.85, 0.25 + bot.rewardMultiplier)
      ? randomInt(PVP_REWARD_PROCESSING_POWER_MIN, PVP_REWARD_PROCESSING_POWER_MAX)
      : 0;
    const dataReward = randomInt(PVP_REWARD_DATA_MIN, PVP_REWARD_DATA_MAX)
      + bot.level * PVP_REWARD_DATA_LEVEL_BONUS;
    narrative.push("> Simulated target neutralized. Competitive rewards are reduced.");
    narrative.push(`> Rewards: +${credits} CR, +${dataReward} DATA, +0 REP, +${xp} XP, +${processingPower} PP`);

    return {
      result: "attacker_win",
      narrative,
      rewards: {
        credits,
        data: dataReward,
        reputation: 0,
        xp,
        processingPower,
      },
      combatLogEntries,
    };
  }

  const systemCount = randomInt(PVP_LOSER_SYSTEMS_MIN, PVP_LOSER_SYSTEMS_MAX);
  const shuffled = [...SYSTEM_TYPES].sort(() => Math.random() - 0.5);
  const affectedSystems = shuffled.slice(0, systemCount);
  const damageSystems: Array<{ systemType: string; damage: number }> = [];
  for (const systemType of affectedSystems) {
    damageSystems.push({
      systemType,
      damage: randomInt(PVP_LOSER_DAMAGE_MIN_PCT, PVP_LOSER_DAMAGE_MAX_PCT),
    });
  }
  narrative.push(`> Training loss. Attacker systems damaged: ${damageSystems.map((d) => `${d.systemType} -${d.damage}HP`).join(", ")}`);

  return {
    result: "defender_win",
    narrative,
    damage: { systems: damageSystems },
    combatLogEntries,
  };
}

function buildCombatLogEntries(
  attackerName: string,
  defenderName: string,
  rounds: number,
  finalAttack: number,
  finalDefense: number,
  attackerWon: boolean
): Array<{
  round: number;
  attackerAction: string;
  defenderAction: string;
  damage: number;
  targetSystem: string;
  description: string;
}> {
  const entries: Array<{
    round: number;
    attackerAction: string;
    defenderAction: string;
    damage: number;
    targetSystem: string;
    description: string;
  }> = [];
  const totalDamageBudget = attackerWon ? finalAttack : finalDefense;

  for (let round = 1; round <= rounds; round++) {
    entries.push({
      round,
      attackerAction: pick(COMBAT_ATTACK_PHRASES),
      defenderAction: pick(COMBAT_DEFEND_PHRASES),
      damage: Math.round(totalDamageBudget / rounds),
      targetSystem: pick(SYSTEM_TYPES),
      description: attackerWon
        ? `${attackerName} overpowers ${defenderName}'s simulated defense (${finalAttack} vs ${finalDefense})`
        : `${defenderName} withstands ${attackerName}'s offensive chain (${finalDefense} vs ${finalAttack})`,
    });
  }

  return entries;
}
