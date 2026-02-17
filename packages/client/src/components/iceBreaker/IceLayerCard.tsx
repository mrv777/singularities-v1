import { Shield, Eye, Zap, Check, X } from "lucide-react";
import type { IceLayerType } from "@singularities/shared";

const LAYER_CONFIG: Record<IceLayerType, { icon: typeof Shield; color: string; label: string; stat: string }> = {
  FIREWALL: { icon: Shield, color: "text-cyber-red", label: "Firewall", stat: "Hack Power" },
  TRACER: { icon: Eye, color: "text-cyber-amber", label: "Tracer", stat: "Stealth" },
  BLACK_ICE: { icon: Zap, color: "text-cyber-magenta", label: "Black ICE", stat: "Defense" },
};

interface IceLayerCardProps {
  type: IceLayerType;
  depth: number;
  threshold: number;
  state: "pending" | "current" | "passed" | "failed";
}

export function IceLayerCard({ type, depth, threshold, state }: IceLayerCardProps) {
  const config = LAYER_CONFIG[type];
  const Icon = config.icon;

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded border transition-colors ${
        state === "current"
          ? "border-cyber-cyan bg-cyber-cyan/5"
          : state === "passed"
            ? "border-cyber-green/40 bg-cyber-green/5"
            : state === "failed"
              ? "border-cyber-red/40 bg-cyber-red/5"
              : "border-border-default bg-bg-surface opacity-60"
      }`}
    >
      <div className={`${config.color} ${state === "pending" ? "opacity-40" : ""}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-text-primary">
            Layer {depth + 1}: {config.label}
          </span>
          {state === "passed" && <Check size={12} className="text-cyber-green" />}
          {state === "failed" && <X size={12} className="text-cyber-red" />}
        </div>
        <div className="text-[10px] text-text-muted">
          {config.stat} check — Threshold: {threshold}
        </div>
      </div>
    </div>
  );
}
