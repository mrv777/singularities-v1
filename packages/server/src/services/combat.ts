import { type TxClient } from "../db/pool.js";
import {
  pickTemplate,
  fillTemplate,
  COMBAT_INITIATION_TEMPLATES,
  COMBAT_VICTORY_TEMPLATES,
  COMBAT_DEFEAT_TEMPLATES,
  PVP_WIN_CHANCE_MIN,
  PVP_WIN_CHANCE_MAX,
  PVP_WIN_CHANCE_SCALE,
  PVP_DEFAULT_DEFENSE_POWER,
  PVP_REWARD_CREDITS_MIN,
  PVP_REWARD_CREDITS_MAX,
  PVP_REWARD_CREDITS_STEAL_PCT_MIN,
  PVP_REWARD_CREDITS_STEAL_PCT_MAX,
  PVP_REWARD_CREDITS_LEVEL_BONUS,
  PVP_REWARD_REPUTATION_MIN,
  PVP_REWARD_REPUTATION_MAX,
  PVP_REWARD_XP,
  PVP_REWARD_DATA_MIN,
  PVP_REWARD_DATA_MAX,
  PVP_REWARD_DATA_LEVEL_BONUS,
  PVP_REWARD_PROCESSING_POWER_MIN,
  PVP_REWARD_PROCESSING_POWER_MAX,
  PVP_LOSER_DAMAGE_MIN_PCT,
  PVP_LOSER_DAMAGE_MAX_PCT,
  PVP_LOSER_SYSTEMS_MIN,
  PVP_LOSER_SYSTEMS_MAX,
  COMBAT_ATTACK_PHRASES,
  COMBAT_DEFEND_PHRASES,
  COMBAT_HIT_PHRASES,
  COMBAT_MISS_PHRASES,
  SYSTEM_TYPES,
  SYSTEM_STATUS_THRESHOLDS,
  TRAIT_MAP,
  DIVERSITY_BONUS,
  type LoadoutType,
} from "@singularities/shared";
import { resolveLoadoutStats, type ResolvedStats } from "./stats.js";
import { computeSystemHealth } from "./maintenance.js";
import { getActiveModifierEffects } from "./modifiers.js";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function getStatusForHealth(health: number): string {
  if (health <= SYSTEM_STATUS_THRESHOLDS.CORRUPTED.max) return "CORRUPTED";
  if (health <= SYSTEM_STATUS_THRESHOLDS.CRITICAL.max) return "CRITICAL";
  if (health <= SYSTEM_STATUS_THRESHOLDS.DEGRADED.max) return "DEGRADED";
  return "OPTIMAL";
}

/**
 * Compute power from resolved stats. Shared by getLoadoutPower and resolveAttack.
 */
function computePower(
  stats: ResolvedStats,
  loadoutType: LoadoutType
): number {
  const divBonus = DIVERSITY_BONUS[stats.categoryCount] ?? 0;
  if (loadoutType === "defense") {
    return Math.round(
      stats.defense + stats.efficiency * 0.30 + stats.hackPower * 0.10 + divBonus
    ) || PVP_DEFAULT_DEFENSE_POWER;
  }
  return Math.round(
    (stats.hackPower + stats.stealth * 0.25 + stats.defense * 0.10 + divBonus)
    * stats.healthMultiplier
  ) || PVP_DEFAULT_DEFENSE_POWER;
}

/**
 * Get the total power of a player's loadout for a given type.
 * Uses the shared stat resolution pipeline.
 */
export async function getLoadoutPower(
  playerId: string,
  loadoutType: LoadoutType,
  client?: TxClient
): Promise<number> {
  const stats = await resolveLoadoutStats(playerId, loadoutType, client);
  return computePower(stats, loadoutType);
}

/**
 * Apply genetic trait modifiers to a base stat value.
 */
export function applyTraitModifiers(
  baseStat: number,
  statType: string,
  traitIds: string[]
): number {
  let multiplier = 1;
  for (const traitId of traitIds) {
    const trait = TRAIT_MAP[traitId];
    if (!trait) continue;
    if (trait.positive.stat === statType) {
      multiplier += trait.positive.modifier;
    }
    if (trait.negative.stat === statType) {
      multiplier += trait.negative.modifier;
    }
  }
  return Math.round(baseStat * multiplier);
}

/**
 * Get average system health as a 0-1 multiplier.
 */
export async function getSystemHealthMultiplier(
  playerId: string,
  client?: TxClient
): Promise<number> {
  const stats = await resolveLoadoutStats(playerId, "attack", client);
  return stats.healthMultiplier;
}

/**
 * Generate combat narrative lines with actual stat context.
 */
