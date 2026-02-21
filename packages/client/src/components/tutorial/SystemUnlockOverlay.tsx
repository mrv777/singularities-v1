import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/auth";
import { useTutorialStore } from "@/stores/tutorial";
import { getUnlockedSystems, LEVEL_UNLOCKS } from "@singularities/shared";
import { playSound } from "@/lib/sound";
import {
  Radar,
  GitBranch,
  Code2,
  Swords,
  ShieldAlert,
  Database as DatabaseIcon,
  Flame,
  Bot,
  Settings,
} from "lucide-react";

const NODE_ICONS: Record<string, React.ReactNode> = {
  scanner: <Radar size={28} />,
  tech_tree: <GitBranch size={28} />,
  security_center: <ShieldAlert size={28} />,
  ice_breaker: <Flame size={28} />,
  data_vault: <DatabaseIcon size={28} />,
  script_manager: <Code2 size={28} />,
  daemon_forge: <Bot size={28} />,
  pvp_arena: <Swords size={28} />,
  system_maintenance: <Settings size={28} />,
};

const NODE_LABELS: Record<string, string> = {
  scanner: "Scanner",
  tech_tree: "Tech Tree",
  security_center: "Security Center",
  ice_breaker: "ICE Breaker",
  data_vault: "Data Vault",
  script_manager: "Script Manager",
  daemon_forge: "Daemon Forge",
  pvp_arena: "PvP Arena",
};

export function SystemUnlockOverlay() {
  const player = useAuthStore((s) => s.player);
  const celebratedUnlocks = useTutorialStore((s) => s.celebratedUnlocks);
  const addCelebratedUnlock = useTutorialStore((s) => s.addCelebratedUnlock);
  const prevLevelRef = useRef(player?.level ?? 1);
  const [queue, setQueue] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);

  // Detect level changes and queue new unlocks
  useEffect(() => {
    if (!player) return;
    const prevLevel = prevLevelRef.current;
    const newLevel = player.level;
    prevLevelRef.current = newLevel;

    if (newLevel <= prevLevel) return;

    const newSystems = getUnlockedSystems(newLevel, player.isInSandbox);
    const prevSystems = getUnlockedSystems(prevLevel, player.isInSandbox);
    const justUnlocked = newSystems.filter(
      (s) => !prevSystems.includes(s) && !celebratedUnlocks.has(s)
    );

    if (justUnlocked.length > 0) {
      setQueue((prev) => [...prev, ...justUnlocked]);
    }
  }, [player?.level, player?.isInSandbox, celebratedUnlocks]);

  // Show queued unlocks one at a time
  useEffect(() => {
    if (active || queue.length === 0) return;
    const next = queue[0];
    setActive(next);
    setQueue((prev) => prev.slice(1));
    addCelebratedUnlock(next);
    playSound("moduleUnlock");

    const timer = setTimeout(() => setActive(null), 4000);
    return () => clearTimeout(timer);
  }, [active, queue, addCelebratedUnlock]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed inset-0 z-[50] flex items-center justify-center pointer-events-none"
        >
          <div
            className="pointer-events-auto cursor-pointer"
            onClick={() => setActive(null)}
          >
            <div
              className="relative border border-cyber-cyan/60 bg-bg-surface/95 backdrop-blur-sm rounded-lg px-8 py-6 text-center"
              style={{
                boxShadow: "0 0 30px rgba(0, 255, 255, 0.15), inset 0 0 20px rgba(0, 255, 255, 0.05)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {/* HUD corners */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyber-cyan/60 rounded-tl" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyber-cyan/60 rounded-tr" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyber-cyan/60 rounded-bl" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyber-cyan/60 rounded-br" />

              <div className="text-cyber-cyan mb-3">
                {NODE_ICONS[active] ?? <Settings size={28} />}
              </div>
              <div className="text-[10px] text-cyber-cyan/60 uppercase tracking-[0.3em] mb-1">
                System Unlocked
              </div>
              <div className="text-lg text-text-primary font-bold">
                {NODE_LABELS[active] ?? active}
              </div>
              <div className="text-[10px] text-text-muted mt-1">
                Level {LEVEL_UNLOCKS[active] ?? "?"} reached
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
