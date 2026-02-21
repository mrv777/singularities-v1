import { query, withTransaction, type TxClient } from "../db/pool.js";
import { redis } from "../db/redis.js";
import {
  ALL_DECISIONS,
  DECISION_MAP,
  DECISION_TRIGGER_CHANCES,
  DECISION_BALANCE,
  getDecisionResourceCap,
  type BinaryDecision,
} from "@singularities/shared";
import { shiftAlignment } from "./alignment.js";
import { computeEnergy, mapPlayerRow } from "./player.js";

type TriggerType = "afterHack" | "afterCombat" | "onLogin";

export async function triggerDecision(
  playerId: string,
  triggeredBy: TriggerType
): Promise<boolean> {
  const chance = DECISION_TRIGGER_CHANCES[triggeredBy];
  if (Math.random() > chance) return false;

  // Check for existing pending decision
  const existing = await query(
    "SELECT id FROM pending_decisions WHERE player_id = $1",
    [playerId]
  );
  if (existing.rows.length > 0) return false;

  // Get player level for filtering
  const playerRes = await query("SELECT level FROM players WHERE id = $1", [playerId]);
  if (playerRes.rows.length === 0) return false;
  const playerLevel = playerRes.rows[0].level as number;

  // Get already-seen decisions
  const seenRes = await query(
    "SELECT decision_id FROM player_decisions WHERE player_id = $1",
    [playerId]
  );
  const seenIds = new Set(seenRes.rows.map((r) => r.decision_id as string));

  // Filter eligible decisions
  const eligible = ALL_DECISIONS.filter(
    (d) => d.levelRequirement <= playerLevel && !seenIds.has(d.id)
  );
  if (eligible.length === 0) return false;

  // Weighted random by rarity
  const weights = eligible.map((d) =>
    d.rarity === "rare" ? 1 : d.rarity === "uncommon" ? 3 : 6
  );
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;
  let selected = eligible[0];
  for (let i = 0; i < eligible.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      selected = eligible[i];
      break;
    }
  }

  // Insert pending decision
  await query(
    `INSERT INTO pending_decisions (id, player_id, decision_id, triggered_by)
     VALUES (gen_random_uuid(), $1, $2, $3)
     ON CONFLICT (player_id, decision_id) DO NOTHING`,
    [playerId, selected.id, triggeredBy]
  );

  return true;
}

export async function getPendingDecision(
  playerId: string
): Promise<{ pending: { id: string; decisionId: string; triggeredBy: string; createdAt: string }; definition: BinaryDecision } | null> {
  const res = await query(
    "SELECT * FROM pending_decisions WHERE player_id = $1 LIMIT 1",
    [playerId]
  );

  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  const decisionId = row.decision_id as string;
  const definition = DECISION_MAP[decisionId];
  if (!definition) return null;

  return {
    pending: {
      id: row.id as string,
      decisionId,
      triggeredBy: row.triggered_by as string,
      createdAt: (row.created_at as Date).toISOString(),
    },
    definition,
  };
}

