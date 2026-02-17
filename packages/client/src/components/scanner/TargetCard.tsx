import type { ScanTarget } from "@singularities/shared";
import { RISK_COLORS, TARGET_TYPE_LABELS, getHackEnergyCost } from "@singularities/shared";
import { ResourceCost } from "../ui/ResourceCost";

interface TargetCardProps {
  target: ScanTarget;
  selected: boolean;
  onSelect: () => void;
}

export function TargetCard({ target, selected, onSelect }: TargetCardProps) {
  const riskColor = RISK_COLORS[target.riskRating];
  const energyCost = getHackEnergyCost(target.securityLevel);
  const securityPercent = target.securityLevel;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded border transition-all ${
        selected
          ? "border-cyber-cyan bg-bg-elevated border-glow-cyan"
          : "border-border-default bg-bg-secondary hover:border-border-bright"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-primary text-sm font-semibold">
          {target.name}
        </span>
        <span
          className="text-[11px] px-1.5 py-0.5 rounded uppercase font-bold"
          style={{ color: riskColor, border: `1px solid ${riskColor}40` }}
        >
          {target.riskRating}
        </span>
      </div>

      <div className="text-text-muted text-[11px] mb-2">
        {TARGET_TYPE_LABELS[target.type]}
      </div>

      {/* Security bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[11px] mb-0.5">
          <span className="text-text-secondary">Security</span>
          <span className="text-text-muted">{securityPercent}%</span>
        </div>
        <div className="w-full h-1.5 bg-bg-primary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${securityPercent}%`,
              backgroundColor: riskColor,
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 text-[11px]">
        <div>
          <span className="text-text-muted">Detection:</span>{" "}
          <span className="text-cyber-red">{target.detectionChance}%</span>
        </div>
        <div>
          <span className="text-text-muted">Cost:</span>{" "}
          <ResourceCost costs={{ energy: energyCost }} size={10} />
        </div>
        <div>
          <span className="text-text-muted">Reward:</span>{" "}
          <ResourceCost costs={{ credits: target.rewards.credits }} size={10} prefix="+" />
        </div>
        <div className="flex items-center gap-0.5">
          <ResourceCost costs={{ data: target.rewards.data }} size={10} prefix="+" />
        </div>
      </div>
    </button>
  );
}
