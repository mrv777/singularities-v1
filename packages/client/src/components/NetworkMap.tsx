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
  Database as DatabaseIcon,
  HelpCircle,
  Cpu
} from "lucide-react";
import { useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { playSound } from "@/lib/sound";
import { motion } from "framer-motion";

// AI Core position
const AI_CORE_POS = { x: 400, y: 260 };

// Carefully positioned nodes on 800x520 viewport, radiating from center (400, 260)
const NODES: NodeDef[] = [
  { id: "scanner", label: "Scanner", x: 400, y: 80, unlockLevel: LEVEL_UNLOCKS.scanner, icon: <Radar size={20} /> },
  { id: "data_vault", label: "Data Vault", x: 540, y: 130, unlockLevel: LEVEL_UNLOCKS.data_vault, icon: <DatabaseIcon size={20} /> },
  { id: "network_stats", label: "Net Stats", x: 600, y: 260, unlockLevel: LEVEL_UNLOCKS.network_stats, icon: <BarChart3 size={20} /> },
  { id: "system_maintenance", label: "Systems", x: 540, y: 390, unlockLevel: LEVEL_UNLOCKS.system_maintenance, icon: <Settings size={20} /> },
  { id: "security_center", label: "Security", x: 400, y: 440, unlockLevel: LEVEL_UNLOCKS.security_center, icon: <ShieldAlert size={20} /> },
  { id: "pvp_arena", label: "Arena", x: 260, y: 390, unlockLevel: LEVEL_UNLOCKS.pvp_arena, icon: <Swords size={20} /> },
  { id: "script_manager", label: "Scripts", x: 200, y: 260, unlockLevel: LEVEL_UNLOCKS.script_manager, icon: <Code2 size={20} /> },
  { id: "tech_tree", label: "Tech Tree", x: 260, y: 130, unlockLevel: LEVEL_UNLOCKS.tech_tree, icon: <GitBranch size={20} /> },
  { id: "quantum_lab", label: "Quantum Lab", x: 140, y: 100, unlockLevel: LEVEL_UNLOCKS.quantum_lab, comingSoon: true, icon: <FlaskConical size={20} /> },
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
      <div className="hidden sm:block w-full relative">
        <div className="absolute inset-0 pointer-events-none cyber-grid opacity-10" />
        <svg
          viewBox="0 0 800 520"
          className="w-full max-w-3xl mx-auto relative z-10"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {/* Background decorative elements */}
          <circle cx={AI_CORE_POS.x} cy={AI_CORE_POS.y} r={180} fill="none" stroke="var(--color-border-default)" strokeWidth={1} strokeDasharray="5 15" opacity={0.2} />
          <circle cx={AI_CORE_POS.x} cy={AI_CORE_POS.y} r={280} fill="none" stroke="var(--color-border-default)" strokeWidth={0.5} strokeDasharray="2 10" opacity={0.15} />
          
          {/* Angular connectors from center to nodes */}
          <NetworkConnections nodes={NODES} playerLevel={playerLevel} unlockedSystems={unlockedSystems} />
          
          {/* AI Core placeholder */}
          <g>
            <motion.circle
              cx={AI_CORE_POS.x}
              cy={AI_CORE_POS.y}
              r={65}
              fill="none"
              stroke="var(--color-cyber-cyan)"
              strokeWidth={1}
              strokeDasharray="20 40"
              opacity={0.2}
              animate={{ rotate: -360 }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            />
            <motion.circle
              cx={AI_CORE_POS.x}
              cy={AI_CORE_POS.y}
              r={60}
              fill="rgba(0, 240, 255, 0.05)"
              stroke="var(--color-cyber-cyan)"
              strokeWidth={1}
              animate={{ 
                r: [60, 64, 60],
                opacity: [0.3, 0.5, 0.3]
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.circle
              cx={AI_CORE_POS.x}
              cy={AI_CORE_POS.y}
              r={50}
              fill="none"
              stroke="var(--color-cyber-cyan)"
              strokeWidth={0.5}
              strokeDasharray="5 5"
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            />
            <circle
              cx={AI_CORE_POS.x}
              cy={AI_CORE_POS.y}
              r={45}
              fill="var(--color-bg-elevated)"
              stroke="var(--color-cyber-cyan)"
              strokeWidth={2}
              className="drop-shadow-[0_0_15px_rgba(0,240,255,0.4)]"
            />
            <foreignObject
              x={AI_CORE_POS.x - 24}
              y={AI_CORE_POS.y - 24}
              width={48}
              height={48}
              className="pointer-events-none"
            >
              <div className="flex items-center justify-center w-full h-full text-cyber-cyan">
                <Cpu size={36} />
              </div>
            </foreignObject>
            
            {/* AI Core Text */}
            <g transform={`translate(${AI_CORE_POS.x}, ${AI_CORE_POS.y + 75})`}>
              <text
                textAnchor="middle"
                fontSize={10}
                fontWeight="bold"
                fill="var(--color-cyber-cyan)"
                className="uppercase tracking-[0.3em] glow-cyan"
              >
                CENTRAL_INTELLIGENCE
              </text>
              <text
                y="14"
                textAnchor="middle"
                fontSize={7}
                fill="var(--color-text-secondary)"
                className="uppercase tracking-[0.1em]"
              >
                Protocol: Active_Resonance
              </text>
            </g>
          </g>

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
        {/* Help entry */}
        <button
          onClick={() => openModal("help")}
          className="w-full flex items-center gap-3 p-3 min-h-[48px] rounded border text-left text-sm transition-colors border-border-default bg-bg-elevated hover:border-cyber-cyan text-text-secondary"
        >
          <span className="text-lg text-text-muted"><HelpCircle size={20} /></span>
          <span className="flex-1">Operations Manual</span>
        </button>
      </div>
    </>
  );
}