export async function resolveDecision(
  playerId: string,
  decisionId: string,
  choice: "yes" | "no"
) {
  const definition = DECISION_MAP[decisionId];
  if (!definition) {
    throw { statusCode: 400, message: "Unknown decision" };
  }

  return withTransaction(async (client) => {
    // Verify pending decision exists
    const pendingRes = await client.query(
      "SELECT id FROM pending_decisions WHERE player_id = $1 AND decision_id = $2",
      [playerId, decisionId]
    );
    if (pendingRes.rows.length === 0) {
      throw { statusCode: 400, message: "No pending decision with that ID" };
    }

    const effects = choice === "yes" ? definition.yesEffects : definition.noEffects;
    const alignmentAmount = definition.alignmentShift[choice];
    const playerRes = await client.query("SELECT level FROM players WHERE id = $1", [playerId]);
    const playerLevel = playerRes.rows.length > 0 ? (playerRes.rows[0].level as number) : 1;
    const appliedDescriptions: string[] = [];

    // Apply effects
    for (const effect of effects) {
      if (effect.type === "resource_grant") {
        const column = toSnakeCase(effect.target);
        const normalizedValue = normalizeResourceGrant(
          effect.target,
          effect.value,
          definition.rarity,
          playerLevel
        );
        await client.query(
          `UPDATE players SET ${column} = GREATEST(0, ${column} + $2) WHERE id = $1`,
          [playerId, normalizedValue]
        );
        appliedDescriptions.push(formatResourceGrantDescription(effect.target, normalizedValue));
      } else if (effect.type === "system_health") {
        await client.query(
          `UPDATE player_systems SET health = GREATEST(0, LEAST(100, health + $3)), updated_at = NOW()
           WHERE player_id = $1 AND system_type = $2`,
          [playerId, effect.target, effect.value]
        );
        appliedDescriptions.push(effect.description);
      }
      else if (effect.type === "stat_modifier") {
        const key = `buff:${playerId}:${effect.target}`;
        const ttl = effect.duration ?? 3600;
        const existing = await redis.get(key);
        const newValue = (existing ? parseInt(existing, 10) : 0) + effect.value;
        await redis.set(key, String(newValue), "EX", ttl);
        appliedDescriptions.push(effect.description);
      }
      // permanent_buff, permanent_debuff — not yet implemented
    }

    // Shift alignment
    await shiftAlignment(playerId, alignmentAmount, client);

    // Record decision
    await client.query(
      `INSERT INTO player_decisions (player_id, decision_id, choice, effects)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (player_id, decision_id) DO NOTHING`,
      [playerId, decisionId, choice, JSON.stringify(effects)]
    );

    // Delete pending
    await client.query(
      "DELETE FROM pending_decisions WHERE player_id = $1 AND decision_id = $2",
      [playerId, decisionId]
    );

    // Get updated player
    const updatedPlayerRes = await client.query("SELECT * FROM players WHERE id = $1", [playerId]);
    const player = computeEnergy(updatedPlayerRes.rows[0]);

    return {
      effects: appliedDescriptions.map((description) => ({ description })),
      alignmentShift: alignmentAmount,
      player: mapPlayerRow({ ...updatedPlayerRes.rows[0], energy: player.energy }),
    };
  });
}

export async function getDecisionHistory(playerId: string) {
  const res = await query(
    "SELECT * FROM player_decisions WHERE player_id = $1 ORDER BY created_at DESC LIMIT 50",
    [playerId]
  );

  return res.rows.map((r) => ({
    decisionId: r.decision_id as string,
    choice: r.choice as "yes" | "no",
    effects: r.effects as Record<string, unknown> | null,
    createdAt: (r.created_at as Date).toISOString(),
  }));
}

const BUFF_STAT_KEYS = [
  "hackPower", "defense", "stealth", "efficiency",
  "creditBonus", "dataBonus",
] as const;

export async function getActiveDecisionBuffs(
  playerId: string
): Promise<Record<string, number>> {
  const keys = BUFF_STAT_KEYS.map((k) => `buff:${playerId}:${k}`);
  const values = await redis.mget(...keys);
  const buffs: Record<string, number> = {};
  for (let i = 0; i < BUFF_STAT_KEYS.length; i++) {
    const v = values[i];
    if (v) buffs[BUFF_STAT_KEYS[i]] = parseInt(v, 10);
  }
  return buffs;
}

function toSnakeCase(s: string): string {
  const map: Record<string, string> = {
    credits: "credits",
    data: "data",
    processingPower: "processing_power",
    reputation: "reputation",
    energy: "energy",
  };
  return map[s] ?? s;
}

function normalizeResourceGrant(
  target: string,
  baseValue: number,
  rarity: BinaryDecision["rarity"],
  playerLevel: number
): number {
  if (baseValue <= 0) return baseValue;

  const rarityScale = DECISION_BALANCE.rarityResourceScale[rarity] ?? 1;
  const scaled = Math.round(
    baseValue * rarityScale * (1 + playerLevel * DECISION_BALANCE.levelScalePerLevel)
  );

  if (target === "credits") {
    return Math.min(scaled, getDecisionResourceCap("credits", playerLevel));
  }
  if (target === "data") {
    return Math.min(scaled, getDecisionResourceCap("data", playerLevel));
  }
  if (target === "processingPower") {
    return Math.min(scaled, getDecisionResourceCap("processingPower", playerLevel));
  }
  if (target === "reputation") {
    return Math.min(scaled, getDecisionResourceCap("reputation", playerLevel));
  }
  return scaled;
}

function formatResourceGrantDescription(target: string, value: number): string {
  const labelMap: Record<string, string> = {
    credits: "credits",
    data: "data",
    processingPower: "processing power",
    reputation: "reputation",
  };
  const label = labelMap[target] ?? target;
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value} ${label}`;
}
