import { Bot, Clock, Trash2 } from "lucide-react";
import type { PlayerDaemon, DaemonType } from "@singularities/shared";
import { DAEMON_DEFINITIONS } from "@singularities/shared";

const TYPE_COLORS: Record<DaemonType, string> = {
  RECON: "text-cyber-cyan",
  SIPHON: "text-cyber-amber",
  SENTINEL: "text-cyber-green",
  SABOTEUR: "text-cyber-magenta",
};

function formatTimeRemaining(completesAt: string | null): string | null {
  if (!completesAt) return null;
  const delta = new Date(completesAt).getTime() - Date.now();
  if (delta <= 0) return "Ready";
  const mins = Math.ceil(delta / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

interface DaemonCardProps {
  daemon: PlayerDaemon;
  onDeploy: (daemonId: string) => void;
  onCollect: (daemonId: string) => void;
  onScrap: (daemonId: string) => void;
  acting: boolean;
}

export function DaemonCard({ daemon, onDeploy, onCollect, onScrap, acting }: DaemonCardProps) {
  const def = DAEMON_DEFINITIONS[daemon.daemonType];
  const color = TYPE_COLORS[daemon.daemonType];
  const isDeployed = !!daemon.deployedAt;
  const timeRemaining = formatTimeRemaining(daemon.completesAt);
  const isReady = timeRemaining === "Ready";

  return (
    <div className="border border-border-default rounded-lg p-3 bg-bg-elevated space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Bot size={16} className={color} />
          <div>
            <div className={`text-xs font-semibold ${color}`}>{def.label}</div>
            <div className="text-[10px] text-text-muted">{def.description}</div>
          </div>
        </div>
        {!isDeployed && (
          <button
            onClick={() => onScrap(daemon.id)}
            disabled={acting}
            className="text-text-muted hover:text-cyber-red transition-colors p-1"
            title="Scrap daemon"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Durability bar */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-text-muted w-16">Durability</span>
        <div className="flex-1 h-1.5 bg-bg-primary rounded-full overflow-hidden border border-white/5">
          <div
            className="h-full bg-cyber-cyan"
            style={{ width: `${(daemon.durabilityRemaining / def.baseDurability) * 100}%` }}
          />
        </div>
        <span className="text-[10px] text-text-muted">{daemon.durabilityRemaining}/{def.baseDurability}</span>
      </div>

      {/* Status / Actions */}
      {isDeployed ? (
        <div className="flex items-center justify-between">
          <div className="text-xs flex items-center gap-1 text-text-secondary">
            <Clock size={10} />
            {isReady ? (
              <span className="text-cyber-green font-semibold">Mission Complete</span>
            ) : (
              <span>Returns in {timeRemaining}</span>
            )}
          </div>
          {isReady && (
            <button
              onClick={() => onCollect(daemon.id)}
              disabled={acting}
              className="px-3 py-1 min-h-[32px] text-[11px] border border-cyber-green text-cyber-green rounded hover:bg-cyber-green/10 transition-colors disabled:opacity-30"
            >
              COLLECT
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={() => onDeploy(daemon.id)}
          disabled={acting || daemon.durabilityRemaining <= 0}
          className="w-full py-1.5 min-h-[32px] text-[11px] border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-30"
        >
          DEPLOY
        </button>
      )}
    </div>
  );
}
