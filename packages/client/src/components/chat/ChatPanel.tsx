import { useState, useRef, useEffect } from "react";
import { MessageSquare, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/stores/chat";
import { wsManager } from "@/lib/ws";
import { ChatMessage } from "./ChatMessage";
import type { ChatChannel } from "@singularities/shared";
import { playSound } from "@/lib/sound";
import { CyberButton } from "@/components/ui/CyberButton";

const TABS: { id: ChatChannel; label: string }[] = [
  { id: "global", label: "Global" },
  { id: "events", label: "Events" },
  { id: "activity", label: "Activity" },
];

const MAX_INPUT = 200;

export function ChatPanel() {
  const {
    messages,
    activeTab,
    isOpen,
    connected,
    unreadGlobal,
    unreadEvents,
    unreadActivity,
    setActiveTab,
    setOpen,
  } = useChatStore();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const totalUnread = unreadGlobal + unreadEvents + unreadActivity;
  const unreadMap: Record<ChatChannel, number> = {
    global: unreadGlobal,
    events: unreadEvents,
    activity: unreadActivity,
  };

  const filtered = messages.filter((m) => m.channel === activeTab);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered.length, isOpen]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    wsManager.sendChat(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => {
          playSound("click");
          setOpen(!isOpen);
        }}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-bg-elevated border border-border-default flex items-center justify-center hover:border-cyber-cyan transition-colors"
      >
        <MessageSquare size={18} className="text-cyber-cyan" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-cyber-red text-white text-[10px] flex items-center justify-center px-1">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-4 z-50 w-[480px] max-h-[400px] sm:w-[480px] sm:max-h-[400px] max-sm:top-16 max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:w-full max-sm:max-h-full border border-border-default bg-bg-surface rounded-lg overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-default bg-bg-secondary">
              <div className="flex items-center gap-2">
                <span className="text-cyber-cyan text-xs font-semibold tracking-wider">CHAT</span>
                <span className={`w-2 h-2 rounded-full ${connected ? "bg-cyber-green" : "bg-cyber-red"}`} />
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-text-muted hover:text-cyber-cyan transition-colors p-1 sm:hidden"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border-default">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-1.5 text-[10px] uppercase tracking-wider transition-colors relative ${
                    activeTab === tab.id
                      ? "text-cyber-cyan border-b border-cyber-cyan"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {tab.label}
                  {unreadMap[tab.id] > 0 && (
                    <span className="ml-1 text-cyber-red">({unreadMap[tab.id]})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-2 space-y-0.5 min-h-0"
              style={{ maxHeight: "calc(100% - 120px)" }}
            >
              {filtered.length === 0 ? (
                <div className="text-text-muted text-[10px] text-center py-4">
                  No messages yet.
                </div>
              ) : (
                filtered.map((msg) => <ChatMessage key={msg.id} msg={msg} />)
              )}
            </div>

            {/* Input (only for global tab) */}
            {activeTab === "global" && (
              <div className="border-t border-border-default p-2">
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT))}
                    onKeyDown={handleKeyDown}
                    placeholder={connected ? "Send a message..." : "Disconnected. Reconnecting..."}
                    disabled={!connected}
                    className="flex-1 bg-bg-primary border border-border-default rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-cyber-cyan focus:outline-none disabled:opacity-50"
                  />
                  <CyberButton
                    onClick={handleSend}
                    disabled={!connected || !input.trim()}
                    size="sm"
                  >
                    Send
                  </CyberButton>
                </div>
                <div className="text-[9px] text-text-muted text-right mt-0.5">
                  {input.length}/{MAX_INPUT}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
