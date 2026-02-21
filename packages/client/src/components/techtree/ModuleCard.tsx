import type { ModuleDefinition, PlayerModule } from "@singularities/shared";
import { MAX_MODULE_LEVEL, MUTATION_COST, MUTATION_VARIANT_MAP, MUTATION_ELIGIBLE_TIERS } from "@singularities/shared";
import { ResourceCost } from "../ui/ResourceCost";

interface ModuleCardProps {
  definition: ModuleDefinition;
  owned?: PlayerModule;
  canPurchase: boolean;
  isLocked: boolean;
  lockReason?: string;
  onPurchase: (el: HTMLButtonElement) => void;
  onMutate?: () => void;
  isProcessing: boolean;
  isMutating?: boolean;
  playerResources?: { credits: number; data: number; processingPower: number };
}

export function ModuleCard({
  definition,
  owned,
  canPurchase,
  isLocked,
  lockReason,
  onPurchase,
  onMutate,
  isProcessing,
  isMutating,
  playerResources,
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
          : owned?.mutation
            ? "border-cyber-magenta/40 bg-bg-elevated"
            : isOwned
              ? "border-cyber-cyan/30 bg-bg-elevated"
              : "border-border-default bg-bg-secondary hover:border-border-bright"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-text-primary truncate">
          {definition.name}
        </span>
        {owned?.mutation && (
          <span className="text-[9px] px-1.5 py-0.5 bg-cyber-magenta/10 border border-cyber-magenta/30 rounded text-cyber-magenta">
            {MUTATION_VARIANT_MAP[owned.mutation]?.name ?? owned.mutation}
          </span>
        )}
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
          onClick={(e) => onPurchase(e.currentTarget)}
          disabled={!canPurchase || isProcessing}
          className="w-full text-[10px] py-1.5 min-h-[44px] border border-cyber-cyan/50 text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {isProcessing
            ? "..."
            : <>
                {isOwned ? `Upgrade LV${currentLevel + 1}` : "Purchase"}
                <ResourceCost costs={cost} available={playerResources} />
              </>}
        </button>
      )}

      {/* Mutate button — only at max level, advanced+ tiers */}
      {isOwned && !owned?.mutation && isMaxLevel && onMutate && MUTATION_ELIGIBLE_TIERS.includes(definition.tier as "advanced" | "elite") && (
        <button
          onClick={onMutate}
          disabled={isMutating}
          className="w-full mt-1 text-[10px] py-1.5 min-h-[44px] border border-cyber-magenta/50 text-cyber-magenta rounded hover:bg-cyber-magenta/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {isMutating ? "Mutating..." : <>MUTATE <ResourceCost costs={MUTATION_COST} available={playerResources} /></>}
        </button>
      )}
    </div>
  );
}
