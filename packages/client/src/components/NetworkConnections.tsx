import { motion } from "framer-motion";
import type { NodeDef } from "./NetworkNode";

const AI_CORE_POS = { x: 400, y: 260 };

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
  return (
    <g>
      {nodes.map((node) => {
        const isUnlocked = unlockedSystems
          ? unlockedSystems.includes(node.id) && !node.comingSoon
          : playerLevel >= node.unlockLevel && !node.comingSoon;

        // Path from AI Core to Node
        const path = cubicPath(AI_CORE_POS.x, AI_CORE_POS.y, node.x, node.y);

        return (
          <g key={`core-${node.id}`}>
            {/* Base line */}
            <path
              d={path}
              fill="none"
              stroke={isUnlocked ? "var(--color-cyber-cyan)" : "var(--color-border-default)"}
              strokeWidth={isUnlocked ? 1.5 : 0.5}
              opacity={isUnlocked ? 0.3 : 0.1}
            />
            
            {/* Animated data flow from core to node */}
            {isUnlocked && (
              <motion.path
                d={path}
                fill="none"
                stroke="var(--color-cyber-cyan)"
                strokeWidth={1.5}
                strokeDasharray="4 12"
                opacity={0.4}
                initial={{ strokeDashoffset: 0 }}
                animate={{ strokeDashoffset: -32 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
            )}

            {/* Pulsing connection point at node end */}
            {isUnlocked && (
              <motion.circle
                cx={node.x}
                cy={node.y}
                r={2}
                fill="var(--color-cyber-cyan)"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}
