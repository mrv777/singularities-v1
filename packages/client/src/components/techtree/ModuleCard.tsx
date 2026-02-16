import type { ModuleDefinition, PlayerModule } from "@singularities/shared";
import { MAX_MODULE_LEVEL } from "@singularities/shared";

interface ModuleCardProps {
  definition: ModuleDefinition;
  owned?: PlayerModule;
  canPurchase: boolean;
  isLocked: boolean;
  lockReason?: string;
  onPurchase: () => void;
  isProcessing: boolean;
}

export function ModuleCard({
  definition,
  owned,
  canPurchase,
  isLocked,
  lockReason,
  onPurchase,
  isProcessing,
}: ModuleCardProps) {
  const currentLevel = owned?.level ?? 0;
  const isMaxLevel = currentLevel >= MAX_MODULE_LEVEL;
  const isOwned = currentLevel > 0;

  const cost = isOwned
    ? {
        credits:
          definition.baseCost.credits +
          definition.costPerLevel.credits * currentLevel,
        data:
          definition.baseCost.data +
          definition.costPerLevel.data * currentLevel,
      }
    : definition.baseCost;

  return (
    <div
      className={`border rounded p-3 transition-all ${
        isLocked
          ? "border-border-default bg-bg-primary opacity-40"
          : isOwned
            ? "border-cyber-cyan/30 bg-bg-elevated"
            : "border-border-default bg-bg-secondary hover:border-border-bright"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-text-primary truncate">
          {definition.name}
        </span>
      </div>

      {/* Level dots */}
      <div className="flex gap-1 mb-2">
        {Array.from({ length: MAX_MODULE_LEVEL }, (_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${
              i < currentLevel ? "bg-cyber-cyan" : "bg-border-default"
            }`}
          />
        ))}
      </div>

      <p className="text-text-muted text-[10px] mb-2 line-clamp-2">
        {definition.description}
      </p>

      {/* Effects */}
      <div className="flex flex-wrap gap-1 mb-2">
        {Object.entries(definition.effects).map(([key, val]) =>
          val ? (
            <span
              key={key}
              className="text-[9px] px-1 py-0.5 bg-bg-primary rounded text-text-secondary"
            >
              {key}: {val > 0 ? "+" : ""}{val}/lv
            </span>
          ) : null
        )}
      </div>

      {/* Action */}
      {isLocked ? (
        <div className="text-[10px] text-text-muted">{lockReason}</div>
      ) : isMaxLevel ? (
        <div className="text-[10px] text-cyber-cyan">MAX LEVEL</div>
      ) : (
        <button
          onClick={onPurchase}
          disabled={!canPurchase || isProcessing}
          className="w-full text-[10px] py-1.5 border border-cyber-cyan/50 text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isProcessing
            ? "..."
            : isOwned
              ? `Upgrade LV${currentLevel + 1} (${cost.credits}CR ${cost.data}D)`
              : `Purchase (${cost.credits}CR ${cost.data}D)`}
        </button>
      )}
    </div>
  );
}
