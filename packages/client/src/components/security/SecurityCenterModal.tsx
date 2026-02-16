import { Modal } from "@/components/Modal";
import { useUIStore } from "@/stores/ui";
import { useGameStore } from "@/stores/game";
import { api } from "@/lib/api";
import { MODULE_MAP, SYSTEM_LABELS, type SystemType } from "@singularities/shared";
import type { SecurityOverviewResponse } from "@singularities/shared";
import { useState, useEffect } from "react";
import { Shield, AlertTriangle, Activity } from "lucide-react";

type Tab = "defense" | "threats" | "status";

export function SecurityCenterModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const { ownedModules, setOwnedModules } = useGameStore();

  const [tab, setTab] = useState<Tab>("defense");
  const [overview, setOverview] = useState<SecurityOverviewResponse | null>(null);
  const [editSlots, setEditSlots] = useState<(string | null)[]>([null, null, null]);
  const [saving, setSaving] = useState(false);

  const open = activeModal === "security_center";

  useEffect(() => {
    if (open) {
      api.getSecurityOverview().then((r) => {
        setOverview(r);
        const slots = [1, 2, 3].map((s) => {
          const entry = r.defenseLoadout.find((l) => l.slot === s);
          return entry?.moduleId ?? null;
        });
        setEditSlots(slots);
      }).catch(() => {});
      api.getModules().then((r) => setOwnedModules(r.owned)).catch(() => {});
    }
  }, [open, setOwnedModules]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateLoadoutByType(
        "defense",
        editSlots as [string | null, string | null, string | null]
      );
    } catch (err: any) {
      console.error("Save failed:", err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSlotChange = (slotIndex: number, moduleId: string | null) => {
    const updated = [...editSlots];
    updated[slotIndex] = moduleId;
    setEditSlots(updated);
  };

  const STATUS_COLORS: Record<string, string> = {
    OPTIMAL: "text-cyber-green",
    DEGRADED: "text-cyber-yellow",
    CRITICAL: "text-cyber-red",
    CORRUPTED: "text-text-muted line-through",
  };

  return (
    <Modal open={open} onClose={closeModal} title="SECURITY CENTER">
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-border-default">
          <button
            onClick={() => setTab("defense")}
            className={`px-3 py-1.5 text-xs transition-colors ${
              tab === "defense" ? "text-cyber-cyan border-b border-cyber-cyan" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <Shield size={11} className="inline mr-1" />
            Defense Loadout
          </button>
          <button
            onClick={() => setTab("threats")}
            className={`px-3 py-1.5 text-xs transition-colors ${
              tab === "threats" ? "text-cyber-cyan border-b border-cyber-cyan" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <AlertTriangle size={11} className="inline mr-1" />
            Threat Monitor
          </button>
          <button
            onClick={() => setTab("status")}
            className={`px-3 py-1.5 text-xs transition-colors ${
              tab === "status" ? "text-cyber-cyan border-b border-cyber-cyan" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <Activity size={11} className="inline mr-1" />
            Status
          </button>
        </div>

        {/* Defense Tab */}
        {tab === "defense" && (
          <div className="space-y-3">
            <p className="text-text-secondary text-xs">
              Configure your defense loadout. These modules protect you from PvP attacks.
            </p>
            {[0, 1, 2].map((i) => {
              const selected = editSlots[i];
              const def = selected ? MODULE_MAP[selected] : null;
              const owned = selected ? ownedModules.find((m) => m.moduleId === selected) : null;

              return (
                <div key={i} className="border border-border-default bg-bg-secondary rounded p-3">
                  <div className="text-text-muted text-[10px] mb-1">DEFENSE SLOT {i + 1}</div>
                  <select
                    value={selected ?? ""}
                    onChange={(e) => handleSlotChange(i, e.target.value || null)}
                    className="w-full bg-bg-primary border border-border-default rounded px-2 py-1.5 text-xs text-text-primary"
                  >
                    <option value="">-- Empty --</option>
                    {ownedModules.map((m) => {
                      const d = MODULE_MAP[m.moduleId];
                      if (!d) return null;
                      return (
                        <option key={m.moduleId} value={m.moduleId}>
                          {d.name} (LV {m.level})
                        </option>
                      );
                    })}
                  </select>
                  {def && owned && (
                    <div className="mt-1 text-[10px] text-text-muted">
                      {def.description} — LV {owned.level}
                    </div>
                  )}
                </div>
              );
            })}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2 border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-30 text-sm"
            >
              {saving ? "Saving..." : "Save Defense"}
            </button>
          </div>
        )}

        {/* Threats Tab */}
        {tab === "threats" && (
          <div className="space-y-2">
            {!overview?.recentAttacks.length ? (
              <div className="text-center text-text-muted text-xs py-4">
                No incoming attacks recorded.
              </div>
            ) : (
              overview.recentAttacks.map((log) => (
                <div
                  key={log.id}
                  className={`border rounded p-2 text-xs ${
                    log.result === "defender_win"
                      ? "border-cyber-green/30 bg-cyber-green/5"
                      : "border-cyber-red/30 bg-cyber-red/5"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={log.result === "defender_win" ? "text-cyber-green" : "text-cyber-red"}>
                      {log.result === "defender_win" ? "REPELLED" : "BREACHED"}
                    </span>
                    <span className="text-text-muted text-[10px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Status Tab */}
        {tab === "status" && overview && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-text-muted">Heat Level:</span>
              <span className={overview.heatLevel >= 2 ? "text-cyber-red" : overview.heatLevel >= 1 ? "text-cyber-yellow" : "text-cyber-green"}>
                {overview.heatLevel}
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-text-muted text-[10px] uppercase tracking-wider">System Health</div>
              {overview.systemHealthSummary.map((sys) => (
                <div key={sys.systemType} className="flex items-center gap-2 text-xs">
                  <span className="text-text-secondary w-32">
                    {SYSTEM_LABELS[sys.systemType as SystemType] ?? sys.systemType}
                  </span>
                  <div className="flex-1 bg-bg-primary rounded-full h-1.5">
                    <div
                      className={`h-full rounded-full ${
                        sys.health >= 75 ? "bg-cyber-green" : sys.health >= 30 ? "bg-cyber-yellow" : sys.health > 0 ? "bg-cyber-red" : "bg-text-muted"
                      }`}
                      style={{ width: `${sys.health}%` }}
                    />
                  </div>
                  <span className={`w-12 text-right ${STATUS_COLORS[sys.status] ?? "text-text-muted"}`}>
                    {sys.health}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
