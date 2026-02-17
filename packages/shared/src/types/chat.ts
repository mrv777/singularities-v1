export type ChatChannel = "global" | "events" | "activity";

export interface GlobalChatMessage {
  type: "chat";
  channel: "global";
  id: string;
  playerName: string;
  playerLevel: number;
  alignment: number;
  content: string;
  timestamp: string;
}

export interface SystemEventMessage {
  type: "system";
  channel: "events";
  id: string;
  content: string;
  timestamp: string;
}

export interface ActivityLogMessage {
  type: "activity";
  channel: "activity";
  id: string;
  content: string;
  timestamp: string;
}

export type ServerChatMessage =
  | GlobalChatMessage
  | SystemEventMessage
  | ActivityLogMessage;

/** Envelope sent from server to client */
export interface ServerChatEnvelope {
  action: "message" | "history";
  message?: ServerChatMessage;
  messages?: ServerChatMessage[];
}

/** Payload sent from client to server */
export interface ClientChatPayload {
  action: "chat";
  content: string;
}
