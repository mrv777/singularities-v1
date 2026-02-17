import type {
  ServerChatEnvelope,
  ServerChatMessage,
  ClientChatPayload,
} from "@singularities/shared";
import { api } from "./api";

export interface WSHandlers {
  onMessage: (msg: ServerChatMessage) => void;
  onHistory: (msgs: ServerChatMessage[]) => void;
  onConnected: () => void;
  onDisconnected: () => void;
}

class WSManager {
  private ws: WebSocket | null = null;
  private handlers: WSHandlers | null = null;
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private readonly maxRetryDelayMs = 30000;
  private readonly connectTimeoutMs = 10000;

  setHandlers(handlers: WSHandlers) {
    this.handlers = handlers;
  }

  connect() {
    this.intentionalClose = false;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    const token = api.getToken();
    if (!token) {
      this.scheduleReconnect();
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    const currentWs = this.ws;
    this.startConnectTimeout(currentWs);

    currentWs.onopen = () => {
      if (this.ws !== currentWs) return;
      this.clearConnectTimeout();
      this.retries = 0;
      this.handlers?.onConnected();
    };

    currentWs.onmessage = (event) => {
      if (this.ws !== currentWs) return;
      try {
        const envelope = JSON.parse(event.data) as ServerChatEnvelope;
        if (envelope.action === "history" && envelope.messages) {
          this.handlers?.onHistory(envelope.messages);
        } else if (envelope.action === "message" && envelope.message) {
          this.handlers?.onMessage(envelope.message);
        }
      } catch {
        // Invalid message
      }
    };

    currentWs.onclose = () => {
      if (this.ws === currentWs) {
        this.ws = null;
      }
      this.clearConnectTimeout();
      this.handlers?.onDisconnected();
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    currentWs.onerror = () => {
      // Force close stalled handshakes so retry logic always progresses.
      if (currentWs.readyState === WebSocket.CONNECTING) {
        try {
          currentWs.close();
        } catch {
          // ignore
        }
      }
    };
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.clearConnectTimeout();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  sendChat(content: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const payload: ClientChatPayload = { action: "chat", content };
    this.ws.send(JSON.stringify(payload));
  }

  private scheduleReconnect() {
    if (this.intentionalClose || this.retryTimer) return;
    const delay = Math.min(1000 * Math.pow(2, this.retries), this.maxRetryDelayMs);
    this.retries++;
    const jitter = Math.floor(Math.random() * 250);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay + jitter);
  }

  private startConnectTimeout(ws: WebSocket) {
    this.clearConnectTimeout();
    this.connectTimeoutTimer = setTimeout(() => {
      if (this.ws !== ws) return;
      if (ws.readyState === WebSocket.CONNECTING) {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
    }, this.connectTimeoutMs);
  }

  private clearConnectTimeout() {
    if (!this.connectTimeoutTimer) return;
    clearTimeout(this.connectTimeoutTimer);
    this.connectTimeoutTimer = null;
  }
}

export const wsManager = new WSManager();
