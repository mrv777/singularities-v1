import { Modal } from "./Modal";
import { useUIStore } from "@/stores/ui";
import { useModifier } from "@/hooks/useModifier";
import type { ModifierEffect } from "@singularities/shared";

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

function formatEffect(key: keyof ModifierEffect, value: number): { label: string; text: string; positive: boolean } {
  const label = EFFECT_LABELS[key];
  const pct = Math.round((value - 1) * 100);
  const sign = pct > 0 ? "+" : "";
  const text = `${sign}${pct}%`;

  // For costs/degradation/detection, lower is better; for rewards/income/xp/heat-decay, higher is better
  const invertedKeys: (keyof ModifierEffect)[] = [
    "energyCostMultiplier",
    "degradationRateMultiplier",
    "repairCostMultiplier",
    "detectionChanceMultiplier",
  ];
  const positive = invertedKeys.includes(key) ? pct < 0 : pct > 0;

  return { label, text, positive };
}

export function ModifierDetailModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const { data } = useModifier();

  const open = activeModal === "modifier_detail";
  const modifier = data?.modifier;

  return (
    <Modal open={open} onClose={closeModal} title="DAILY MODIFIER" maxWidth="max-w-md">
      {!modifier ? (
        <p className="text-text-muted text-sm">No modifier active today.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-text-primary text-sm font-semibold">{modifier.name}</h3>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  modifier.severity === "major"
                    ? "bg-cyber-amber/10 text-cyber-amber border border-cyber-amber/30"
                    : "bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30"
                }`}
              >
                {modifier.severity.toUpperCase()}
              </span>
            </div>
            <p className="text-text-secondary text-xs">{modifier.description}</p>
          </div>

          <div className="space-y-2">
            <h4 className="text-text-muted text-[10px] uppercase tracking-wider">Effects</h4>
            {Object.entries(modifier.effects).map(([key, value]) => {
              if (value === undefined || value === 1) return null;
              const { label, text, positive } = formatEffect(key as keyof ModifierEffect, value as number);
              return (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">{label}</span>
                  <span className={positive ? "text-cyber-green" : "text-cyber-red"}>
                    {text}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="text-text-muted text-[10px] pt-2 border-t border-border-default">
            Modifiers rotate daily at midnight UTC. Date: {data?.date}
          </div>
        </div>
      )}
    </Modal>
  );
}
