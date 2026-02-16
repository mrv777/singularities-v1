import { motion } from "framer-motion";
import type { NodeDef } from "./NetworkNode";

interface ConnectionDef {
  from: string;
  to: string;
}

const CONNECTIONS: ConnectionDef[] = [
  { from: "scanner", to: "tech_tree" },
  { from: "scanner", to: "system_maintenance" },
  { from: "tech_tree", to: "script_manager" },
  { from: "system_maintenance", to: "security_center" },
  { from: "script_manager", to: "pvp_arena" },
  { from: "pvp_arena", to: "security_center" },
  { from: "network_stats", to: "security_center" },
];

interface NetworkConnectionsProps {
  nodes: NodeDef[];
  playerLevel: number;
  unlockedSystems?: string[];
}

function cubicPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = (x2 - x1) * 0.4;
  const dy = (y2 - y1) * 0.4;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1 + dy}, ${x2 - dx} ${y2 - dy}, ${x2} ${y2}`;
}

export function NetworkConnections({ nodes, playerLevel, unlockedSystems }: NetworkConnectionsProps) {
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <g>
      {CONNECTIONS.map(({ from, to }) => {
        const a = nodeMap[from];
        const b = nodeMap[to];
        if (!a || !b) return null;

        const bothUnlocked = unlockedSystems
          ? unlockedSystems.includes(a.id) && unlockedSystems.includes(b.id) && !a.comingSoon && !b.comingSoon
          : playerLevel >= a.unlockLevel && playerLevel >= b.unlockLevel && !a.comingSoon && !b.comingSoon;

        const path = cubicPath(a.x, a.y, b.x, b.y);

        return (
          <g key={`${from}-${to}`}>
            {/* Base line */}
            <path
              d={path}
              fill="none"
              stroke={bothUnlocked ? "var(--color-cyber-cyan)" : "var(--color-border-default)"}
              strokeWidth={bothUnlocked ? 1.5 : 0.5}
              opacity={bothUnlocked ? 0.4 : 0.15}
            />
            {/* Animated data flow */}
            {bothUnlocked && (
              <motion.path
                d={path}
                fill="none"
                stroke="var(--color-cyber-cyan)"
                strokeWidth={1.5}
                strokeDasharray="4 8"
                opacity={0.6}
                initial={{ strokeDashoffset: 0 }}
                animate={{ strokeDashoffset: -24 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}
