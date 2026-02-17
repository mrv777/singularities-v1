import { useGameStore } from "@/stores/game";
import { AlertTriangle } from "lucide-react";

export function WorldEventBanner() {
  const worldEvents = useGameStore((s) => s.worldEvents);

  if (worldEvents.length === 0) return null;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-1">
      {worldEvents.map((event) => (
        <div
          key={event.id}
          className="flex items-center gap-2 px-3 py-2 rounded border border-cyber-amber/30 bg-cyber-amber/5 text-xs"
        >
          <AlertTriangle size={12} className="text-cyber-amber shrink-0" />
          <span className="text-cyber-amber font-semibold">{event.eventType.replace("ripple_", "").replace(/_/g, " ").toUpperCase()}</span>
          <span className="text-text-secondary">{event.narrative}</span>
        </div>
      ))}
    </div>
  );
}
