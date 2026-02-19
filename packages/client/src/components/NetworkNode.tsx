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

// Map node IDs to their asset file names
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

  const assetSrc = NODE_ASSET_MAP[node.id];

  return (
    <g
      className={isUnlocked ? "cursor-pointer group" : "cursor-default"}
      onClick={() => isUnlocked && onClick(node.id)}
    >
      {/* Outer rotating circuit ring */}
      {isUnlocked && (
        <circle
          cx={node.x}
          cy={node.y}
          r={36}
          fill="none"
          stroke={nodeColor}
          strokeWidth={1}
          strokeDasharray="10 20"
          opacity={0.2}
          style={{ transformOrigin: `${node.x}px ${node.y}px`, animation: "spin-slow 20s linear infinite" }}
        />
      )}

      {/* Pulsing selection glow */}
      {isUnlocked && (
        <circle
          cx={node.x}
          cy={node.y}
          r={28}
          fill="none"
          stroke={nodeColor}
          strokeWidth={2}
          opacity={0}
          className="group-hover:opacity-40 transition-opacity"
          style={{ animation: "pulse-node 2s ease-in-out infinite" }}
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

      {/* Hexagonal decorative frame */}
      {isUnlocked && (
        <path
          d={`M ${node.x} ${node.y - 32} L ${node.x + 28} ${node.y - 16} L ${node.x + 28} ${node.y + 16} L ${node.x} ${node.y + 32} L ${node.x - 28} ${node.y + 16} L ${node.x - 28} ${node.y - 16} Z`}
          fill="none"
          stroke={nodeColor}
          strokeWidth={0.5}
          opacity={0.3}
        />
      )}

      {/* Node icon: use illustrated asset if available, fall back to Lucide icon */}
      {isComingSoon ? (
        <foreignObject
          x={node.x - 10}
          y={node.y - 10}
          width={20}
          height={20}
          className="pointer-events-none"
        >
          <div className="flex items-center justify-center w-full h-full" style={{ color: nodeColor, opacity: 0.4 }}>
            <Lock size={16} />
          </div>
        </foreignObject>
      ) : assetSrc && !isComingSoon ? (
        /* Illustrated asset clipped to the node circle */
        <clipPath id={`clip-${node.id}`}>
          <circle cx={node.x} cy={node.y} r={26} />
        </clipPath>
      ) : null}

      {assetSrc && !isComingSoon && (
        <image
          href={assetSrc}
          x={node.x - 26}
          y={node.y - 26}
          width={52}
          height={52}
          clipPath={`url(#clip-${node.id})`}
          opacity={isUnlocked ? 0.9 : 0.2}
          style={{
            filter: isUnlocked
              ? `drop-shadow(0 0 3px ${nodeColor}80) ${hasTopo && topologyStyle?.glow ? topologyStyle.glow : ""}`
              : "none",
          }}
          preserveAspectRatio="xMidYMid slice"
        />
      )}

      {/* Fallback: Lucide icon when no asset or locked */}
      {!assetSrc && (
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
              filter: isUnlocked ? "drop-shadow(0 0 2px currentColor)" : "none",
            }}
          >
            {node.icon}
          </div>
        </foreignObject>
      )}

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
        <text
          textAnchor="middle"
          y="8"
          fontSize={8}
          fontWeight="bold"
          fontFamily="var(--font-mono)"
          fill={isUnlocked ? "var(--color-text-primary)" : "var(--color-text-muted)"}
          opacity={isUnlocked ? 1 : 0.5}
          className="uppercase tracking-wider"
          style={!isUnlocked ? { animation: "flicker-locked 2s ease-in-out infinite" } : undefined}
        >
          {isComingSoon ? "SYS_OFFLINE" : node.label.replace(" ", "_")}
        </text>
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
