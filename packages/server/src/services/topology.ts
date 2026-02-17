import { query } from "../db/pool.js";
import { redis } from "../db/redis.js";
import {
  TOPOLOGY_NODES,
  BOOST_EFFECTS,
  HINDRANCE_EFFECTS,
  ROGUE_MALWARE_CHANCE,
  type TopologyEffect,
} from "@singularities/shared";
import type { WeeklyTopology } from "@singularities/shared";

const REDIS_TOPOLOGY_KEY = "weekly_topology";

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getWeekBounds(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  };
}

export async function generateWeeklyTopology(): Promise<WeeklyTopology> {
  const { weekStart, weekEnd } = getWeekBounds();

  // Pick distinct boosted and hindered nodes
  const boostedNode = randomItem(TOPOLOGY_NODES);
  let hinderedNode = randomItem(TOPOLOGY_NODES);
  while (hinderedNode === boostedNode) {
    hinderedNode = randomItem(TOPOLOGY_NODES);
  }

  const boostEffect = randomItem(BOOST_EFFECTS);
  const hindranceEffect = randomItem(HINDRANCE_EFFECTS);

  // 30% chance of rogue malware special node
  const hasRogueMalware = Math.random() < ROGUE_MALWARE_CHANCE;
  const specialNode = hasRogueMalware
    ? { type: "rogue_malware", name: "Rogue Malware Node", active: true }
    : null;

  const res = await query(
    `INSERT INTO weekly_topologies (week_start, week_end, boosted_node, boost_effect, hindered_node, hindrance_effect, special_node)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [weekStart, weekEnd, boostedNode, JSON.stringify(boostEffect), hinderedNode, JSON.stringify(hindranceEffect), specialNode ? JSON.stringify(specialNode) : null]
  );

  const row = res.rows[0];
  return mapTopologyRow(row);
}

export async function getCurrentTopology(): Promise<WeeklyTopology | null> {
  const { weekStart } = getWeekBounds();

  // Check Redis cache (validate week to avoid stale data across rotation)
  const cached = await redis.get(REDIS_TOPOLOGY_KEY);
  if (cached) {
    const parsed = JSON.parse(cached) as { weekStart: string; topology: WeeklyTopology };
    if (parsed.weekStart === weekStart) return parsed.topology;
  }

  const res = await query(
    "SELECT * FROM weekly_topologies WHERE week_start = $1 ORDER BY created_at DESC LIMIT 1",
    [weekStart]
  );

  if (res.rows.length === 0) return null;

  const topology = mapTopologyRow(res.rows[0]);

  // Cache for 1 hour with week tag
  await redis.set(
    REDIS_TOPOLOGY_KEY,
    JSON.stringify({ weekStart, topology }),
    "EX",
    3600
  );
  return topology;
}

export function getTopologyEffects(topology: WeeklyTopology | null): Record<string, number> {
  if (!topology) return {};

  const effects: Record<string, number> = {};

  if (topology.boostEffect?.modifiers) {
    for (const [key, value] of Object.entries(topology.boostEffect.modifiers)) {
      effects[key] = (effects[key] ?? 1) * value;
    }
  }

  if (topology.hindranceEffect?.modifiers) {
    for (const [key, value] of Object.entries(topology.hindranceEffect.modifiers)) {
      effects[key] = (effects[key] ?? 1) * value;
    }
  }

  return effects;
}

function mapTopologyRow(row: Record<string, unknown>): WeeklyTopology {
  return {
    id: row.id as number,
    weekStart: (row.week_start as string).toString().slice(0, 10),
    weekEnd: (row.week_end as string).toString().slice(0, 10),
    boostedNode: row.boosted_node as string | null,
    boostEffect: row.boost_effect ? (typeof row.boost_effect === "string" ? JSON.parse(row.boost_effect) : row.boost_effect) : null,
    hinderedNode: row.hindered_node as string | null,
    hindranceEffect: row.hindrance_effect ? (typeof row.hindrance_effect === "string" ? JSON.parse(row.hindrance_effect) : row.hindrance_effect) : null,
    specialNode: row.special_node ? (typeof row.special_node === "string" ? JSON.parse(row.special_node) : row.special_node) : null,
  };
}
