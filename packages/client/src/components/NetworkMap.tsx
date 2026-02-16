import { LEVEL_UNLOCKS } from "@singularities/shared";
import { NetworkNode, type NodeDef } from "./NetworkNode";
import { NetworkConnections } from "./NetworkConnections";
import { useUIStore } from "@/stores/ui";
import { Lock } from "lucide-react";

// Carefully positioned nodes on 800x600 viewport
const NODES: NodeDef[] = [
  { id: "scanner", label: "Scanner", x: 400, y: 80, unlockLevel: LEVEL_UNLOCKS.scanner, icon: "S" },
  { id: "tech_tree", label: "Tech Tree", x: 180, y: 220, unlockLevel: LEVEL_UNLOCKS.tech_tree, icon: "T" },
  { id: "system_maintenance", label: "Systems", x: 620, y: 220, unlockLevel: LEVEL_UNLOCKS.system_maintenance, icon: "M" },
  { id: "script_manager", label: "Scripts", x: 140, y: 400, unlockLevel: LEVEL_UNLOCKS.script_manager, icon: "A" },
  { id: "pvp_arena", label: "Arena", x: 400, y: 440, unlockLevel: LEVEL_UNLOCKS.pvp_arena, icon: "V" },
  { id: "security_center", label: "Security", x: 660, y: 400, unlockLevel: LEVEL_UNLOCKS.security_center, icon: "X" },
  { id: "network_stats", label: "Net Stats", x: 720, y: 300, unlockLevel: LEVEL_UNLOCKS.network_stats, icon: "N" },
  { id: "quantum_lab", label: "???", x: 120, y: 100, unlockLevel: 99, comingSoon: true, icon: "?" },
  { id: "data_vault", label: "???", x: 680, y: 80, unlockLevel: 99, comingSoon: true, icon: "?" },
];

interface NetworkMapProps {
  playerLevel: number;
  unlockedSystems?: string[];
}

export function NetworkMap({ playerLevel, unlockedSystems }: NetworkMapProps) {
  const openModal = useUIStore((s) => s.openModal);

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
            />
          ))}
        </svg>
      </div>

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
              className={`w-full flex items-center gap-3 p-3 rounded border text-left text-sm transition-colors ${
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
