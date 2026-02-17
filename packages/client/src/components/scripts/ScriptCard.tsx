import type { PlayerScript } from "@singularities/shared";
import { SCRIPT_TRIGGER_MAP, SCRIPT_ACTION_MAP } from "@singularities/shared";
import { Power, Trash2 } from "lucide-react";
import { CyberTooltip } from "../ui/CyberTooltip";

interface ScriptCardProps {
  script: PlayerScript;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  toggling: boolean;
  deleting: boolean;
}

export function ScriptCard({ script, onToggle, onDelete, toggling, deleting }: ScriptCardProps) {
  const trigger = SCRIPT_TRIGGER_MAP[script.triggerCondition];
  const action = SCRIPT_ACTION_MAP[script.action];

  return (
    <div
      className={`border rounded-lg p-3 bg-bg-elevated ${
        script.isActive ? "border-cyber-green/30" : "border-border-default"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              script.isActive ? "bg-cyber-green animate-pulse" : "bg-text-muted"
            }`}
          />
          <span className="text-text-primary text-xs font-semibold">
            {trigger?.label ?? script.triggerCondition}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <CyberTooltip content={script.isActive ? "Deactivate" : "Activate"}>
            <button
              onClick={() => onToggle(script.id)}
              disabled={toggling}
              className={`p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded transition-colors ${
                script.isActive
                  ? "text-cyber-green hover:text-cyber-green/70"
                  : "text-text-muted hover:text-cyber-cyan"
              }`}
            >
              <Power size={14} />
            </button>
          </CyberTooltip>
          <CyberTooltip content="Delete script">
            <button
              onClick={() => onDelete(script.id)}
              disabled={deleting}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-text-muted hover:text-cyber-red transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </CyberTooltip>
        </div>
      </div>

      <div className="space-y-1 text-[10px]">
        <div className="flex items-center gap-1">
          <span className="text-text-muted">WHEN:</span>
          <span className="text-cyber-amber">{trigger?.description ?? script.triggerCondition}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-text-muted">THEN:</span>
          <span className="text-cyber-cyan">{action?.description ?? script.action}</span>
        </div>
      </div>
    </div>
  );
}
