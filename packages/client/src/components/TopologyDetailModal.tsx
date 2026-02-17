import { Modal } from "./Modal";
import { useUIStore } from "@/stores/ui";
import { useGameStore } from "@/stores/game";
import type { ModifierEffect } from "@singularities/shared";

const NODE_LABELS: Record<string, string> = {
  scanner: "Scanner",
  tech_tree: "Tech Tree",
  system_maintenance: "Systems",
  script_manager: "Scripts",
  pvp_arena: "Arena",
  security_center: "Security",
  network_stats: "Net Stats",
};

const EFFECT_LABELS: Record<keyof ModifierEffect, string> = {
  energyCostMultiplier: "Energy Costs",
  hackRewardMultiplier: "Hack Rewards",
  degradationRateMultiplier: "Degradation Rate",
  repairCostMultiplier: "Repair Costs",
  passiveIncomeMultiplier: "Passive Income",
  detectionChanceMultiplier: "Detection Chance",
  xpGainMultiplier: "XP Gain",
  heatDecayMultiplier: "Heat Decay",
};

function formatEffect(key: string, value: number): { label: string; text: string; positive: boolean } {
  const label = EFFECT_LABELS[key as keyof ModifierEffect] ?? key;
  const pct = Math.round((value - 1) * 100);
  const sign = pct > 0 ? "+" : "";
  const text = `${sign}${pct}%`;

  const invertedKeys = [
    "energyCostMultiplier",
    "degradationRateMultiplier",
    "repairCostMultiplier",
    "detectionChanceMultiplier",
  ];
  const positive = invertedKeys.includes(key) ? pct < 0 : pct > 0;

  return { label, text, positive };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function TopologyDetailModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const topology = useGameStore((s) => s.topology);

  const open = activeModal === "topology_detail";

  return (
    <Modal open={open} onClose={closeModal} title="WEEKLY GRID SHIFT" maxWidth="max-w-md">
      {!topology ? (
        <p className="text-text-muted text-sm">No topology data available.</p>
      ) : (
        <div className="space-y-4">
          <div className="text-text-secondary text-xs">
            {formatDate(topology.weekStart)} — {formatDate(topology.weekEnd)}
          </div>

          {/* Boost section */}
          {topology.boostedNode && topology.boostEffect && (
            <div className="space-y-2">
              <h4 className="text-[10px] uppercase tracking-wider text-cyber-green flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyber-green" />
                Boost — {NODE_LABELS[topology.boostedNode] ?? topology.boostedNode}
              </h4>
              <div className="bg-cyber-green/5 border border-cyber-green/20 rounded p-3 space-y-2">
                <div>
                  <span className="text-text-primary text-xs font-semibold">{topology.boostEffect.label}</span>
                  <p className="text-text-secondary text-[11px] mt-0.5">{topology.boostEffect.description}</p>
                </div>
                {Object.entries(topology.boostEffect.modifiers).map(([key, value]) => {
                  if (value === 1) return null;
                  const { label, text, positive } = formatEffect(key, value);
                  return (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">{label}</span>
                      <span className={positive ? "text-cyber-green" : "text-cyber-red"}>{text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hindrance section */}
          {topology.hinderedNode && topology.hindranceEffect && (
            <div className="space-y-2">
              <h4 className="text-[10px] uppercase tracking-wider text-cyber-amber flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyber-amber" />
                Hindrance — {NODE_LABELS[topology.hinderedNode] ?? topology.hinderedNode}
              </h4>
              <div className="bg-cyber-amber/5 border border-cyber-amber/20 rounded p-3 space-y-2">
                <div>
                  <span className="text-text-primary text-xs font-semibold">{topology.hindranceEffect.label}</span>
                  <p className="text-text-secondary text-[11px] mt-0.5">{topology.hindranceEffect.description}</p>
                </div>
                {Object.entries(topology.hindranceEffect.modifiers).map(([key, value]) => {
                  if (value === 1) return null;
                  const { label, text, positive } = formatEffect(key, value);
                  return (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">{label}</span>
                      <span className={positive ? "text-cyber-green" : "text-cyber-red"}>{text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="text-text-muted text-[10px] pt-2 border-t border-border-default">
            Grid shifts rotate every Monday at midnight UTC.
          </div>
        </div>
      )}
    </Modal>
  );
}
