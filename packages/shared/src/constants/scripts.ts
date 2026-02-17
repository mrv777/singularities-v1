export interface ScriptTriggerDef {
  id: string;
  label: string;
  description: string;
}

export interface ScriptActionDef {
  id: string;
  label: string;
  description: string;
}

export const SCRIPT_TRIGGERS: ScriptTriggerDef[] = [
  { id: "energy_full", label: "Energy Full", description: "Triggers when energy reaches maximum." },
  { id: "energy_low", label: "Energy Low", description: "Triggers when energy drops below 20%." },
  { id: "system_critical", label: "System Critical", description: "Triggers when any system enters CRITICAL status." },
  { id: "heat_high", label: "Heat High", description: "Triggers when heat level reaches 2+." },
  { id: "credits_above_500", label: "Credits > 500", description: "Triggers when credits exceed 500." },
  { id: "idle_1h", label: "Idle 1 Hour", description: "Triggers after 1 hour of inactivity." },
];

export const SCRIPT_ACTIONS: ScriptActionDef[] = [
  { id: "auto_scan", label: "Auto Scan", description: "Automatically run a network scan." },
  { id: "auto_repair_worst", label: "Repair Worst System", description: "Repair the system with lowest health." },
  { id: "reduce_heat", label: "Lay Low", description: "Enter low-profile mode to reduce heat faster." },
];

export const SCRIPT_TRIGGER_MAP: Record<string, ScriptTriggerDef> = Object.fromEntries(
  SCRIPT_TRIGGERS.map((t) => [t.id, t])
);

export const SCRIPT_ACTION_MAP: Record<string, ScriptActionDef> = Object.fromEntries(
  SCRIPT_ACTIONS.map((a) => [a.id, a])
);

// Scripts operate at reduced efficiency compared to manual actions
export const SCRIPT_EFFICIENCY = 0.65;
// Scripts consume less energy but get less reward
export const SCRIPT_ENERGY_COST_MULTIPLIER = 0.5;
// Max active scripts per player
export const MAX_ACTIVE_SCRIPTS = 3;
// Max total scripts per player
export const MAX_SCRIPTS = 8;