export function generateCombatNarrative(
  attackerName: string,
  defenderName: string,
  rounds: number,
  attackerWon: boolean,
  finalAttack: number,
  finalDefense: number,
  winChance: number
): string[] {
  const lines: string[] = [];
  lines.push(fillTemplate(pickTemplate(COMBAT_INITIATION_TEMPLATES), {
    attacker: attackerName,
    defender: defenderName,
  }));
  lines.push(`> Attack power: ${finalAttack} | Defense power: ${finalDefense} | Win chance: ${Math.round(winChance)}%`);
  lines.push(`> ---`);

  for (let i = 1; i <= rounds; i++) {
    const attackPhrase = pick(COMBAT_ATTACK_PHRASES);
    const defendPhrase = pick(COMBAT_DEFEND_PHRASES);
    const isHit = i <= rounds - 1
      ? Math.random() > 0.4
      : attackerWon; // Last round determines winner

    lines.push(`> Round ${i}: ${attackerName} ${attackPhrase} ${defenderName}`);
    lines.push(`>   ${defenderName} ${defendPhrase}`);

    if (isHit) {
      lines.push(`>   IMPACT: ${pick(COMBAT_HIT_PHRASES)}`);
    } else {
      lines.push(`>   BLOCKED: ${pick(COMBAT_MISS_PHRASES)}`);
    }
  }

  lines.push(`> ---`);
  if (attackerWon) {
    lines.push(fillTemplate(pickTemplate(COMBAT_VICTORY_TEMPLATES), {
      winner: attackerName,
      loser: defenderName,
    }));
  } else {
    lines.push(fillTemplate(pickTemplate(COMBAT_DEFEAT_TEMPLATES), {
      winner: defenderName,
      loser: attackerName,
    }));
  }

  return lines;
}

export interface CombatOutcome {
  result: "attacker_win" | "defender_win";
  narrative: string[];
  rewards?: { credits: number; data: number; reputation: number; xp: number; processingPower: number };
  damage?: { systems: Array<{ systemType: string; damage: number }> };
  combatLogEntries: Array<{
    round: number;
    attackerAction: string;
    defenderAction: string;
    damage: number;
    targetSystem: string;
    description: string;
  }>;
}

/**
 * Core combat resolution. Does NOT write to DB — caller handles that.
 */
