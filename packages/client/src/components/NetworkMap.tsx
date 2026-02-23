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
  Database as DatabaseIcon,
  HelpCircle,
  Cpu,
  Flame,
  Bot,
  Activity,
} from "lucide-react";
import { useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { playSound } from "@/lib/sound";
// AI Core position
const AI_CORE_POS = { x: 400, y: 260 };

// Carefully positioned nodes on 800x520 viewport, radiating from center (400, 260)
const NODES: NodeDef[] = [
  { id: "scanner", label: "Scanner", x: 400, y: 80, unlockLevel: LEVEL_UNLOCKS.scanner, icon: <Radar size={20} /> },
  { id: "data_vault", label: "Data Vault", x: 540, y: 130, unlockLevel: LEVEL_UNLOCKS.data_vault, icon: <DatabaseIcon size={20} /> },
  { id: "ice_breaker", label: "ICE Breaker", x: 600, y: 260, unlockLevel: LEVEL_UNLOCKS.ice_breaker, icon: <Flame size={20} /> },
  { id: "daemon_forge", label: "Daemon Forge", x: 540, y: 390, unlockLevel: LEVEL_UNLOCKS.daemon_forge, icon: <Bot size={20} /> },
  { id: "security_center", label: "Security", x: 400, y: 440, unlockLevel: LEVEL_UNLOCKS.security_center, icon: <ShieldAlert size={20} /> },
  { id: "pvp_arena", label: "Arena", x: 260, y: 390, unlockLevel: LEVEL_UNLOCKS.pvp_arena, icon: <Swords size={20} /> },
  { id: "script_manager", label: "Scripts", x: 200, y: 260, unlockLevel: LEVEL_UNLOCKS.script_manager, icon: <Code2 size={20} /> },
  { id: "tech_tree", label: "Tech Tree", x: 260, y: 130, unlockLevel: LEVEL_UNLOCKS.tech_tree, icon: <GitBranch size={20} /> },
];

function getHealthColor(worstStatus: string | undefined): string {
  if (!worstStatus) return "var(--color-cyber-cyan)";
  if (worstStatus === "CORRUPTED" || worstStatus === "CRITICAL") return "var(--color-cyber-red)";
  if (worstStatus === "DEGRADED") return "var(--color-cyber-amber)";
  return "var(--color-cyber-cyan)";
}

// Map node IDs to their asset file names (for mobile thumbnails)
const NODE_ASSET_MAP: Record<string, string> = {
  scanner: "/assets/nodes/scanner.webp",
  data_vault: "/assets/nodes/data-vault.webp",
  ice_breaker: "/assets/nodes/ice-breaker.webp",
  daemon_forge: "/assets/nodes/daemon-forge.webp",
  pvp_arena: "/assets/nodes/arena.webp",
  script_manager: "/assets/nodes/scripts.webp",
  security_center: "/assets/nodes/security-center.webp",
  tech_tree: "/assets/nodes/tech-tree.webp",
};

interface MobileNodeButtonProps {
  node: NodeDef;
  playerLevel: number;
  unlockedSystems?: string[];
  highlight?: boolean;
  topologyStyle: { glow?: string; tint?: string };
  healthColor: string;
  onClick: (id: string) => void;
}

function MobileNodeButton({ node, playerLevel, unlockedSystems, highlight, topologyStyle, healthColor, onClick }: MobileNodeButtonProps) {
  const unlocked = unlockedSystems
    ? unlockedSystems.includes(node.id)
    : playerLevel >= node.unlockLevel;
  const isBoosted = !!topologyStyle.tint && topologyStyle.tint === "#00ff88";
  const ringColor = unlocked ? healthColor : "var(--color-border-default)";

  return (
    <button
      onClick={() => unlocked && onClick(node.id)}
      disabled={!unlocked}
      className={`flex flex-col items-center justify-center gap-1 p-2 min-h-[80px] rounded-lg border transition-colors ${
        highlight
          ? "border-cyber-cyan bg-cyber-cyan/10 ring-1 ring-cyber-cyan/40 animate-pulse"
          : unlocked
            ? "border-border-default bg-bg-elevated hover:border-cyber-cyan"
            : "border-border-default bg-bg-surface opacity-40 cursor-not-allowed"
      }`}
    >
      <div className="relative">
        <div
          className="w-8 h-8 rounded-full overflow-hidden border-2"
          style={{
            borderColor: ringColor,
            boxShadow: isBoosted ? `0 0 6px ${topologyStyle.tint}` : undefined,
          }}
        >
          {NODE_ASSET_MAP[node.id] ? (
            <img
              src={NODE_ASSET_MAP[node.id]}
              alt={node.label}
              className={`w-full h-full object-cover ${!unlocked ? "grayscale" : ""}`}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-bg-primary text-cyber-cyan">
              {node.icon}
            </div>
          )}
        </div>
        {!unlocked && (
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-bg-surface border border-border-default flex items-center justify-center">
            <Lock size={8} className="text-text-muted" />
          </div>
        )}
      </div>
      <span className={`text-[9px] font-bold tracking-wider leading-tight text-center ${unlocked ? "text-text-primary" : "text-text-muted"}`}>
        {node.label}
      </span>
      {!unlocked && (
        <span className="text-[8px] text-text-muted">LVL {node.unlockLevel}</span>
      )}
    </button>
  );
}

interface NetworkMapProps {
  playerLevel: number;
  unlockedSystems?: string[];
  isInSandbox?: boolean;
  highlightNodeId?: string;
}

export function NetworkMap({ playerLevel, unlockedSystems, isInSandbox, highlightNodeId }: NetworkMapProps) {
  const rawOpenModal = useUIStore((s) => s.openModal);
  const openModal = useCallback((id: string) => {
    playSound("click");
    rawOpenModal(id);
  }, [rawOpenModal]);
  const topology = useGameStore((s) => s.topology);
  const setTopology = useGameStore((s) => s.setTopology);
  const systemHealthSummary = useGameStore((s) => s.systemHealthSummary);
  const setSystemHealthSummary = useGameStore((s) => s.setSystemHealthSummary);
  const showSandboxExit = isInSandbox && playerLevel >= SANDBOX_EXIT_LEVEL;

  useEffect(() => {
    api.getTopology().then((r) => setTopology(r.topology)).catch(() => {});
  }, [setTopology]);

  // Fetch health summary on mount and poll every 30s — pauses when tab is hidden
  useEffect(() => {
    const fetchHealth = () => {
      api.getSystemHealthSummary().then(setSystemHealthSummary).catch(() => {});
    };
    fetchHealth();
    let interval = setInterval(fetchHealth, 30_000);

    const onVisibility = () => {
      clearInterval(interval);
      if (document.visibilityState === "visible") {
        fetchHealth();
        interval = setInterval(fetchHealth, 30_000);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [setSystemHealthSummary]);

  const coreColor = getHealthColor(systemHealthSummary?.worstStatus);

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

          {/* AI Core — clickable, opens system_maintenance */}
          <g
            className="cursor-pointer"
            onClick={() => openModal("system_maintenance")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") openModal("system_maintenance"); }}
          >
            <circle
              cx={AI_CORE_POS.x}
              cy={AI_CORE_POS.y}
              r={65}
              fill="none"
              stroke={coreColor}
              strokeWidth={1}
              strokeDasharray="20 40"
              opacity={0.2}
              style={{ transformOrigin: `${AI_CORE_POS.x}px ${AI_CORE_POS.y}px`, animation: "spin-slow-reverse 40s linear infinite" }}
            />
            <circle
              cx={AI_CORE_POS.x}
              cy={AI_CORE_POS.y}
              r={60}
              fill={`${coreColor}0D`}
              stroke={coreColor}
              strokeWidth={1}
              style={{ animation: "pulse-glow 4s ease-in-out infinite" }}
            />
            <circle
              cx={AI_CORE_POS.x}
              cy={AI_CORE_POS.y}
              r={50}
              fill="none"
              stroke={coreColor}
              strokeWidth={0.5}
              strokeDasharray="5 5"
              style={{ transformOrigin: `${AI_CORE_POS.x}px ${AI_CORE_POS.y}px`, animation: "spin-slow 30s linear infinite" }}
            />
            <circle
              cx={AI_CORE_POS.x}
              cy={AI_CORE_POS.y}
              r={45}
              fill="var(--color-bg-elevated)"
              stroke={coreColor}
              strokeWidth={2}
              style={{ filter: `drop-shadow(0 0 15px ${coreColor}66)` }}
            />
            <foreignObject
              x={AI_CORE_POS.x - 24}
              y={AI_CORE_POS.y - 24}
              width={48}
              height={48}
              className="pointer-events-none"
            >
              <div className="flex items-center justify-center w-full h-full" style={{ color: coreColor }}>
                <Cpu size={36} />
              </div>
            </foreignObject>

            {/* AI Core Text */}
            <g transform={`translate(${AI_CORE_POS.x}, ${AI_CORE_POS.y + 75})`}>
              <text
                textAnchor="middle"
                fontSize={10}
                fontWeight="bold"
                fill={coreColor}
                className="uppercase tracking-[0.3em]"
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
                {systemHealthSummary ? `Status: ${systemHealthSummary.worstStatus}` : "Protocol: Active_Resonance"}
              </text>
            </g>
          </g>

          {/* Tutorial spotlight */}
          {highlightNodeId && (() => {
            const target = NODES.find((n) => n.id === highlightNodeId);
            if (!target) return null;
            return (
              <g>
                <circle cx={target.x} cy={target.y} r={44} fill="none" stroke="var(--color-cyber-cyan)" strokeWidth={2} style={{ animation: "pulse-spotlight 1.5s ease-in-out infinite" }} />
                <circle cx={target.x} cy={target.y} r={52} fill="none" stroke="var(--color-cyber-cyan)" strokeWidth={1} style={{ animation: "pulse-spotlight 1.5s ease-in-out 0.3s infinite" }} />
                <circle cx={target.x} cy={target.y} r={60} fill="none" stroke="var(--color-cyber-cyan)" strokeWidth={0.5} style={{ animation: "pulse-spotlight 1.5s ease-in-out 0.6s infinite" }} />
              </g>
            );
          })()}

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

      {/* Mobile radial icon grid */}
      <div className="sm:hidden px-2">
        <div className="grid grid-cols-3 gap-2 max-w-[320px] mx-auto">
          {/* Top row: nodes 0-2 */}
          {NODES.slice(0, 3).map((node) => (
            <MobileNodeButton
              key={node.id}
              node={node}
              playerLevel={playerLevel}
              unlockedSystems={unlockedSystems}
              highlight={highlightNodeId === node.id}
              topologyStyle={getNodeStyle(node.id)}
              healthColor={coreColor}
              onClick={openModal}
            />
          ))}

          {/* Middle row: node 7 (Tech Tree), AI Core center, node 4 (Security) */}
          <MobileNodeButton
            node={NODES[7]}
            playerLevel={playerLevel}
            unlockedSystems={unlockedSystems}
            highlight={highlightNodeId === NODES[7].id}
            topologyStyle={getNodeStyle(NODES[7].id)}
            healthColor={coreColor}
            onClick={openModal}
          />
          {/* AI Core center button */}
          <button
            onClick={() => openModal("system_maintenance")}
            className="flex flex-col items-center justify-center gap-1 p-2 min-h-[80px] rounded-lg border-2 transition-colors border-cyber-cyan/40 bg-bg-elevated hover:border-cyber-cyan"
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center border-2"
              style={{ borderColor: coreColor, boxShadow: `0 0 8px ${coreColor}44` }}
            >
              <Cpu size={24} style={{ color: coreColor }} />
            </div>
            <span className="text-[9px] text-text-primary font-bold tracking-wider">AI CORE</span>
            {systemHealthSummary && systemHealthSummary.worstStatus !== "OPTIMAL" && (
              <span className="text-[8px] font-bold" style={{ color: coreColor }}>
                {systemHealthSummary.worstStatus}
              </span>
            )}
          </button>
          <MobileNodeButton
            node={NODES[4]}
            playerLevel={playerLevel}
            unlockedSystems={unlockedSystems}
            highlight={highlightNodeId === NODES[4].id}
            topologyStyle={getNodeStyle(NODES[4].id)}
            healthColor={coreColor}
            onClick={openModal}
          />

          {/* Bottom row: pvp_arena, script_manager, daemon_forge */}
          {[NODES[5], NODES[6], NODES[3]].map((node) => (
            <MobileNodeButton
              key={node.id}
              node={node}
              playerLevel={playerLevel}
              unlockedSystems={unlockedSystems}
              highlight={highlightNodeId === node.id}
              topologyStyle={getNodeStyle(node.id)}
              healthColor={coreColor}
              onClick={openModal}
            />
          ))}
        </div>

        {/* Help entry */}
        <button
          onClick={() => openModal("help")}
          className="mt-3 w-full flex items-center justify-center gap-2 p-2 min-h-[40px] rounded border text-[10px] transition-colors border-border-default bg-bg-elevated hover:border-cyber-cyan text-text-secondary tracking-wider"
        >
          <HelpCircle size={14} />
          OPERATIONS MANUAL
        </button>
      </div>
    </>
  );
}
