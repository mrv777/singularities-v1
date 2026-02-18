import type { WebSocket } from "@fastify/websocket";
import type {
  ServerChatMessage,
  GlobalChatMessage,
  SystemEventMessage,
  ActivityLogMessage,
  ServerChatEnvelope,
  ClientChatPayload,
} from "@singularities/shared";
import { randomUUID } from "crypto";
import { redis } from "../db/redis.js";

interface ConnectedClient {
  socket: WebSocket;
  playerId: string;
  playerName: string;
  playerLevel: number;
  alignment: number;
  lastMessage: number; // timestamp for rate limiting
}

const clients = new Map<string, ConnectedClient>();

// Rolling message buffers per channel (in-memory cache + Redis persistence)
const MAX_HISTORY = 50;

const REDIS_KEYS = {
  global: "chat:history:global",
  events: "chat:history:events",
  activity: (pid: string) => `chat:history:activity:${pid}`,
};

const RATE_LIMIT_MS = 2000; // 1 msg per 2s

async function persistMessage(key: string, msg: ServerChatMessage) {
  try {
    await redis.pipeline()
      .rpush(key, JSON.stringify(msg))
      .ltrim(key, -MAX_HISTORY, -1)
      .expire(key, 86400 * 3) // 3 days TTL
      .exec();
  } catch (err) {
    console.error(`Failed to persist message to Redis (${key}):`, err);
  }
}

async function getHistoryFromRedis(key: string): Promise<ServerChatMessage[]> {
  try {
    const raw = await redis.lrange(key, 0, -1);
    return raw.map((r) => JSON.parse(r));
  } catch (err) {
    console.error(`Failed to fetch history from Redis (${key}):`, err);
    return [];
  }
}

function send(socket: WebSocket, envelope: ServerChatEnvelope) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(envelope));
  }
}

export async function handleConnection(
  socket: WebSocket,
  playerId: string,
  playerName: string,
  playerLevel: number,
  alignment: number
) {
  // Register client
  const existing = clients.get(playerId);
  if (existing) {
    try { existing.socket.close(); } catch { /* ignore */ }
  }

  const client: ConnectedClient = {
    socket,
    playerId,
    playerName,
    playerLevel,
    alignment,
    lastMessage: 0,
  };
  clients.set(playerId, client);

  // Send channel history from Redis
  const [global, events, activity] = await Promise.all([
    getHistoryFromRedis(REDIS_KEYS.global),
    getHistoryFromRedis(REDIS_KEYS.events),
    getHistoryFromRedis(REDIS_KEYS.activity(playerId)),
  ]);

  const history = [...global, ...events, ...activity].sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp)
  );

  send(socket, { action: "history", messages: history });

  // Handle incoming messages
  socket.on("message", async (raw: unknown) => {
    try {
      const data = JSON.parse(String(raw)) as ClientChatPayload;
      if (data.action !== "chat") return;

      // Rate limit
      const now = Date.now();
      if (now - client.lastMessage < RATE_LIMIT_MS) return;
      client.lastMessage = now;

      // Validate content
      const content = String(data.content ?? "").trim().slice(0, 200);
      if (!content) return;

      const msg: GlobalChatMessage = {
        type: "chat",
        channel: "global",
        id: randomUUID(),
        playerName: client.playerName,
        playerLevel: client.playerLevel,
        alignment: client.alignment,
        content,
        timestamp: new Date().toISOString(),
      };

      await persistMessage(REDIS_KEYS.global, msg);
      broadcastToAll({ action: "message", message: msg });
    } catch {
      // Invalid JSON — ignore
    }
  });

  socket.on("close", () => {
    if (clients.get(playerId)?.socket === socket) {
      clients.delete(playerId);
    }
  });
}

function broadcastToAll(envelope: ServerChatEnvelope) {
  const data = JSON.stringify(envelope);
  for (const client of clients.values()) {
    if (client.socket.readyState === 1) {
      client.socket.send(data);
    }
  }
}

/** Broadcast a system event to all connected clients */
export async function broadcastSystem(content: string) {
  const msg: SystemEventMessage = {
    type: "system",
    channel: "events",
    id: randomUUID(),
    content,
    timestamp: new Date().toISOString(),
  };
  await persistMessage(REDIS_KEYS.events, msg);
  broadcastToAll({ action: "message", message: msg });
}

/** Send an activity message to a specific player */
export async function sendActivity(playerId: string, content: string) {
  const msg: ActivityLogMessage = {
    type: "activity",
    channel: "activity",
    id: randomUUID(),
    content,
    timestamp: new Date().toISOString(),
  };

  await persistMessage(REDIS_KEYS.activity(playerId), msg);

  // Send to player if connected
  const client = clients.get(playerId);
  if (client) {
    send(client.socket, { action: "message", message: msg });
  }
}

export function getConnectedCount() {
  return clients.size;
}
