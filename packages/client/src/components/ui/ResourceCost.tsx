import { Coins, Zap, Database, Cpu, Star, Trophy } from "lucide-react";
import type { ReactNode } from "react";

type ResourceType = "credits" | "energy" | "data" | "processingPower" | "reputation" | "xp";

const RESOURCE_CONFIG: Record<ResourceType, { icon: (size: number) => ReactNode; color: string }> = {
  credits:         { icon: (s) => <Coins size={s} />,    color: "text-cyber-amber" },
  energy:          { icon: (s) => <Zap size={s} />,      color: "text-cyber-cyan" },
  data:            { icon: (s) => <Database size={s} />,  color: "text-cyber-green" },
  processingPower: { icon: (s) => <Cpu size={s} />,       color: "text-cyber-magenta" },
  reputation:      { icon: (s) => <Star size={s} />,      color: "text-text-secondary" },
  xp:              { icon: (s) => <Trophy size={s} />,     color: "text-cyber-cyan" },
};

interface ResourceCostProps {
  costs: Partial<Record<ResourceType, number>>;
  size?: number;
  prefix?: string;
  className?: string;
  available?: Partial<Record<ResourceType, number>>;
  baseCosts?: Partial<Record<ResourceType, number>>;
}

export function ResourceCost({
  costs,
  size = 10,
  prefix,
  className = "",
  available,
  baseCosts,
}: ResourceCostProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {(Object.entries(costs) as [ResourceType, number][]).map(([key, amount]) => {
        if (!amount) return null;
        const cfg = RESOURCE_CONFIG[key];
        if (!cfg) return null;
        const insufficient = available && (available[key] ?? 0) < amount;
        const baseAmount = baseCosts?.[key];
        const hasModifier = baseAmount !== undefined && baseAmount !== amount;
        return (
          <span
            key={key}
            className={`inline-flex items-center gap-0.5 ${insufficient ? "text-cyber-red opacity-80" : hasModifier ? "" : cfg.color}`}
          >
            {cfg.icon(size)}
            {hasModifier ? (
              <>
                <span className="text-[10px] font-mono font-bold leading-none line-through opacity-50 text-text-muted">
                  {prefix}{baseAmount}
                </span>
                <span className={`text-[10px] font-mono font-bold leading-none ${
                  insufficient ? "text-cyber-red" : amount < baseAmount! ? "text-cyber-green" : "text-cyber-red"
                }`}>
                  {prefix}{amount}
                </span>
              </>
            ) : (
              <span className="text-[10px] font-mono font-bold leading-none">
                {prefix}{amount}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
