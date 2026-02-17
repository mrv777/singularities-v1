import type { ServerChatMessage } from "@singularities/shared";

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function alignmentColor(alignment: number): string {
  if (alignment > 0.3) return "text-cyber-green";
  if (alignment < -0.3) return "text-cyber-red";
  return "text-text-secondary";
}

export function ChatMessage({ msg }: { msg: ServerChatMessage }) {
  if (msg.type === "chat") {
    return (
      <div className="text-xs leading-relaxed">
        <span className="text-text-muted">{formatTime(msg.timestamp)}</span>{" "}
        <span className={alignmentColor(msg.alignment)}>
          [{msg.playerLevel}] {msg.playerName}
        </span>
        : <span className="text-text-primary">{msg.content}</span>
      </div>
    );
  }

  if (msg.type === "system") {
    return (
      <div className="text-xs leading-relaxed">
        <span className="text-text-muted">{formatTime(msg.timestamp)}</span>{" "}
        <span className="text-cyber-amber">[SYS]</span>{" "}
        <span className="text-cyber-amber/80">{msg.content}</span>
      </div>
    );
  }

  // activity
  return (
    <div className="text-[11px] leading-snug">
      <span className="text-text-muted">{formatTime(msg.timestamp)}</span>{" "}
      <span className="text-cyber-cyan">[LOG]</span>{" "}
      <span className="text-text-secondary">{msg.content}</span>
    </div>
  );
}
