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

interface ConnectedClient {
  socket: WebSocket;
  playerId: string;
  playerName: string;
  playerLevel: number;
  alignment: number;
  lastMessage: number; // timestamp for rate limiting
}

const clients = new Map<string, ConnectedClient>();

// Rolling message buffers per channel
const MAX_HISTORY = 50;
const globalHistory: ServerChatMessage[] = [];
const eventsHistory: ServerChatMessage[] = [];
const activityHistory: Map<string, ServerChatMessage[]> = new Map();

const RATE_LIMIT_MS = 5000; // 1 msg per 5s

function pushHistory(arr: ServerChatMessage[], msg: ServerChatMessage) {
  arr.push(msg);
  if (arr.length > MAX_HISTORY) arr.shift();
}

function send(socket: WebSocket, envelope: ServerChatEnvelope) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(envelope));
  }
}

export function handleConnection(
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

  // Send channel history
  const playerActivity = activityHistory.get(playerId) ?? [];
  const history = [
    ...globalHistory.slice(-30),
    ...eventsHistory.slice(-20),
    ...playerActivity.slice(-50),
  ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  send(socket, { action: "history", messages: history });

  // Handle incoming messages
  socket.on("message", (raw: unknown) => {
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

      pushHistory(globalHistory, msg);
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
export function broadcastSystem(content: string) {
  const msg: SystemEventMessage = {
    type: "system",
    channel: "events",
    id: randomUUID(),
    content,
    timestamp: new Date().toISOString(),
  };
  pushHistory(eventsHistory, msg);
  broadcastToAll({ action: "message", message: msg });
}

/** Send an activity message to a specific player */
export function sendActivity(playerId: string, content: string) {
  const msg: ActivityLogMessage = {
    type: "activity",
    channel: "activity",
    id: randomUUID(),
    content,
    timestamp: new Date().toISOString(),
  };

  // Store in per-player history
  let history = activityHistory.get(playerId);
  if (!history) {
    history = [];
    activityHistory.set(playerId, history);
  }
  pushHistory(history, msg);

  // Send to player if connected
  const client = clients.get(playerId);
  if (client) {
    send(client.socket, { action: "message", message: msg });
  }
}

export function getConnectedCount() {
  return clients.size;
}
