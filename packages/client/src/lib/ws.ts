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
  private maxRetries = 5;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  setHandlers(handlers: WSHandlers) {
    this.handlers = handlers;
  }

  connect() {
    this.intentionalClose = false;
    const token = api.getToken();
    if (!token) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.retries = 0;
      this.handlers?.onConnected();
    };

    this.ws.onmessage = (event) => {
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

    this.ws.onclose = () => {
      this.handlers?.onDisconnected();
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
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
    if (this.retries >= this.maxRetries) return;
    const delay = Math.min(1000 * Math.pow(2, this.retries), 30000);
    this.retries++;
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }
}

export const wsManager = new WSManager();
