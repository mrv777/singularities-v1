import { query, type TxClient } from "../db/pool.js";
import {
  MODULE_MAP,
  PVP_WIN_CHANCE_MIN,
  PVP_WIN_CHANCE_MAX,
  PVP_WIN_CHANCE_SCALE,
  PVP_DEFAULT_DEFENSE_POWER,
  PVP_REWARD_CREDITS_MIN,
  PVP_REWARD_CREDITS_MAX,
  PVP_REWARD_REPUTATION_MIN,
  PVP_REWARD_REPUTATION_MAX,
  PVP_REWARD_XP,
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
  type LoadoutType,
} from "@singularities/shared";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

type DbQuery = (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

function getStatusForHealth(health: number): string {
  if (health <= SYSTEM_STATUS_THRESHOLDS.CORRUPTED.max) return "CORRUPTED";
  if (health <= SYSTEM_STATUS_THRESHOLDS.CRITICAL.max) return "CRITICAL";
  if (health <= SYSTEM_STATUS_THRESHOLDS.DEGRADED.max) return "DEGRADED";
  return "OPTIMAL";
}

/**
 * Get the total power of a player's loadout for a given type.
 * Sums hackPower for attack, defense for defense loadouts, plus level bonuses.
 */
export async function getLoadoutPower(
  playerId: string,
  loadoutType: LoadoutType,
  client?: TxClient
): Promise<number> {
  const dbQuery: DbQuery = client
    ? (text, params) => client.query(text, params)
    : (text, params) => query(text, params);

  const res = await dbQuery(
    `SELECT pm.module_id, pm.level FROM player_loadouts pl
     JOIN player_modules pm ON pm.player_id = pl.player_id AND pm.module_id = pl.module_id
     WHERE pl.player_id = $1 AND pl.loadout_type = $2`,
    [playerId, loadoutType]
  );

  let power = 0;
  const statKey = loadoutType === "defense" ? "defense" : "hackPower";

  for (const mod of res.rows) {
    const moduleId = mod.module_id as string;
    const level = mod.level as number;
    const def = MODULE_MAP[moduleId];
    if (!def) continue;
    const baseStat = (def.effects[statKey] ?? 0);
    power += baseStat * level;
  }

  return power || PVP_DEFAULT_DEFENSE_POWER;
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
  const dbQuery: DbQuery = client
    ? (text, params) => client.query(text, params)
    : (text, params) => query(text, params);

  const res = await dbQuery(
    "SELECT health FROM player_systems WHERE player_id = $1",
    [playerId]
  );

  if (res.rows.length === 0) return 1;
  const avg = res.rows.reduce((sum, r) => sum + (r.health as number), 0) / res.rows.length;
  return Math.max(0.1, avg / 100); // Floor at 10% so attacks aren't completely zero
}

/**
 * Generate combat narrative lines (3-5 rounds).
 */
export function generateCombatNarrative(
  attackerName: string,
  defenderName: string,
  rounds: number,
  attackerWon: boolean
): string[] {
  const lines: string[] = [];
  lines.push(`> PVP COMBAT INITIATED: ${attackerName} vs ${defenderName}`);
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
    lines.push(`> RESULT: ${attackerName} WINS. ${defenderName}'s defenses breached.`);
  } else {
    lines.push(`> RESULT: ${defenderName} WINS. ${attackerName}'s attack repelled.`);
  }

  return lines;
}

export interface CombatOutcome {
  result: "attacker_win" | "defender_win";
  narrative: string[];
  rewards?: { credits: number; reputation: number; xp: number };
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

  // Get loadout powers
  const attackPower = await getLoadoutPower(attackerId, "attack", client);
  const defensePower = await getLoadoutPower(defenderId, "defense", client);

