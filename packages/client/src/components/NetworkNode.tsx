import { motion } from "framer-motion";
import { Lock } from "lucide-react";

export interface NodeDef {
  id: string;
  label: string;
  x: number;
  y: number;
  unlockLevel: number;
  comingSoon?: boolean;
  icon: string;
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

  return (
    <g
      className={isUnlocked ? "cursor-pointer" : "cursor-default"}
      onClick={() => isUnlocked && onClick(node.id)}
      style={hasTopo && topologyStyle?.glow ? { filter: topologyStyle.glow } : undefined}
    >
      {/* Glow effect for active nodes */}
      {isUnlocked && (
        <motion.circle
          cx={node.x}
          cy={node.y}
          r={32}
          fill="none"
          stroke={hasTopo ? topologyStyle.tint : "var(--color-cyber-cyan)"}
          strokeWidth={1}
          opacity={0.3}
          animate={{ r: [32, 36, 32], opacity: [0.3, 0.15, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Node circle */}
      <circle
        cx={node.x}
        cy={node.y}
        r={28}
        fill="var(--color-bg-elevated)"
        stroke={
          isComingSoon
            ? "var(--color-border-default)"
            : isUnlocked
              ? (hasTopo ? topologyStyle.tint! : "var(--color-cyber-cyan)")
              : "var(--color-border-default)"
        }
        strokeWidth={isUnlocked ? 2 : 1}
        opacity={isUnlocked ? 1 : isComingSoon ? 0.4 : 0.3}
      />

      {/* Icon text */}
      <text
        x={node.x}
        y={node.y + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={16}
        fill={
          isComingSoon
            ? "var(--color-text-muted)"
            : isUnlocked
              ? (hasTopo ? topologyStyle.tint! : "var(--color-cyber-cyan)")
              : "var(--color-text-muted)"
        }
        opacity={isUnlocked ? 1 : 0.4}
      >
        {isComingSoon ? "?" : node.icon}
      </text>

      {/* Label */}
      <text
        x={node.x}
        y={node.y + 44}
        textAnchor="middle"
        fontSize={9}
        fontFamily="var(--font-mono)"
        fill={isUnlocked ? "var(--color-text-primary)" : "var(--color-text-muted)"}
        opacity={isUnlocked ? 1 : 0.5}
      >
        {isComingSoon ? "???" : node.label}
      </text>

      {/* Topology tooltip */}
      {hasTopo && topologyStyle?.tooltip && (
        <text
          x={node.x}
          y={node.y + 56}
          textAnchor="middle"
          fontSize={7}
          fontFamily="var(--font-mono)"
          fill={topologyStyle.tint}
          opacity={0.8}
        >
          {topologyStyle.tooltip}
        </text>
      )}

      {/* Lock / level badge */}
      {!isUnlocked && !isComingSoon && (
        <g>
          <rect
            x={node.x + 12}
            y={node.y - 28}
            width={24}
            height={14}
            rx={3}
            fill="var(--color-bg-primary)"
            stroke="var(--color-border-default)"
            strokeWidth={0.5}
          />
          <text
            x={node.x + 24}
            y={node.y - 19}
            textAnchor="middle"
            fontSize={7}
            fontFamily="var(--font-mono)"
            fill="var(--color-text-muted)"
          >
            LV{node.unlockLevel}
          </text>
        </g>
      )}
    </g>
  );
}
