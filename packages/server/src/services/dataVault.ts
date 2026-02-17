import { randomUUID } from "node:crypto";
import { redis } from "../db/redis.js";
import { query, withTransaction } from "../db/pool.js";
import { computeEnergy, mapPlayerRow } from "./player.js";
import {
  DATA_VAULT_BALANCE,
  DATA_VAULT_PROTOCOLS,
  DATA_VAULT_PROTOCOL_MAP,
  PROGRESSION_BALANCE,
  type DataVaultProtocolDefinition,
  type DataVaultActiveProtocol,
  type DataVaultBuffKey,
} from "@singularities/shared";

const ACTIVE_KEY = (playerId: string) => `data_vault:active:${playerId}`;
const COOLDOWN_KEY = (playerId: string) => `data_vault:cooldown:${playerId}`;
const ACTIVATION_LOCK_KEY = (playerId: string) => `data_vault:activate_lock:${playerId}`;
const DAILY_USES_KEY = (playerId: string, date: string) =>
  `data_vault:uses:${playerId}:${date}`;
const ACTIVATION_LOCK_SECONDS = 10;

export class DataVaultError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function utcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function secondsUntilUtcMidnight(now = new Date()): number {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)
  );
  return Math.max(1, Math.floor((next.getTime() - now.getTime()) / 1000));
}

