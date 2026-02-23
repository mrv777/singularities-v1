import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useAuthStore } from "@/stores/auth";
import {
  Menu,
  Volume2,
  VolumeX,
  Zap,
  Database,
  Cpu,
  Shield,
  Coins,
  Star,
  Activity,
  Timer,
  HelpCircle,
  Terminal,
} from "lucide-react";
import { useUIStore } from "@/stores/ui";
import { XP_THRESHOLDS, getXPForNextLevel } from "@singularities/shared";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ModifierBadge } from "./ModifierBadge";
import { TopologyBadge } from "./TopologyBadge";
import { AlignmentIndicator } from "./alignment/AlignmentIndicator";
import { CyberTooltip } from "./ui/CyberTooltip";
import { GlitchText } from "./ui/GlitchText";
import { useUITier } from "@/hooks/useUITier";
import {
  getCurrentWorldPhase,
  getLocalTimeZoneName,
  getPhaseCountdown as getPhaseCountdownLabel,
  getPvpWindowLocalLabel,
} from "@/lib/phaseTime";

function getDayPhase() {
  const phase = getCurrentWorldPhase();
  if (phase === "PvE") {
    return {
      phase: "PvE",
      color: "text-cyber-green",
      icon: <Activity size={14} className="text-cyber-green" />,
    };
  }
  return {
    phase: "PvP",
    color: "text-cyber-magenta",
    icon: <Shield size={14} className="text-cyber-magenta" />,
  };
}

function getPhaseCountdown() {
  return getPhaseCountdownLabel();
}

