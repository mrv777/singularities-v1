import { MODULE_MAP, type PlayerModule } from "@singularities/shared";
import { ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface ModuleSlotPickerProps {
  slotIndex: number;
  selectedModuleId: string | null;
  ownedModules: PlayerModule[];
  onChange: (moduleId: string | null) => void;
  label?: string;
}

export function ModuleSlotPicker({
  slotIndex,
  selectedModuleId,
  ownedModules,
  onChange,
  label = "SLOT",
}: ModuleSlotPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedDef = selectedModuleId ? MODULE_MAP[selectedModuleId] : null;
  const selectedOwned = selectedModuleId
    ? ownedModules.find((m) => m.moduleId === selectedModuleId)
    : null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="border border-border-default bg-bg-secondary rounded p-3">
      <div className="text-text-muted text-[10px] mb-1.5 uppercase tracking-wider">
        {label} {slotIndex + 1}
      </div>

      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-bg-primary border border-border-default rounded px-3 py-2 min-h-[44px] text-xs text-left hover:border-border-bright transition-colors"
      >
        {selectedDef && selectedOwned ? (
          <span className="flex items-center gap-2">
            <span className="text-text-primary font-semibold">{selectedDef.name}</span>
            <span className="text-text-muted text-[10px]">LV {selectedOwned.level}</span>
            {selectedOwned.mutation && (
              <span className="text-[9px] px-1 py-0.5 bg-cyber-magenta/10 border border-cyber-magenta/30 rounded text-cyber-magenta">
                {selectedOwned.mutation}
              </span>
            )}
          </span>
        ) : (
          <span className="text-text-muted">-- Empty --</span>
        )}
        <ChevronDown
          size={14}
          className={`text-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Selected module stat effects */}
      {selectedDef && selectedOwned && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {(Object.entries(selectedDef.effects) as [string, number | undefined][]).map(
            ([key, val]) =>
              val ? (
                <span
                  key={key}
                  className="text-[9px] px-1.5 py-0.5 bg-bg-primary rounded text-text-secondary border border-border-default"
                >
                  {key}: <span className="text-cyber-cyan">{val > 0 ? "+" : ""}{val}/lv</span>
                  <span className="text-text-muted ml-0.5">
                    (total: {val > 0 ? "+" : ""}{val * selectedOwned.level})
                  </span>
                </span>
              ) : null
          )}
        </div>
      )}

      {/* Dropdown list */}
      {isOpen && (
        <div className="mt-2 border border-border-bright bg-bg-elevated rounded overflow-hidden max-h-48 overflow-y-auto">
          {/* Empty option */}
          <button
            onClick={() => {
              onChange(null);
              setIsOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-bg-surface transition-colors ${
              !selectedModuleId ? "bg-bg-surface" : ""
            }`}
          >
            {!selectedModuleId && <Check size={12} className="text-cyber-cyan" />}
            <span className={`${!selectedModuleId ? "text-cyber-cyan" : "text-text-muted"} ${selectedModuleId ? "ml-5" : ""}`}>
              -- Empty --
            </span>
          </button>

          {ownedModules.map((m) => {
            const d = MODULE_MAP[m.moduleId];
            if (!d) return null;
            const isSelected = selectedModuleId === m.moduleId;

            return (
              <button
                key={m.moduleId}
                onClick={() => {
                  onChange(m.moduleId);
                  setIsOpen(false);
                }}
                className={`w-full flex items-start gap-2 px-3 py-2 text-xs text-left hover:bg-bg-surface transition-colors border-t border-border-default ${
                  isSelected ? "bg-bg-surface" : ""
                }`}
              >
                {isSelected ? (
                  <Check size={12} className="text-cyber-cyan mt-0.5 shrink-0" />
                ) : (
                  <div className="w-3 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${isSelected ? "text-cyber-cyan" : "text-text-primary"}`}>
                      {d.name}
                    </span>
                    <span className="text-text-muted text-[10px]">LV {m.level}</span>
                    {m.mutation && (
                      <span className="text-[9px] px-1 py-0.5 bg-cyber-magenta/10 border border-cyber-magenta/30 rounded text-cyber-magenta">
                        {m.mutation}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(Object.entries(d.effects) as [string, number | undefined][]).map(
                      ([key, val]) =>
                        val ? (
                          <span key={key} className="text-[9px] text-text-muted">
                            {key}: {val > 0 ? "+" : ""}{val * m.level}
                          </span>
                        ) : null
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
