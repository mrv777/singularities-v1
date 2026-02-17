import type { PlayerSystem } from "@singularities/shared";
import { SYSTEM_LABELS, SYSTEM_ADJACENCY, SYSTEM_DESCRIPTIONS } from "@singularities/shared";
import type { SystemType } from "@singularities/shared";
import { Wrench, AlertTriangle } from "lucide-react";
import { ResourceCost } from "../ui/ResourceCost";

interface SystemCardProps {
  system: PlayerSystem;
  onRepair: (systemType: string) => void;
  repairing: boolean;
  repairCreditCost: number;
}

const STATUS_COLORS: Record<string, { bar: string; badge: string; text: string }> = {
  OPTIMAL: { bar: "bg-cyber-green", badge: "bg-cyber-green/10 text-cyber-green border-cyber-green/30", text: "text-cyber-green" },
  DEGRADED: { bar: "bg-cyber-amber", badge: "bg-cyber-amber/10 text-cyber-amber border-cyber-amber/30", text: "text-cyber-amber" },
  CRITICAL: { bar: "bg-cyber-red", badge: "bg-cyber-red/10 text-cyber-red border-cyber-red/30", text: "text-cyber-red" },
  CORRUPTED: { bar: "bg-cyber-magenta", badge: "bg-cyber-magenta/10 text-cyber-magenta border-cyber-magenta/30", text: "text-cyber-magenta" },
};

export function SystemCard({ system, onRepair, repairing, repairCreditCost }: SystemCardProps) {
  const label = SYSTEM_LABELS[system.systemType as SystemType] ?? system.systemType;
  const description = SYSTEM_DESCRIPTIONS[system.systemType as SystemType] ?? "";
  const adjacent = SYSTEM_ADJACENCY[system.systemType as SystemType] ?? [];
  const colors = STATUS_COLORS[system.status] ?? STATUS_COLORS.OPTIMAL;
  const isCritical = system.status === "CRITICAL" || system.status === "CORRUPTED";

  return (
    <div
      className={`border rounded-lg p-3 bg-bg-elevated ${
        isCritical ? "border-cyber-red/50" : "border-border-default"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-text-primary text-xs font-semibold">{label}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${colors.badge}`}>
            {system.status}
          </span>
        </div>
        <span className={`text-xs font-mono ${colors.text}`}>{system.health}%</span>
      </div>

      {/* Health bar */}
      <div className="w-full h-1.5 bg-bg-primary rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all ${colors.bar}`}
          style={{ width: `${system.health}%` }}
        />
      </div>

      <p className="text-text-muted text-[10px] mb-2">{description}</p>

      {/* Adjacency */}
      <div className="text-[9px] text-text-muted mb-2">
        Adjacent:{" "}
        {adjacent.map((a) => SYSTEM_LABELS[a] ?? a).join(", ")}
      </div>

      {/* Cascade warning */}
      {isCritical && (
        <div className="flex items-center gap-1 text-[10px] text-cyber-red mb-2">
          <AlertTriangle size={10} />
          <span>Cascade damage active — adjacent systems at risk</span>
        </div>
      )}

      {/* Repair button */}
      <button
        onClick={() => onRepair(system.systemType)}
        disabled={repairing || system.health >= 100}
        className="w-full flex items-center justify-center gap-1 py-1.5 min-h-[44px] text-[10px] border border-cyber-cyan/30 text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Wrench size={10} />
        {repairing ? "Repairing..." : system.health >= 100 ? "Full Health" : <>Repair <ResourceCost costs={{ credits: repairCreditCost }} size={10} /></>}
      </button>
    </div>
  );
}
