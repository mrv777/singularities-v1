import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";

export interface NodeDef {
  id: string;
  label: string;
  x: number;
  y: number;
  unlockLevel: number;
  comingSoon?: boolean;
  icon: ReactNode;
}

export interface TopologyStyle {
  glow?: string;
  tint?: string;
  tooltip?: string;
}

interface NetworkNodeProps {
  node: NodeDef;
  playerLevel: number;
  unlockedSystems?: string[];
  onClick: (id: string) => void;
  topologyStyle?: TopologyStyle;
}

export function NetworkNode({ node, playerLevel, unlockedSystems, onClick, topologyStyle }: NetworkNodeProps) {
  const isUnlocked = unlockedSystems
    ? unlockedSystems.includes(node.id) && !node.comingSoon
    : playerLevel >= node.unlockLevel && !node.comingSoon;
  const isComingSoon = node.comingSoon;

  const hasTopo = isUnlocked && topologyStyle?.tint;
  const nodeColor = isComingSoon
    ? "var(--color-text-muted)"
    : isUnlocked
      ? (hasTopo ? topologyStyle.tint! : "var(--color-cyber-cyan)")
      : "var(--color-text-muted)";

  return (
    <g
      className={isUnlocked ? "cursor-pointer group" : "cursor-default"}
      onClick={() => isUnlocked && onClick(node.id)}
    >
      {/* Outer rotating circuit ring */}
      {isUnlocked && (
        <motion.circle
          cx={node.x}
          cy={node.y}
          r={36}
          fill="none"
          stroke={nodeColor}
          strokeWidth={1}
          strokeDasharray="10 20"
          opacity={0.2}
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* Pulsing selection glow */}
      {isUnlocked && (
        <motion.circle
          cx={node.x}
          cy={node.y}
          r={28}
          fill="none"
          stroke={nodeColor}
          strokeWidth={2}
          opacity={0}
          className="group-hover:opacity-40 transition-opacity"
          animate={{ r: [28, 32, 28] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {/* Main node circle */}
      <circle
        cx={node.x}
        cy={node.y}
        r={28}
        fill="var(--color-bg-elevated)"
        stroke={nodeColor}
        strokeWidth={isUnlocked ? 2 : 1}
        opacity={isUnlocked ? 1 : isComingSoon ? 0.4 : 0.3}
        style={hasTopo && topologyStyle?.glow ? { filter: topologyStyle.glow } : undefined}
      />

      {/* Hexagonal decorative frame (simulated with path) */}
      {isUnlocked && (
        <path
          d={`M ${node.x} ${node.y - 32} L ${node.x + 28} ${node.y - 16} L ${node.x + 28} ${node.y + 16} L ${node.x} ${node.y + 32} L ${node.x - 28} ${node.y + 16} L ${node.x - 28} ${node.y - 16} Z`}
          fill="none"
          stroke={nodeColor}
          strokeWidth={0.5}
          opacity={0.3}
        />
      )}

      {/* Icon rendering */}
      <foreignObject
        x={node.x - 10}
        y={node.y - 10}
        width={20}
        height={20}
        className="pointer-events-none"
      >
        <div 
          className="flex items-center justify-center w-full h-full"
          style={{ 
            color: nodeColor,
            opacity: isUnlocked ? 1 : 0.4,
            filter: isUnlocked ? "drop-shadow(0 0 2px currentColor)" : "none"
          }}
        >
          {isComingSoon ? <Lock size={16} /> : node.icon}
        </div>
      </foreignObject>

      {/* Label */}
      <g transform={`translate(${node.x}, ${node.y + 46})`}>
        <rect
          x="-35"
          y="-1"
          width="70"
          height="12"
          fill="var(--color-bg-primary)"
          fillOpacity="0.8"
          rx="2"
        />
        <motion.text
          textAnchor="middle"
          y="8"
          fontSize={8}
          fontWeight="bold"
          fontFamily="var(--font-mono)"
          fill={isUnlocked ? "var(--color-text-primary)" : "var(--color-text-muted)"}
          opacity={isUnlocked ? 1 : 0.5}
          className="uppercase tracking-wider"
          animate={!isUnlocked ? {
            opacity: [0.5, 0.3, 0.5, 0.4, 0.5],
            x: [0, -1, 1, 0]
          } : {}}
          transition={!isUnlocked ? {
            duration: 2,
            repeat: Infinity,
            times: [0, 0.1, 0.2, 0.3, 1]
          } : {}}
        >
          {isComingSoon ? "SYS_OFFLINE" : node.label.replace(" ", "_")}
        </motion.text>
      </g>

      {/* Decorative ID/Status line */}
      {isUnlocked && (
        <g transform={`translate(${node.x + 32}, ${node.y - 12})`}>
          <text
            fontSize={5}
            fontFamily="var(--font-mono)"
            fill={nodeColor}
            opacity={0.4}
          >
            ID_{node.id.substring(0, 4).toUpperCase()}
          </text>
          <text
            y="6"
            fontSize={5}
            fontFamily="var(--font-mono)"
            fill={nodeColor}
            opacity={0.4}
          >
            STATUS:OK
          </text>
        </g>
      )}

      {/* Topology tooltip */}
      {hasTopo && topologyStyle?.tooltip && (
        <text
          x={node.x}
          y={node.y + 62}
          textAnchor="middle"
          fontSize={7}
          fontFamily="var(--font-mono)"
          fill={topologyStyle.tint}
          opacity={0.8}
          className="font-bold"
        >
          {`> ${topologyStyle.tooltip.toUpperCase()}`}
        </text>
      )}

      {/* Lock / level badge */}
      {!isUnlocked && !isComingSoon && (
        <g transform={`translate(${node.x + 14}, ${node.y - 28})`}>
          <rect
            width="22"
            height="12"
            rx="2"
            fill="var(--color-bg-surface)"
            stroke="var(--color-border-default)"
            strokeWidth={1}
          />
          <text
            x="11"
            y="8.5"
            textAnchor="middle"
            fontSize={7}
            fontWeight="bold"
            fontFamily="var(--font-mono)"
            fill="var(--color-cyber-red)"
          >
            L{node.unlockLevel}
          </text>
        </g>
      )}
    </g>
  );
}