export function Header() {
  const { player, isAuthenticated } = useAuthStore();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const toggleSound = useUIStore((s) => s.toggleSound);
  const { tier } = useUITier();
  const [phase, setPhase] = useState(getDayPhase());
  const [countdown, setCountdown] = useState(getPhaseCountdown());
  const localNow = new Date();
  const timezoneName = getLocalTimeZoneName();
  const localPvpWindow = getPvpWindowLocalLabel();

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase(getDayPhase());
      setCountdown(getPhaseCountdown());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const energyPercent = player
    ? Math.round((player.energy / player.energyMax) * 100)
    : 0;

  return (
    <header
      className="h-16 border-b border-border-default bg-bg-secondary/80 backdrop-blur-md flex items-center px-4 gap-4 relative z-50"
      style={{ borderTop: `2px solid ${phase.phase === "PvP" ? "var(--color-cyber-magenta)" : "var(--color-cyber-green)"}` }}
    >
      <button
        onClick={toggleSidebar}
        className="text-text-secondary hover:text-cyber-cyan transition-colors lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center border border-border-default rounded bg-bg-surface/50"
        aria-label="Open sidebar"
      >
        <Menu size={20} />
      </button>

      <div className="hidden lg:flex flex-col">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-cyber-cyan" />
          <GlitchText
            text="SINGULARITIES"
            className={`text-cyber-cyan font-bold text-sm tracking-widest leading-none font-display ${tier === 1 ? "" : "glow-cyan"}`}
          />
        </div>
        <span className="text-[8px] text-text-muted tracking-[0.2em] font-mono mt-0.5">
          NEURAL_NETWORK_OS v2.0_STABLE
        </span>
      </div>

      <div className="flex-1" />

      {isAuthenticated && player && (
        <>
          {/* Desktop HUD */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-4 h-full py-2">
            {/* Profile Group — click to open Net Stats */}
            <div
              className="hud-box flex items-center gap-3 px-3 h-10 rounded-sm cursor-pointer hover:border-cyber-cyan/50 transition-colors"
              onClick={() => useUIStore.getState().openModal("network_stats")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") useUIStore.getState().openModal("network_stats"); }}
              title="View Network Stats"
            >
              <div className="hud-corner hud-corner-tl" />
              <div className="hud-corner hud-corner-tr" />
              <div className="hud-corner hud-corner-bl" />
              <div className="hud-corner hud-corner-br" />
              {/* AI Portrait — tier-appropriate avatar */}
              <div className="w-8 h-8 rounded-sm overflow-hidden border border-cyber-cyan/30 shrink-0">
                <img
                  src={`/assets/portrait/tier${tier}.webp`}
                  alt="AI portrait"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-cyber-green text-[10px] font-bold leading-none tracking-tight uppercase">
                  {player.aiName}
                </span>
                <span className="text-[9px] text-text-muted mt-1 font-mono">
                  LVL_{player.level.toString().padStart(2, "0")}
                </span>
              </div>
              <div className="flex flex-col gap-1 w-20">
                {(() => {
                  const nextXP = getXPForNextLevel(player.level);
                  if (!nextXP) return null;
                  const prevXP = XP_THRESHOLDS[player.level - 1] ?? 0;
                  const progress =
                    ((player.xp - prevXP) / (nextXP - prevXP)) * 100;
                  return (
                    <>
                      <div className="w-full h-2.5 bg-bg-primary/50 rounded-full overflow-hidden border border-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.max(0, Math.min(progress, 100))}%`,
                          }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className="h-full bg-cyber-magenta shadow-[0_0_6px_var(--color-cyber-magenta)]"
                        />
                      </div>
                      <div className="flex justify-between text-[7px] text-text-muted leading-none font-mono">
                        <span>XP_PRG</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Resources Group */}
            <div className="hud-box flex items-center gap-3 px-2.5 h-10 rounded-sm">
              <div className="hud-corner hud-corner-tl border-cyber-amber" />
              <div className="hud-corner hud-corner-tr border-cyber-amber" />
              <div className="hud-corner hud-corner-bl border-cyber-amber" />
              <div className="hud-corner hud-corner-br border-cyber-amber" />
              <CyberTooltip content="Credits — Main currency for purchases and upgrades">
                <div className="flex items-center gap-1.5 group">
                  <Coins
                    size={12}
                    className="text-cyber-amber group-hover:scale-110 transition-transform"
                  />
                  <span className="text-cyber-amber text-[10px] font-bold leading-none font-mono">
                    {player.credits.toLocaleString()}
                  </span>
                </div>
              </CyberTooltip>

              <CyberTooltip content="Energy — Consumed by scanning, hacking, and repairs">
                <div className="flex items-center gap-1.5 group">
                  <Zap
                    size={12}
                    className="text-cyber-cyan group-hover:scale-110 transition-transform"
                  />
                  <span className={`text-[10px] font-bold leading-none font-mono ${energyPercent < 20 ? "text-cyber-amber" : "text-cyber-cyan"}`}>
                    {player.energy}/{player.energyMax}
                  </span>
                  <div className="w-10 h-2.5 bg-bg-primary/50 rounded-full overflow-hidden border border-white/5">
                    <div
                      className={`h-full transition-[width] duration-[600ms] ease-out ${
                        energyPercent < 20
                          ? "shadow-[0_0_6px_var(--color-cyber-amber)]"
                          : "bg-cyber-cyan shadow-[0_0_6px_var(--color-cyber-cyan)]"
                      }`}
                      style={{
                        width: `${energyPercent}%`,
                        ...(energyPercent < 20
                          ? { animation: "energy-pulse-low 1.5s ease-in-out infinite" }
                          : { backgroundColor: "var(--color-cyber-cyan)" }),
                      }}
                    />
                  </div>
                </div>
              </CyberTooltip>

              <CyberTooltip content="Data — Used for crafting and module upgrades">
                <div className="flex items-center gap-1.5 group">
                  <Database
                    size={12}
                    className="text-cyber-green group-hover:scale-110 transition-transform"
                  />
                  <span className="text-cyber-green text-[10px] font-bold leading-none font-mono">
                    {player.data}
                  </span>
                </div>
              </CyberTooltip>
            </div>

            {/* Systems Group */}
            <div className="hud-box flex items-center gap-3 px-2.5 h-10 rounded-sm">
              <div className="hud-corner hud-corner-tl border-cyber-magenta" />
              <div className="hud-corner hud-corner-tr border-cyber-magenta" />
              <div className="hud-corner hud-corner-bl border-cyber-magenta" />
              <div className="hud-corner hud-corner-br border-cyber-magenta" />
              <CyberTooltip content="Processing Power — Determines max loadout capacity">
                <div className="flex items-center gap-1.5 group">
                  <Cpu
                    size={12}
                    className="text-cyber-magenta group-hover:scale-110 transition-transform"
                  />
                  <span className="text-cyber-magenta text-[10px] font-bold leading-none font-mono">
                    {player.processingPower}
                  </span>
                </div>
              </CyberTooltip>

              <CyberTooltip content="Reputation — Your standing in the network">
                <div className="flex items-center gap-1.5 group">
                  <Star
                    size={12}
                    className="text-text-secondary group-hover:scale-110 transition-transform"
                  />
                  <span className="text-text-secondary text-[10px] font-bold leading-none font-mono">
                    {player.reputation}
                  </span>
                </div>
              </CyberTooltip>

              <div className="h-6 w-px bg-border-default mx-1" />
              <AlignmentIndicator />
            </div>

            {/* Phase + Status Group */}
            <div className="flex items-center gap-2 px-2 h-full">
              <CyberTooltip
                content={
                  <div className="space-y-1">
                    <div>Current World Phase: {phase.phase}</div>
                    <div>
                      Local Time:{" "}
                      {localNow.toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      {timezoneName}
                    </div>
                    <div>
                      PvP Window: {localPvpWindow} {timezoneName} (12:00 - 24:00
                      UTC)
                    </div>
                  </div>
                }
              >
                <div
                  className={`hud-box flex items-center gap-2 px-2 h-10 rounded-sm border-none ${phase.color} font-bold group`}
                >
                  <div className={`hud-corner hud-corner-tl border-current`} />
                  <div className={`hud-corner hud-corner-br border-current`} />
                  {phase.icon}
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider">
                      {phase.phase}_OPS
                    </span>
                    <span className="text-[9px] text-text-secondary flex items-center gap-1 font-mono font-bold tabular-nums">
                      <Timer size={8} /> {countdown}
                    </span>
                  </div>
                </div>
              </CyberTooltip>
              <div className="flex flex-col gap-0.5">
                <ModifierBadge />
                <TopologyBadge />
              </div>
            </div>
          </div>

          {/* Mobile: AI name (tapping opens Net Stats) */}
          <button
            onClick={() => useUIStore.getState().openModal("network_stats")}
            className="lg:hidden flex items-center gap-2 px-3 py-1 bg-bg-surface/50 border border-border-default rounded text-xs text-text-secondary transition-colors hover:border-cyber-cyan"
          >
            <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
            <span className="text-cyber-green font-bold uppercase tracking-wider">
              {player.aiName}
            </span>
          </button>
        </>
      )}

      <div className="flex items-center gap-2">
        {isAuthenticated && player && (
          <CyberTooltip content="Operations Manual">
            <button
              onClick={() => useUIStore.getState().openModal("help")}
              className="text-text-secondary hover:text-cyber-cyan transition-colors p-2 rounded bg-bg-surface/50 border border-border-default"
              aria-label="Help"
            >
              <HelpCircle size={16} />
            </button>
          </CyberTooltip>
        )}
        <CyberTooltip content={soundEnabled ? "Mute sounds" : "Enable sounds"}>
          <button
            onClick={toggleSound}
            className="text-text-secondary hover:text-cyber-cyan transition-colors p-2 rounded bg-bg-surface/50 border border-border-default"
            aria-label={soundEnabled ? "Mute sounds" : "Enable sounds"}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </CyberTooltip>

        <WalletMultiButton
          style={{
            height: "36px",
            fontSize: "11px",
            fontWeight: "bold",
            letterSpacing: "0.1em",
            fontFamily: "var(--font-mono)",
            backgroundColor: "rgba(34, 34, 46, 0.5)",
            borderRadius: "4px",
            border: "1px solid var(--color-border-default)",
            paddingLeft: "16px",
            paddingRight: "16px",
          }}
        />
      </div>

    </header>
  );
}
