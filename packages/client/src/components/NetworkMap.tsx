import { LEVEL_UNLOCKS, SANDBOX_EXIT_LEVEL } from "@singularities/shared";
import type { WeeklyTopology } from "@singularities/shared";
import { NetworkNode, type NodeDef } from "./NetworkNode";
import { NetworkConnections } from "./NetworkConnections";
import { useUIStore } from "@/stores/ui";
import { useGameStore } from "@/stores/game";
import { 
  Lock, 
  LogOut, 
  Radar, 
  GitBranch, 
  Settings, 
  Code2, 
  Swords, 
  ShieldAlert, 
  BarChart3, 
  FlaskConical, 
  Database as DatabaseIcon 
} from "lucide-react";
import { useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { playSound } from "@/lib/sound";

// Carefully positioned nodes on 800x600 viewport
const NODES: NodeDef[] = [
  { id: "scanner", label: "Scanner", x: 400, y: 80, unlockLevel: LEVEL_UNLOCKS.scanner, icon: <Radar size={20} /> },
  { id: "tech_tree", label: "Tech Tree", x: 180, y: 220, unlockLevel: LEVEL_UNLOCKS.tech_tree, icon: <GitBranch size={20} /> },
  { id: "system_maintenance", label: "Systems", x: 620, y: 220, unlockLevel: LEVEL_UNLOCKS.system_maintenance, icon: <Settings size={20} /> },
  { id: "script_manager", label: "Scripts", x: 140, y: 400, unlockLevel: LEVEL_UNLOCKS.script_manager, icon: <Code2 size={20} /> },
  { id: "pvp_arena", label: "Arena", x: 400, y: 440, unlockLevel: LEVEL_UNLOCKS.pvp_arena, icon: <Swords size={20} /> },
  { id: "security_center", label: "Security", x: 660, y: 400, unlockLevel: LEVEL_UNLOCKS.security_center, icon: <ShieldAlert size={20} /> },
  { id: "network_stats", label: "Net Stats", x: 720, y: 300, unlockLevel: LEVEL_UNLOCKS.network_stats, icon: <BarChart3 size={20} /> },
  { id: "quantum_lab", label: "???", x: 120, y: 100, unlockLevel: 99, comingSoon: true, icon: <FlaskConical size={20} /> },
  { id: "data_vault", label: "???", x: 680, y: 80, unlockLevel: 99, comingSoon: true, icon: <DatabaseIcon size={20} /> },
];

interface NetworkMapProps {
  playerLevel: number;
  unlockedSystems?: string[];
  isInSandbox?: boolean;
}

export function NetworkMap({ playerLevel, unlockedSystems, isInSandbox }: NetworkMapProps) {
  const rawOpenModal = useUIStore((s) => s.openModal);
  const openModal = useCallback((id: string) => {
    playSound("click");
    rawOpenModal(id);
  }, [rawOpenModal]);
  const topology = useGameStore((s) => s.topology);
  const setTopology = useGameStore((s) => s.setTopology);
  const showSandboxExit = isInSandbox && playerLevel >= SANDBOX_EXIT_LEVEL;

  useEffect(() => {
    api.getTopology().then((r) => setTopology(r.topology)).catch(() => {});
  }, [setTopology]);

  function getNodeStyle(nodeId: string): { glow?: string; tint?: string; tooltip?: string } {
    if (!topology) return {};
    if (topology.boostedNode === nodeId) {
      return {
        glow: "drop-shadow(0 0 6px #00ff88)",
        tint: "#00ff88",
        tooltip: topology.boostEffect ? `${topology.boostEffect.label}: ${topology.boostEffect.description}` : "Boosted",
      };
    }
    if (topology.hinderedNode === nodeId) {
      return {
        glow: "drop-shadow(0 0 4px #ffaa00)",
        tint: "#ffaa00",
        tooltip: topology.hindranceEffect ? `${topology.hindranceEffect.label}: ${topology.hindranceEffect.description}` : "Hindered",
      };
    }
    return {};
  }

  return (
    <>
      {/* SVG map for desktop */}
      <div className="hidden sm:block w-full">
        <svg
          viewBox="0 0 800 520"
          className="w-full max-w-3xl mx-auto"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <NetworkConnections nodes={NODES} playerLevel={playerLevel} unlockedSystems={unlockedSystems} />
          {NODES.map((node) => (
            <NetworkNode
              key={node.id}
              node={node}
              playerLevel={playerLevel}
              unlockedSystems={unlockedSystems}
              onClick={openModal}
              topologyStyle={getNodeStyle(node.id)}
            />
          ))}
        </svg>
      </div>

      {/* Sandbox Exit Indicator */}
      {showSandboxExit && (
        <div className="w-full max-w-3xl mx-auto flex justify-center mt-2">
          <button
            onClick={() => openModal("sandbox_exit")}
            className="flex items-center gap-2 px-4 py-2 border border-cyber-yellow/50 text-cyber-yellow rounded text-xs hover:bg-cyber-yellow/10 transition-colors animate-pulse"
          >
            <LogOut size={12} />
            EXIT SANDBOX — Enter the live network
          </button>
        </div>
      )}

      {/* Mobile list fallback */}
      <div className="sm:hidden space-y-2">
        {NODES.filter((n) => !n.comingSoon).map((node) => {
          const unlocked = unlockedSystems
            ? unlockedSystems.includes(node.id)
            : playerLevel >= node.unlockLevel;
          return (
            <button
              key={node.id}
              onClick={() => unlocked && openModal(node.id)}
              disabled={!unlocked}
              className={`w-full flex items-center gap-3 p-3 min-h-[48px] rounded border text-left text-sm transition-colors ${
                unlocked
                  ? "border-cyber-cyan/30 bg-bg-elevated hover:border-cyber-cyan text-text-primary"
                  : "border-border-default bg-bg-surface text-text-muted cursor-not-allowed opacity-50"
              }`}
            >
              <span className={`text-lg ${unlocked ? "text-cyber-cyan" : ""}`}>
                {node.icon}
              </span>
              <span className="flex-1">{node.label}</span>
              {!unlocked && (
                <span className="text-xs text-text-muted flex items-center gap-1">
                  <Lock size={10} /> LVL {node.unlockLevel}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