  // Get traits
  const [attackerTraitsRes, defenderTraitsRes] = await Promise.all([
    client.query("SELECT trait_id FROM player_traits WHERE player_id = $1", [attackerId]),
    client.query("SELECT trait_id FROM player_traits WHERE player_id = $1", [defenderId]),
  ]);
  const attackerTraits = attackerTraitsRes.rows.map((r) => r.trait_id as string);
  const defenderTraits = defenderTraitsRes.rows.map((r) => r.trait_id as string);

  // Apply trait modifiers
  const modifiedAttack = applyTraitModifiers(attackPower, "hackPower", attackerTraits);
  const modifiedDefense = applyTraitModifiers(defensePower, "defense", defenderTraits);

  // System health multiplier for attacker
  const healthMult = await getSystemHealthMultiplier(attackerId, client);
  const finalAttack = Math.round(modifiedAttack * healthMult);

  // Calculate win chance
  const rawChance = 50 + (finalAttack - modifiedDefense) / PVP_WIN_CHANCE_SCALE * 100;
  const winChance = Math.max(PVP_WIN_CHANCE_MIN, Math.min(PVP_WIN_CHANCE_MAX, rawChance));
  const roll = randomInt(1, 100);
  const attackerWon = roll <= winChance;

  // Generate narrative
  const rounds = randomInt(3, 5);
  const narrative = generateCombatNarrative(attackerName, defenderName, rounds, attackerWon);

  // Build combat log entries
  const combatLogEntries = [];
  for (let i = 1; i <= rounds; i++) {
    combatLogEntries.push({
      round: i,
      attackerAction: pick(COMBAT_ATTACK_PHRASES),
      defenderAction: pick(COMBAT_DEFEND_PHRASES),
      damage: randomInt(5, 15),
      targetSystem: pick(SYSTEM_TYPES),
      description: `Round ${i} of combat`,
    });
  }

  const result: "attacker_win" | "defender_win" = attackerWon ? "attacker_win" : "defender_win";

  if (attackerWon) {
    // Calculate rewards scaled by defender level
    const credits = randomInt(PVP_REWARD_CREDITS_MIN, PVP_REWARD_CREDITS_MAX)
      + defenderLevel * 5;
    const reputation = randomInt(PVP_REWARD_REPUTATION_MIN, PVP_REWARD_REPUTATION_MAX);
    const xp = PVP_REWARD_XP;

    // Determine damage to loser's systems
    const systemCount = randomInt(PVP_LOSER_SYSTEMS_MIN, PVP_LOSER_SYSTEMS_MAX);
    const shuffled = [...SYSTEM_TYPES].sort(() => Math.random() - 0.5);
    const affectedSystems = shuffled.slice(0, systemCount);

    const damageSystems: Array<{ systemType: string; damage: number }> = [];
    for (const sysType of affectedSystems) {
      const damagePct = randomInt(PVP_LOSER_DAMAGE_MIN_PCT, PVP_LOSER_DAMAGE_MAX_PCT);
      damageSystems.push({ systemType: sysType, damage: damagePct });
    }

    narrative.push(`> Rewards: +${credits} CR, +${reputation} REP, +${xp} XP`);

    return {
      result,
      narrative,
      rewards: { credits, reputation, xp },
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
 */
export async function applyCombatDamage(
  playerId: string,
  damageSystems: Array<{ systemType: string; damage: number }>,
  client: TxClient
): Promise<void> {
  for (const { systemType, damage } of damageSystems) {
    const sysRes = await client.query(
      "SELECT * FROM player_systems WHERE player_id = $1 AND system_type = $2 FOR UPDATE",
      [playerId, systemType]
    );
    if (sysRes.rows.length === 0) continue;

    const currentHealth = sysRes.rows[0].health as number;
    const newHealth = Math.max(0, currentHealth - damage);
    const newStatus = getStatusForHealth(newHealth);

    await client.query(
      "UPDATE player_systems SET health = $1, status = $2, updated_at = NOW() WHERE player_id = $3 AND system_type = $4",
      [newHealth, newStatus, playerId, systemType]
    );
  }
}
