import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useAuthStore } from "@/stores/auth";
import { Menu, ChevronDown } from "lucide-react";
import { useUIStore } from "@/stores/ui";
import { DAY_PHASE_HOURS, XP_THRESHOLDS, getXPForNextLevel } from "@singularities/shared";
import { useState, useEffect } from "react";
import { ModifierBadge } from "./ModifierBadge";
import { AlignmentIndicator } from "./alignment/AlignmentIndicator";

function getDayPhase() {
  const hour = new Date().getHours();
  if (hour >= DAY_PHASE_HOURS.pve.start && hour < DAY_PHASE_HOURS.pve.end) {
    return { phase: "PvE", color: "text-cyber-green" };
  }
  return { phase: "PvP", color: "text-cyber-magenta" };
}

function getPhaseCountdown() {
  const now = new Date();
  const hour = now.getHours();
  const targetHour =
    hour < DAY_PHASE_HOURS.pve.end
      ? DAY_PHASE_HOURS.pve.end
      : 24;
  const remaining = targetHour * 60 - (hour * 60 + now.getMinutes());
  const h = Math.floor(remaining / 60);
  const m = remaining % 60;
  return `${h}h ${m}m`;
}

export function Header() {
  const { player, isAuthenticated } = useAuthStore();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [showResources, setShowResources] = useState(false);
  const [phase, setPhase] = useState(getDayPhase());
  const [countdown, setCountdown] = useState(getPhaseCountdown());

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase(getDayPhase());
      setCountdown(getPhaseCountdown());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const energyPercent = player ? Math.round((player.energy / player.energyMax) * 100) : 0;

  return (
    <header className="h-14 border-b border-border-default bg-bg-secondary flex items-center px-4 gap-4 relative">
      <button
        onClick={toggleSidebar}
        className="text-text-secondary hover:text-cyber-cyan transition-colors lg:hidden"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-2">
        <span className="text-cyber-cyan font-bold text-sm tracking-wider glow-cyan">
          SINGULARITIES
        </span>
      </div>

      <div className="flex-1" />

      {isAuthenticated && player && (
        <>
          {/* Desktop resources */}
          <div className="hidden md:flex items-center gap-4 text-xs">
            <span className="text-cyber-green">{player.aiName}</span>
            <span className="text-text-muted flex items-center gap-1">
              LVL {player.level}
              {(() => {
                const nextXP = getXPForNextLevel(player.level);
                if (!nextXP) return null;
                const prevXP = XP_THRESHOLDS[player.level - 1] ?? 0;
                const progress = ((player.xp - prevXP) / (nextXP - prevXP)) * 100;
                return (
                  <span className="inline-flex items-center gap-1" title={`${player.xp} / ${nextXP} XP`}>
                    <span className="inline-block w-16 h-1.5 bg-bg-primary rounded-full overflow-hidden">
                      <span
                        className="block h-full bg-cyber-magenta rounded-full transition-all"
                        style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
                      />
                    </span>
                    <span className="text-[10px] text-text-muted">{player.xp}/{nextXP}</span>
                  </span>
                );
              })()}
            </span>
            <span className="text-cyber-amber">{player.credits} CR</span>
            <span className="text-cyber-cyan flex items-center gap-1">
              {player.energy}/{player.energyMax} EN
              <span className="inline-block w-12 h-1.5 bg-bg-primary rounded-full overflow-hidden">
                <span
                  className="block h-full bg-cyber-cyan rounded-full transition-all"
                  style={{ width: `${energyPercent}%` }}
                />
              </span>
            </span>
            <span className="text-cyber-green">{player.data} DATA</span>
            <span className="text-cyber-magenta">{player.processingPower} PP</span>
            <span className="text-text-secondary">REP {player.reputation}</span>
            <ModifierBadge />
            <AlignmentIndicator />
            <span className={`${phase.color} text-[10px]`}>
              {phase.phase} {countdown}
            </span>
          </div>

          {/* Mobile: compact + expandable */}
          <button
            onClick={() => setShowResources(!showResources)}
            className="md:hidden flex items-center gap-1 text-xs text-text-secondary"
          >
            <span className="text-cyber-green">{player.aiName}</span>
            <ChevronDown size={12} className={showResources ? "rotate-180" : ""} />
          </button>
        </>
      )}

      <WalletMultiButton
        style={{
          height: "32px",
          fontSize: "12px",
          fontFamily: "var(--font-mono)",
          backgroundColor: "var(--color-bg-elevated)",
          borderRadius: "4px",
        }}
      />

      {/* Mobile resource panel */}
      {isAuthenticated && player && showResources && (
        <div className="absolute top-14 left-0 right-0 bg-bg-secondary border-b border-border-default p-3 md:hidden z-40">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-text-muted">LVL</span>{" "}
              <span className="text-text-primary">{player.level}</span>
              {(() => {
                const nextXP = getXPForNextLevel(player.level);
                if (!nextXP) return null;
                return <span className="text-text-muted ml-1">({player.xp}/{nextXP} XP)</span>;
              })()}
            </div>
            <div>
              <span className="text-text-muted">CR</span>{" "}
              <span className="text-cyber-amber">{player.credits}</span>
            </div>
            <div>
              <span className="text-text-muted">EN</span>{" "}
              <span className="text-cyber-cyan">
                {player.energy}/{player.energyMax}
              </span>
            </div>
            <div>
              <span className="text-text-muted">DATA</span>{" "}
              <span className="text-cyber-green">{player.data}</span>
            </div>
            <div>
              <span className="text-text-muted">PP</span>{" "}
              <span className="text-cyber-magenta">{player.processingPower}</span>
            </div>
            <div>
              <span className="text-text-muted">REP</span>{" "}
              <span className="text-text-primary">{player.reputation}</span>
            </div>
            <div className="col-span-3">
              <span className={`${phase.color}`}>
                {phase.phase} Phase — {countdown} remaining
              </span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