export async function resolveAttack(
  attackerId: string,
  defenderId: string,
  client: TxClient
): Promise<CombatOutcome> {
  // Load attacker & defender data
  const [attackerRes, defenderRes] = await Promise.all([
    client.query("SELECT * FROM players WHERE id = $1", [attackerId]),
    client.query("SELECT * FROM players WHERE id = $1", [defenderId]),
  ]);

  const attacker = attackerRes.rows[0];
  const defender = defenderRes.rows[0];
  const attackerName = attacker.ai_name as string;
  const defenderName = defender.ai_name as string;
  const defenderLevel = defender.level as number;
  const defenderCredits = defender.credits as number;

  // Resolve stats through shared pipeline (modules × level + traits + health)
  const [attackerStats, defenderStats] = await Promise.all([
    resolveLoadoutStats(attackerId, "attack", client),
    resolveLoadoutStats(defenderId, "defense", client),
  ]);

  const finalAttack = computePower(attackerStats, "attack");
  const finalDefense = computePower(defenderStats, "defense");

  // Calculate win chance
  const rawChance = 50 + (finalAttack - finalDefense) / PVP_WIN_CHANCE_SCALE * 100;
  const winChance = Math.max(PVP_WIN_CHANCE_MIN, Math.min(PVP_WIN_CHANCE_MAX, rawChance));
  const roll = randomInt(1, 100);
  const attackerWon = roll <= winChance;

  // Generate narrative with actual power values
  const rounds = randomInt(3, 5);
  const narrative = generateCombatNarrative(
    attackerName, defenderName, rounds, attackerWon,
    finalAttack, finalDefense, winChance
  );

  // Build combat log entries reflecting actual combat math
  const combatLogEntries = [];
  const totalDamageBudget = attackerWon ? finalAttack : finalDefense;
  for (let i = 1; i <= rounds; i++) {
    // Distribute damage proportionally across rounds for transparency
    const roundDamage = Math.round(totalDamageBudget / rounds);
    combatLogEntries.push({
      round: i,
      attackerAction: pick(COMBAT_ATTACK_PHRASES),
      defenderAction: pick(COMBAT_DEFEND_PHRASES),
      damage: roundDamage,
      targetSystem: pick(SYSTEM_TYPES),
      description: attackerWon
        ? `${attackerName} overpowers ${defenderName}'s defense (${finalAttack} vs ${finalDefense})`
        : `${defenderName} holds against ${attackerName}'s attack (${finalDefense} vs ${finalAttack})`,
    });
  }

  const result: "attacker_win" | "defender_win" = attackerWon ? "attacker_win" : "defender_win";

  if (attackerWon) {
    // Calculate rewards: baseline + partial credit transfer from defender.
    const baseCredits = randomInt(PVP_REWARD_CREDITS_MIN, PVP_REWARD_CREDITS_MAX)
      + defenderLevel * PVP_REWARD_CREDITS_LEVEL_BONUS;
    const transferPct = randomInt(
      Math.round(PVP_REWARD_CREDITS_STEAL_PCT_MIN * 100),
      Math.round(PVP_REWARD_CREDITS_STEAL_PCT_MAX * 100)
    ) / 100;
    const transferCredits = Math.floor(defenderCredits * transferPct);
    const credits = Math.max(20, Math.min(defenderCredits, baseCredits + transferCredits));
    const dataReward = randomInt(PVP_REWARD_DATA_MIN, PVP_REWARD_DATA_MAX)
      + defenderLevel * PVP_REWARD_DATA_LEVEL_BONUS;
    const reputation = randomInt(PVP_REWARD_REPUTATION_MIN, PVP_REWARD_REPUTATION_MAX);
    const xp = PVP_REWARD_XP;
    const processingPower = randomInt(PVP_REWARD_PROCESSING_POWER_MIN, PVP_REWARD_PROCESSING_POWER_MAX);

    // Determine damage to loser's systems
    const systemCount = randomInt(PVP_LOSER_SYSTEMS_MIN, PVP_LOSER_SYSTEMS_MAX);
    const shuffled = [...SYSTEM_TYPES].sort(() => Math.random() - 0.5);
    const affectedSystems = shuffled.slice(0, systemCount);

    const damageSystems: Array<{ systemType: string; damage: number }> = [];
    for (const sysType of affectedSystems) {
      const damagePct = randomInt(PVP_LOSER_DAMAGE_MIN_PCT, PVP_LOSER_DAMAGE_MAX_PCT);
      damageSystems.push({ systemType: sysType, damage: damagePct });
    }

    narrative.push(`> Rewards: +${credits} CR, +${dataReward} DATA, +${reputation} REP, +${xp} XP, +${processingPower} PP`);

    return {
      result,
      narrative,
      rewards: { credits, data: dataReward, reputation, xp, processingPower },
      damage: { systems: damageSystems },
      combatLogEntries,
    };
  } else {
    // Attacker loses: attacker takes damage
    const systemCount = randomInt(PVP_LOSER_SYSTEMS_MIN, PVP_LOSER_SYSTEMS_MAX);
    const shuffled = [...SYSTEM_TYPES].sort(() => Math.random() - 0.5);
    const affectedSystems = shuffled.slice(0, systemCount);

    const damageSystems: Array<{ systemType: string; damage: number }> = [];
    for (const sysType of affectedSystems) {
      const damagePct = randomInt(PVP_LOSER_DAMAGE_MIN_PCT, PVP_LOSER_DAMAGE_MAX_PCT);
      damageSystems.push({ systemType: sysType, damage: damagePct });
    }

    narrative.push(`> Attacker systems damaged: ${damageSystems.map(d => `${d.systemType} -${d.damage}HP`).join(", ")}`);

    return {
      result,
      narrative,
      damage: { systems: damageSystems },
      combatLogEntries,
    };
  }
}

/**
 * Apply combat damage to a player's systems.
 * Fix 3: Materializes degraded health before applying damage.
 */
export async function applyCombatDamage(
  playerId: string,
  damageSystems: Array<{ systemType: string; damage: number }>,
  client: TxClient
): Promise<void> {
  const modifierEffects = await getActiveModifierEffects();

  for (const { systemType, damage } of damageSystems) {
    const sysRes = await client.query(
      "SELECT * FROM player_systems WHERE player_id = $1 AND system_type = $2 FOR UPDATE",
      [playerId, systemType]
    );
    if (sysRes.rows.length === 0) continue;

    // Materialize degraded health before applying combat damage
    const computed = computeSystemHealth(sysRes.rows[0], modifierEffects);
    const currentHealth = computed.health as number;

    const newHealth = Math.max(0, currentHealth - damage);
    const newStatus = getStatusForHealth(newHealth);

    await client.query(
      "UPDATE player_systems SET health = $1, status = $2, updated_at = NOW() WHERE player_id = $3 AND system_type = $4",
      [newHealth, newStatus, playerId, systemType]
    );
  }
}
