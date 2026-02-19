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
      {nodes.map((node, index) => {
        const isUnlocked = unlockedSystems
          ? unlockedSystems.includes(node.id) && !node.comingSoon
          : playerLevel >= node.unlockLevel && !node.comingSoon;

        // Path from AI Core to Node
        const path = cubicPath(AI_CORE_POS.x, AI_CORE_POS.y, node.x, node.y);
        const pathId = `conn-path-${node.id}`;
        // Stagger each packet's travel timing so they don't all start together
        const packetDelay = index * 0.7;
        const packetDuration = 2.5 + (index % 3) * 0.5;

        return (
          <g key={`core-${node.id}`}>
            {/* Base line — needs an id for mpath reference */}
            <path
              id={pathId}
              d={path}
              fill="none"
              stroke={isUnlocked ? "var(--color-cyber-cyan)" : "var(--color-border-default)"}
              strokeWidth={isUnlocked ? 1.5 : 0.5}
              opacity={isUnlocked ? 0.3 : 0.1}
            />

            {/* Animated dash flow from core to node */}
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

            {/* Glowing data packet traveling core → node */}
            {isUnlocked && (
              <g>
                {/* Outer glow */}
                <circle r={4} fill="none" stroke="var(--color-cyber-cyan)" strokeWidth={1} opacity={0.4}>
                  <animateMotion
                    dur={`${packetDuration}s`}
                    begin={`${packetDelay}s`}
                    repeatCount="indefinite"
                    calcMode="spline"
                    keyTimes="0;1"
                    keySplines="0.4 0 0.6 1"
                  >
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </circle>
                {/* Inner bright dot */}
                <circle r={2.5} fill="var(--color-cyber-cyan)" opacity={0.9}>
                  <animateMotion
                    dur={`${packetDuration}s`}
                    begin={`${packetDelay}s`}
                    repeatCount="indefinite"
                    calcMode="spline"
                    keyTimes="0;1"
                    keySplines="0.4 0 0.6 1"
                  >
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </circle>
              </g>
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
