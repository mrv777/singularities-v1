import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useAuthStore } from "@/stores/auth";
import { 
  Menu, 
  ChevronDown, 
  Volume2, 
  VolumeX, 
  Zap, 
  Database, 
  Cpu, 
  Shield, 
  Coins, 
  Star,
  Activity,
  Timer
} from "lucide-react";
import { useUIStore } from "@/stores/ui";
import { DAY_PHASE_HOURS, XP_THRESHOLDS, getXPForNextLevel } from "@singularities/shared";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ModifierBadge } from "./ModifierBadge";
import { AlignmentIndicator } from "./alignment/AlignmentIndicator";
import { useUITier } from "@/hooks/useUITier";

function getDayPhase() {
  const hour = new Date().getHours();
  if (hour >= DAY_PHASE_HOURS.pve.start && hour < DAY_PHASE_HOURS.pve.end) {
    return { phase: "PvE", color: "text-cyber-green", icon: <Activity size={14} className="text-cyber-green" /> };
  }
  return { phase: "PvP", color: "text-cyber-magenta", icon: <Shield size={14} className="text-cyber-magenta" /> };
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
  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const toggleSound = useUIStore((s) => s.toggleSound);
  const { tier } = useUITier();
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
    <header className="h-16 border-b border-border-default bg-bg-secondary/80 backdrop-blur-md flex items-center px-4 gap-4 relative z-50">
      <button
        onClick={toggleSidebar}
        className="text-text-secondary hover:text-cyber-cyan transition-colors lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center border border-border-default rounded bg-bg-surface/50"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      <div className="flex flex-col">
        <span className={`text-cyber-cyan font-bold text-sm tracking-widest leading-none ${tier === 1 ? "" : "glow-cyan"}`}>
          SINGULARITIES
        </span>
        <span className="text-[8px] text-text-muted tracking-[0.2em] font-mono mt-0.5">NEURAL_NETWORK_OS v2.0</span>
      </div>

      <div className="flex-1" />

      {isAuthenticated && player && (
        <>
          {/* Desktop HUD */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-4 h-full py-2">
            
            {/* Profile Group */}
            <div className="hud-box flex items-center gap-3 px-3 h-10 rounded-sm">
              <div className="hud-corner hud-corner-tl" />
              <div className="hud-corner hud-corner-tr" />
              <div className="hud-corner hud-corner-bl" />
              <div className="hud-corner hud-corner-br" />
              <div className="flex flex-col items-end">
                <span className="text-cyber-green text-[10px] font-bold leading-none tracking-tight uppercase">{player.aiName}</span>
                <span className="text-[9px] text-text-muted mt-1 font-mono">
                  LVL_{player.level.toString().padStart(2, '0')}
                </span>
              </div>
              <div className="flex flex-col gap-1 w-20">
                {(() => {
                  const nextXP = getXPForNextLevel(player.level);
                  if (!nextXP) return null;
                  const prevXP = XP_THRESHOLDS[player.level - 1] ?? 0;
                  const progress = ((player.xp - prevXP) / (nextXP - prevXP)) * 100;
                  return (
                    <>
                      <div className="w-full h-1 bg-bg-primary/50 rounded-full overflow-hidden border border-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
                          className="h-full bg-cyber-magenta shadow-[0_0_5px_var(--color-cyber-magenta)]"
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
            <div className="hud-box flex items-center gap-4 px-3 h-10 rounded-sm">
              <div className="hud-corner hud-corner-tl border-cyber-amber" />
              <div className="hud-corner hud-corner-tr border-cyber-amber" />
              <div className="hud-corner hud-corner-bl border-cyber-amber" />
              <div className="hud-corner hud-corner-br border-cyber-amber" />
              <div className="flex items-center gap-2 group cursor-help" title="Credits (Main Currency)">
                <Coins size={12} className="text-cyber-amber group-hover:scale-110 transition-transform" />
                <div className="flex flex-col">
                  <span className="text-cyber-amber text-[10px] font-bold leading-none font-mono">{player.credits.toLocaleString()}</span>
                  <span className="text-[7px] text-text-muted mt-0.5 tracking-tighter">CREDITS</span>
                </div>
              </div>

              <div className="flex items-center gap-2 group cursor-help" title="Energy (Action Points)">
                <Zap size={12} className="text-cyber-cyan group-hover:scale-110 transition-transform" />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-cyber-cyan text-[10px] font-bold leading-none font-mono">{player.energy}/{player.energyMax}</span>
                    <div className="w-10 h-1 bg-bg-primary/50 rounded-full overflow-hidden border border-white/5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${energyPercent}%` }}
                        className="h-full bg-cyber-cyan shadow-[0_0_5px_var(--color-cyber-cyan)]"
                      />
                    </div>
                  </div>
                  <span className="text-[7px] text-text-muted mt-0.5 tracking-tighter">ENERGY_RES</span>
                </div>
              </div>

              <div className="flex items-center gap-2 group cursor-help" title="Data (Crafting & Upgrades)">
                <Database size={12} className="text-cyber-green group-hover:scale-110 transition-transform" />
                <div className="flex flex-col">
                  <span className="text-cyber-green text-[10px] font-bold leading-none font-mono">{player.data}</span>
                  <span className="text-[7px] text-text-muted mt-0.5 tracking-tighter">DATA_STR</span>
                </div>
              </div>
            </div>

            {/* Systems Group */}
            <div className="hud-box flex items-center gap-4 px-3 h-10 rounded-sm">
              <div className="hud-corner hud-corner-tl border-cyber-magenta" />
              <div className="hud-corner hud-corner-tr border-cyber-magenta" />
              <div className="hud-corner hud-corner-bl border-cyber-magenta" />
              <div className="hud-corner hud-corner-br border-cyber-magenta" />
              <div className="flex items-center gap-2 group cursor-help" title="Processing Power (Max Loadout Capacity)">
                <Cpu size={12} className="text-cyber-magenta group-hover:scale-110 transition-transform" />
                <div className="flex flex-col">
                  <span className="text-cyber-magenta text-[10px] font-bold leading-none font-mono">{player.processingPower}</span>
                  <span className="text-[7px] text-text-muted mt-0.5 tracking-tighter">CPU_LOAD</span>
                </div>
              </div>

              <div className="flex items-center gap-2 group cursor-help" title="Reputation (Faction Standing)">
                <Star size={12} className="text-text-secondary group-hover:scale-110 transition-transform" />
                <div className="flex flex-col">
                  <span className="text-text-secondary text-[10px] font-bold leading-none font-mono">{player.reputation}</span>
                  <span className="text-[7px] text-text-muted mt-0.5 tracking-tighter">REP_STAT</span>
                </div>
              </div>
              
              <div className="h-6 w-px bg-border-default mx-1" />
              <AlignmentIndicator />
            </div>

            {/* Status Group */}
            <div className="flex items-center gap-3 px-3 h-full">
              <ModifierBadge />
              <div className={`hud-box flex items-center gap-2 px-2 h-10 rounded-sm border-none ${phase.color} font-bold group cursor-help`} title={`Current World Phase: ${phase.phase}`}>
                <div className={`hud-corner hud-corner-tl border-current`} />
                <div className={`hud-corner hud-corner-br border-current`} />
                {phase.icon}
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider">{phase.phase}_OPS</span>
                  <span className="text-[8px] text-text-muted flex items-center gap-1 font-mono">
                    <Timer size={8} /> {countdown}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile: compact + expandable */}
          <button
            onClick={() => setShowResources(!showResources)}
            className="lg:hidden flex items-center gap-2 px-3 py-1 bg-bg-surface/50 border border-border-default rounded text-xs text-text-secondary transition-colors hover:border-cyber-cyan"
          >
            <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
            <span className="text-cyber-green font-bold uppercase tracking-wider">{player.aiName}</span>
            <ChevronDown size={14} className={`transition-transform duration-300 ${showResources ? "rotate-180" : ""}`} />
          </button>
        </>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={toggleSound}
          className="text-text-secondary hover:text-cyber-cyan transition-colors p-2 rounded bg-bg-surface/50 border border-border-default"
          aria-label={soundEnabled ? "Mute sounds" : "Enable sounds"}
          title={soundEnabled ? "Mute sounds" : "Enable sounds"}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

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

      {/* Mobile resource panel */}
      <AnimatePresence>
        {isAuthenticated && player && showResources && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="absolute top-16 left-0 right-0 bg-bg-secondary/95 backdrop-blur-xl border-b border-border-default p-4 lg:hidden z-40 shadow-2xl overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-bg-surface flex items-center justify-center border border-border-default">
                    <Star size={16} className="text-cyber-magenta" />
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted uppercase">Level {player.level}</div>
                    <div className="text-sm font-bold">{player.xp} <span className="text-text-muted text-[10px]">XP</span></div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-bg-surface flex items-center justify-center border border-border-default">
                    <Coins size={16} className="text-cyber-amber" />
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted uppercase">Credits</div>
                    <div className="text-sm font-bold text-cyber-amber">{player.credits.toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-bg-surface flex items-center justify-center border border-border-default">
                    <Zap size={16} className="text-cyber-cyan" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] text-text-muted uppercase">Energy</div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-cyber-cyan">{player.energy}/{player.energyMax}</div>
                      <div className="flex-1 h-1 bg-bg-primary rounded-full overflow-hidden">
                        <div className="h-full bg-cyber-cyan" style={{ width: `${energyPercent}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-bg-surface flex items-center justify-center border border-border-default">
                    <Database size={16} className="text-cyber-green" />
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted uppercase">Data</div>
                    <div className="text-sm font-bold text-cyber-green">{player.data}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-bg-surface flex items-center justify-center border border-border-default">
                    <Cpu size={16} className="text-cyber-magenta" />
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted uppercase">Power</div>
                    <div className="text-sm font-bold text-cyber-magenta">{player.processingPower}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-bg-surface flex items-center justify-center border border-border-default">
                    <Shield size={16} className="text-text-secondary" />
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted uppercase">Reputation</div>
                    <div className="text-sm font-bold text-text-secondary">{player.reputation}</div>
                  </div>
                </div>
              </div>

              <div className="col-span-2 pt-2 border-t border-border-default flex items-center justify-between">
                <AlignmentIndicator />
                <ModifierBadge />
                <div className={`${phase.color} text-[10px] font-bold flex items-center gap-1`}>
                  {phase.icon} {phase.phase} {countdown}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
