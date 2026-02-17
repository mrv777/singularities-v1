import { create } from "zustand";
import type { ServerChatMessage, ChatChannel } from "@singularities/shared";

const MAX_MESSAGES = 200;

interface ChatState {
  messages: ServerChatMessage[];
  activeTab: ChatChannel;
  isOpen: boolean;
  connected: boolean;
  unreadGlobal: number;
  unreadEvents: number;
  unreadActivity: number;
  addMessage: (msg: ServerChatMessage) => void;
  setHistory: (msgs: ServerChatMessage[]) => void;
  setActiveTab: (tab: ChatChannel) => void;
  setOpen: (open: boolean) => void;
  setConnected: (connected: boolean) => void;
  clearUnread: (channel: ChatChannel) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  activeTab: "global",
  isOpen: false,
  connected: false,
  unreadGlobal: 0,
  unreadEvents: 0,
  unreadActivity: 0,

  addMessage: (msg) =>
    set((s) => {
      const messages = [...s.messages, msg].slice(-MAX_MESSAGES);
      const isViewing = s.isOpen && s.activeTab === msg.channel;
      return {
        messages,
        unreadGlobal: s.unreadGlobal + (msg.channel === "global" && !isViewing ? 1 : 0),
        unreadEvents: s.unreadEvents + (msg.channel === "events" && !isViewing ? 1 : 0),
        unreadActivity: s.unreadActivity + (msg.channel === "activity" && !isViewing ? 1 : 0),
      };
    }),

  setHistory: (msgs) => set({ messages: msgs.slice(-MAX_MESSAGES), unreadGlobal: 0, unreadEvents: 0, unreadActivity: 0 }),

  setActiveTab: (tab) =>
    set((s) => ({
      activeTab: tab,
      unreadGlobal: tab === "global" ? 0 : s.unreadGlobal,
      unreadEvents: tab === "events" ? 0 : s.unreadEvents,
      unreadActivity: tab === "activity" ? 0 : s.unreadActivity,
    })),

  setOpen: (open) =>
    set((s) => {
      if (open) {
        // Clear unread for active tab when opening
        return {
          isOpen: open,
          unreadGlobal: s.activeTab === "global" ? 0 : s.unreadGlobal,
          unreadEvents: s.activeTab === "events" ? 0 : s.unreadEvents,
          unreadActivity: s.activeTab === "activity" ? 0 : s.unreadActivity,
        };
      }
      return { isOpen: open };
    }),

  setConnected: (connected) => set({ connected }),
  clearUnread: (channel) =>
    set({
      ...(channel === "global" && { unreadGlobal: 0 }),
      ...(channel === "events" && { unreadEvents: 0 }),
      ...(channel === "activity" && { unreadActivity: 0 }),
    }),
}));
