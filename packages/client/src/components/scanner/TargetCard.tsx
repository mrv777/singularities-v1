import type { ScanTarget } from "@singularities/shared";
import { RISK_COLORS, TARGET_TYPE_LABELS, MINIGAME_LABELS } from "@singularities/shared";
import { ResourceCost } from "../ui/ResourceCost";

interface TargetCardProps {
  target: ScanTarget;
  selected: boolean;
  onSelect: () => void;
}

const GAME_TYPE_ICONS: Record<string, string> = {
  signal_crack: "\u{1F511}",
  port_sweep: "\u{1F4E1}",
  network_relink: "\u{1F517}",
};

function getSecurityTier(securityLevel: number): string {
  if (securityLevel < 30) return "T1";
  if (securityLevel < 55) return "T2";
  if (securityLevel < 75) return "T3";
  return "T4";
}

export function TargetCard({ target, selected, onSelect }: TargetCardProps) {
  const riskColor = RISK_COLORS[target.riskRating];
  const securityPercent = target.securityLevel;
  const securityTier = getSecurityTier(securityPercent);

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

      <div className="flex items-center justify-between mb-2">
        <span className="text-text-muted text-[11px]">
          {TARGET_TYPE_LABELS[target.type]}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded border border-cyber-cyan/30 text-cyber-cyan bg-cyber-cyan/5">
          {GAME_TYPE_ICONS[target.gameType] ?? ""} {MINIGAME_LABELS[target.gameType]}
        </span>
      </div>

      {/* Security bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[11px] mb-0.5">
          <span className="text-text-secondary">Security</span>
          <span className="text-text-muted">{securityPercent}% · {securityTier}</span>
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
          <span className="text-text-muted">Detect&lt;50:</span>{" "}
          <span className="text-cyber-red">{target.detectionChance}%</span>
        </div>
        <div>
          <span className="text-text-muted">Reward</span>{" "}
          <span className="text-text-muted/60" title="Final reward scales with your score">~est</span>
          <span className="text-text-muted">:</span>{" "}
          <ResourceCost
            costs={{
              credits: target.rewards.credits,
              data: target.rewards.data,
              reputation: target.rewards.reputation,
              xp: target.rewards.xp,
            }}
            size={10}
            prefix="+"
          />
        </div>
      </div>
    </button>
  );
}