function safeParseInt(raw: string | null): number {
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function decodeActiveProtocol(raw: string | null): DataVaultActiveProtocol | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DataVaultActiveProtocol;
    if (!parsed.id || !parsed.name || !parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildActiveProtocol(
  protocol: DataVaultProtocolDefinition,
  activatedAt: Date
): DataVaultActiveProtocol {
  return {
    id: protocol.id,
    name: protocol.name,
    expiresAt: new Date(
      activatedAt.getTime() + protocol.durationSeconds * 1000
    ).toISOString(),
    buffs: { ...protocol.buffs },
  };
}

async function applyProtocolBuffs(
  playerId: string,
  protocol: DataVaultProtocolDefinition
): Promise<void> {
  const entries = Object.entries(protocol.buffs) as Array<[DataVaultBuffKey, number]>;
  for (const [stat, amount] of entries) {
    if (!amount) continue;
    const key = `buff:${playerId}:${stat}`;
    const [existing, ttl] = await Promise.all([redis.get(key), redis.ttl(key)]);
    const total = safeParseInt(existing) + amount;
    const expiry = ttl > 0 ? Math.max(ttl, protocol.durationSeconds) : protocol.durationSeconds;
    await redis.set(key, String(total), "EX", expiry);
  }
}

async function acquireActivationLock(playerId: string): Promise<string> {
  const token = randomUUID();
  const ok = await redis.set(
    ACTIVATION_LOCK_KEY(playerId),
    token,
    "EX",
    ACTIVATION_LOCK_SECONDS,
    "NX"
  );
  if (!ok) {
    throw new DataVaultError(409, "Data Vault activation already in progress");
  }
  return token;
}

async function releaseActivationLock(playerId: string, token: string): Promise<void> {
  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    end
    return 0
  `;
  try {
    await redis.eval(script, 1, ACTIVATION_LOCK_KEY(playerId), token);
  } catch {
    // Best-effort unlock; lock auto-expires if Redis is unavailable.
  }
}

async function assertUnlocked(playerId: string): Promise<void> {
  const playerRes = await query("SELECT level FROM players WHERE id = $1", [playerId]);
  if (playerRes.rows.length === 0) {
    throw new DataVaultError(404, "Player not found");
  }
  const level = playerRes.rows[0].level as number;
  if (level < PROGRESSION_BALANCE.unlockLevels.data_vault) {
    throw new DataVaultError(
      400,
      `Data Vault unlocks at level ${PROGRESSION_BALANCE.unlockLevels.data_vault}`
    );
  }
}

export async function getDataVaultStatus(playerId: string) {
  await assertUnlocked(playerId);
  const todayKey = DAILY_USES_KEY(playerId, utcDateString());

  const [activeRaw, cooldownExpiresAt, usageRaw] = await Promise.all([
    redis.get(ACTIVE_KEY(playerId)),
    redis.get(COOLDOWN_KEY(playerId)),
    redis.get(todayKey),
  ]);

  return {
    protocols: DATA_VAULT_PROTOCOLS,
    activeProtocol: decodeActiveProtocol(activeRaw),
    cooldownExpiresAt: cooldownExpiresAt ?? null,
    dailyUses: safeParseInt(usageRaw),
    dailyUseCap: DATA_VAULT_BALANCE.dailyUseCap,
  };
}

export async function activateDataVaultProtocol(playerId: string, protocolId: string) {
  const protocol = DATA_VAULT_PROTOCOL_MAP[protocolId];
  if (!protocol) {
    throw new DataVaultError(400, "Unknown Data Vault protocol");
  }
  const lockToken = await acquireActivationLock(playerId);
  try {
    await assertUnlocked(playerId);

    const now = new Date();
    const todayUsageKey = DAILY_USES_KEY(playerId, utcDateString());
    const [activeRaw, cooldownRaw, usageRaw] = await Promise.all([
      redis.get(ACTIVE_KEY(playerId)),
      redis.get(COOLDOWN_KEY(playerId)),
      redis.get(todayUsageKey),
    ]);

    if (decodeActiveProtocol(activeRaw)) {
      throw new DataVaultError(409, "A Data Vault protocol is already active");
    }
    if (cooldownRaw) {
      throw new DataVaultError(409, "Data Vault is cooling down");
    }
    const dailyUses = safeParseInt(usageRaw);
    if (dailyUses >= DATA_VAULT_BALANCE.dailyUseCap) {
      throw new DataVaultError(409, "Daily Data Vault limit reached");
    }

    const player = await withTransaction(async (client) => {
      const playerRes = await client.query("SELECT * FROM players WHERE id = $1 FOR UPDATE", [playerId]);
      if (playerRes.rows.length === 0) {
        throw new DataVaultError(404, "Player not found");
      }

      const row = computeEnergy(playerRes.rows[0]);
      const level = row.level as number;
      if (level < PROGRESSION_BALANCE.unlockLevels.data_vault) {
        throw new DataVaultError(
          400,
          `Data Vault unlocks at level ${PROGRESSION_BALANCE.unlockLevels.data_vault}`
        );
      }

      const credits = row.credits as number;
      const data = row.data as number;
      if (credits < protocol.costs.credits || data < protocol.costs.data) {
        throw new DataVaultError(400, "Not enough resources");
      }

      await client.query(
        `UPDATE players
         SET credits = credits - $2,
             data = data - $3
         WHERE id = $1`,
        [playerId, protocol.costs.credits, protocol.costs.data]
      );

      const updatedRes = await client.query("SELECT * FROM players WHERE id = $1", [playerId]);
      return mapPlayerRow(computeEnergy(updatedRes.rows[0]));
    });

    const activeProtocol = buildActiveProtocol(protocol, now);
    const cooldownTotalSeconds = protocol.durationSeconds + DATA_VAULT_BALANCE.cooldownSeconds;
    const cooldownExpiresAt = new Date(
      now.getTime() + cooldownTotalSeconds * 1000
    ).toISOString();

    await applyProtocolBuffs(playerId, protocol);
    await Promise.all([
      redis.set(
        ACTIVE_KEY(playerId),
        JSON.stringify(activeProtocol),
        "EX",
        protocol.durationSeconds
      ),
      redis.set(
        COOLDOWN_KEY(playerId),
        cooldownExpiresAt,
        "EX",
        cooldownTotalSeconds
      ),
    ]);

    const nextDailyUses = await redis.incr(todayUsageKey);
    if (nextDailyUses === 1) {
      await redis.expire(todayUsageKey, secondsUntilUtcMidnight(now));
    }

    return {
      player,
      activeProtocol,
      cooldownExpiresAt,
      dailyUses: nextDailyUses,
      dailyUseCap: DATA_VAULT_BALANCE.dailyUseCap,
    };
  } finally {
    await releaseActivationLock(playerId, lockToken);
  }
}
