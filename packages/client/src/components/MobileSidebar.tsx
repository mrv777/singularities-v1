import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { useUITier } from "@/hooks/useUITier";
import { XP_THRESHOLDS, getXPForNextLevel } from "@singularities/shared";
import { ModifierBadge } from "./ModifierBadge";
import { TopologyBadge } from "./TopologyBadge";
import { AlignmentIndicator } from "./alignment/AlignmentIndicator";
import {
  X,
  Zap,
  Database,
  Cpu,
  Shield,
  Coins,
  Star,
  Activity,
  Timer,
} from "lucide-react";
import {
  getCurrentWorldPhase,
  getPhaseCountdown as getPhaseCountdownLabel,
} from "@/lib/phaseTime";

export function MobileSidebar() {
  const { player, isAuthenticated } = useAuthStore();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const { tier } = useUITier();

  // Close sidebar on resize to desktop
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = () => { if (mq.matches) setSidebarOpen(false); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [setSidebarOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [sidebarOpen]);

  if (!sidebarOpen || !isAuthenticated || !player) return null;

  const energyPercent = Math.round((player.energy / player.energyMax) * 100);
  const phase = getCurrentWorldPhase();
  const phaseColor = phase === "PvE" ? "text-cyber-green" : "text-cyber-magenta";
  const countdown = getPhaseCountdownLabel();

  const nextXP = getXPForNextLevel(player.level);
  const prevXP = XP_THRESHOLDS[player.level - 1] ?? 0;
  const xpProgress = nextXP ? ((player.xp - prevXP) / (nextXP - prevXP)) * 100 : 100;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar panel */}
      <div className="fixed top-0 left-0 bottom-0 w-72 bg-bg-secondary border-r border-border-default z-[61] lg:hidden overflow-y-auto flex flex-col animate-[slide-in-left_0.2s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-default">
          <div className="flex flex-col">
            <span className={`text-cyber-cyan font-bold text-sm tracking-widest leading-none ${tier === 1 ? "" : "glow-cyan"}`}>
              SINGULARITIES
            </span>
            <span className="text-[8px] text-text-muted tracking-[0.2em] font-mono mt-0.5">
              NEURAL_NETWORK_OS v2.0
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-text-secondary hover:text-cyber-cyan transition-colors p-1.5 rounded border border-border-default bg-bg-surface/50"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* AI Profile */}
        <div
          className="p-4 border-b border-border-default cursor-pointer hover:bg-bg-surface/30 transition-colors"
          onClick={() => { useUIStore.getState().openModal("network_stats"); setSidebarOpen(false); }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm overflow-hidden border border-cyber-cyan/30 shrink-0">
              <img
                src={`/assets/portrait/tier${tier}.webp`}
                alt="AI portrait"
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-cyber-green text-xs font-bold uppercase tracking-wider truncate">
                {player.aiName}
              </div>
              <div className="text-[10px] text-text-muted font-mono mt-0.5">
                LVL_{player.level.toString().padStart(2, "0")}
              </div>
            </div>
          </div>
          {/* XP bar */}
          {nextXP && (
            <div className="mt-2.5">
              <div className="w-full h-2 bg-bg-primary/50 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-cyber-magenta shadow-[0_0_6px_var(--color-cyber-magenta)] transition-[width] duration-500"
                  style={{ width: `${Math.max(0, Math.min(xpProgress, 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-text-muted mt-1 font-mono">
                <span>{player.xp} / {nextXP} XP</span>
                <span>{Math.round(xpProgress)}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Resources */}
        <div className="p-4 border-b border-border-default space-y-3">
          <div className="text-[9px] text-text-muted uppercase tracking-wider font-bold mb-2">Resources</div>

          <ResourceRow icon={<Coins size={14} className="text-cyber-amber" />} label="Credits" value={player.credits.toLocaleString()} color="text-cyber-amber" />
          <ResourceRow
            icon={<Zap size={14} className="text-cyber-cyan" />}
            label="Energy"
            value={`${player.energy}/${player.energyMax}`}
            color={energyPercent < 20 ? "text-cyber-amber" : "text-cyber-cyan"}
            bar={{ percent: energyPercent, low: energyPercent < 20 }}
          />
          <ResourceRow icon={<Database size={14} className="text-cyber-green" />} label="Data" value={String(player.data)} color="text-cyber-green" />
        </div>

        {/* Systems */}
        <div className="p-4 border-b border-border-default space-y-3">
          <div className="text-[9px] text-text-muted uppercase tracking-wider font-bold mb-2">Systems</div>

          <ResourceRow icon={<Cpu size={14} className="text-cyber-magenta" />} label="Processing Power" value={String(player.processingPower)} color="text-cyber-magenta" />
          <ResourceRow icon={<Star size={14} className="text-text-secondary" />} label="Reputation" value={String(player.reputation)} color="text-text-secondary" />
        </div>

        {/* Status */}
        <div className="p-4 space-y-3">
          <div className="text-[9px] text-text-muted uppercase tracking-wider font-bold mb-2">Status</div>

          <div className="flex items-center gap-2">
            <AlignmentIndicator />
          </div>
          <div className="flex flex-wrap gap-2">
            <ModifierBadge />
            <TopologyBadge />
          </div>
          <div className={`${phaseColor} text-xs font-bold flex items-center gap-2`}>
            {phase === "PvE"
              ? <Activity size={14} className="text-cyber-green" />
              : <Shield size={14} className="text-cyber-magenta" />}
            <span>{phase}_OPS</span>
            <span className="text-text-secondary flex items-center gap-1 font-mono tabular-nums">
              <Timer size={10} /> {countdown}
            </span>
          </div>
        </div>

        {/* Spacer to push content up */}
        <div className="flex-1" />
      </div>
    </>
  );
}

function ResourceRow({
  icon,
  label,
  value,
  color,
  bar,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bar?: { percent: number; low: boolean };
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded bg-bg-surface flex items-center justify-center border border-border-default shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-text-muted uppercase">{label}</div>
        <div className={`text-sm font-bold font-mono ${color}`}>{value}</div>
        {bar && (
          <div className="w-full h-1 bg-bg-primary rounded-full overflow-hidden mt-0.5">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${bar.low ? "bg-cyber-amber" : "bg-cyber-cyan"}`}
              style={{ width: `${bar.percent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
