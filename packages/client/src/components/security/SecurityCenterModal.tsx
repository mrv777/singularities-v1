import { Modal } from "@/components/Modal";
import { useUIStore } from "@/stores/ui";
import { useGameStore } from "@/stores/game";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import { MODULE_MAP, HEAT_DAMAGE } from "@singularities/shared";
import type { SecurityOverviewResponse } from "@singularities/shared";
import { DefenseSlotPicker } from "./DefenseSlotPicker";
import { useState, useEffect } from "react";
import { Shield, AlertTriangle, BarChart3, Wrench } from "lucide-react";

type Tab = "defense" | "threats" | "overview";

export function SecurityCenterModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const openModal = useUIStore((s) => s.openModal);
  const player = useAuthStore((s) => s.player);
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

  return (
    <Modal open={open} onClose={closeModal} title="SECURITY CENTER">
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-border-default">
          <button
            onClick={() => setTab("defense")}
            className={`px-3 py-1.5 min-h-[44px] text-xs transition-colors ${
              tab === "defense" ? "text-cyber-cyan border-b border-cyber-cyan" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <Shield size={11} className="inline mr-1" />
            Defense Loadout
          </button>
          <button
            onClick={() => setTab("threats")}
            className={`px-3 py-1.5 min-h-[44px] text-xs transition-colors ${
              tab === "threats" ? "text-cyber-cyan border-b border-cyber-cyan" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <AlertTriangle size={11} className="inline mr-1" />
            Threat Monitor
          </button>
          <button
            onClick={() => setTab("overview")}
            className={`px-3 py-1.5 min-h-[44px] text-xs transition-colors ${
              tab === "overview" ? "text-cyber-cyan border-b border-cyber-cyan" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <BarChart3 size={11} className="inline mr-1" />
            Overview
          </button>
        </div>

        {/* Defense Tab */}
        {tab === "defense" && (
          <div className="space-y-3">
            <p className="text-text-secondary text-xs">
              Configure your defense loadout. These modules protect you from PvP attacks.
            </p>
            {[0, 1, 2].map((i) => (
              <DefenseSlotPicker
                key={i}
                slotIndex={i}
                selectedModuleId={editSlots[i]}
                ownedModules={ownedModules}
                onChange={(moduleId) => handleSlotChange(i, moduleId)}
              />
            ))}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2 min-h-[44px] border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-30 text-sm"
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

        {/* Overview Tab */}
        {tab === "overview" && overview && (
          <div className="space-y-4">
            {/* Heat Level Gauge */}
            <div className="border border-border-default bg-bg-secondary rounded p-3">
              <div className="text-text-muted text-[10px] uppercase tracking-wider mb-2">HEAT LEVEL</div>
              <div className="flex gap-1 mb-2 h-3 rounded overflow-hidden">
                <div className={`flex-1 rounded-l ${overview.heatLevel === 0 ? "bg-cyber-green" : "bg-cyber-green/20"}`} />
                <div className={`flex-1 ${overview.heatLevel === 1 ? "bg-cyber-amber" : "bg-cyber-amber/20"}`} />
                <div className={`flex-1 rounded-r ${overview.heatLevel >= 2 ? "bg-cyber-red" : "bg-cyber-red/20"}`} />
              </div>
              <div className={`text-[10px] ${overview.heatLevel >= 2 ? "text-cyber-red" : overview.heatLevel >= 1 ? "text-cyber-amber" : "text-cyber-green"}`}>
                {overview.heatLevel === 0
                  ? "Low Profile — Minimal detection risk"
                  : overview.heatLevel === 1
                    ? `On Radar — Moderate damage to ${HEAT_DAMAGE[1].systemsAffected} systems`
                    : `Hunted — Heavy damage to ${HEAT_DAMAGE[2].systemsAffected} systems, cooldown penalty`}
              </div>
            </div>

            {/* Defense Power Summary */}
            <div className="border border-border-default bg-bg-secondary rounded p-3">
              <div className="text-text-muted text-[10px] uppercase tracking-wider mb-2">DEFENSE POWER</div>
              {(() => {
                const totals: Record<string, number> = {};
                editSlots.forEach((slotId) => {
                  if (!slotId) return;
                  const def = MODULE_MAP[slotId];
                  const owned = ownedModules.find((m) => m.moduleId === slotId);
                  if (!def || !owned) return;
                  for (const [k, v] of Object.entries(def.effects)) {
                    if (v) totals[k] = (totals[k] ?? 0) + v * owned.level;
                  }
                });
                const entries = Object.entries(totals);
                if (entries.length === 0) {
                  return <div className="text-text-muted text-xs">No modules equipped</div>;
                }
                return (
                  <div className="space-y-1">
                    {entries.map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-text-secondary capitalize">{key}</span>
                        <span className="text-cyber-cyan font-mono">
                          {val > 0 ? "+" : ""}{val}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Security Score */}
            <div className="border border-border-default bg-bg-secondary rounded p-3">
              <div className="text-text-muted text-[10px] uppercase tracking-wider mb-2">SECURITY SCORE</div>
              {(() => {
                const avgHealth = overview.systemHealthSummary.length > 0
                  ? overview.systemHealthSummary.reduce((sum, s) => sum + s.health, 0) / overview.systemHealthSummary.length
                  : 100;
                const healthScore = avgHealth; // 0-100
                const heatScore = overview.heatLevel === 0 ? 100 : overview.heatLevel === 1 ? 50 : 0;
                const filledSlots = editSlots.filter(Boolean).length;
                const slotScore = filledSlots === 3 ? 100 : filledSlots === 2 ? 66 : filledSlots === 1 ? 33 : 0;
                const totalAttacks = overview.recentAttacks.length;
                const wins = overview.recentAttacks.filter((a) => a.result === "defender_win").length;
                const winRate = totalAttacks > 0 ? (wins / totalAttacks) * 100 : 50;

                const score = Math.round(
                  healthScore * 0.3 + heatScore * 0.2 + slotScore * 0.3 + winRate * 0.2
                );
                const color = score >= 70 ? "text-cyber-green" : score >= 40 ? "text-cyber-amber" : "text-cyber-red";
                const borderColor = score >= 70 ? "border-cyber-green/30" : score >= 40 ? "border-cyber-amber/30" : "border-cyber-red/30";

                return (
                  <div className="flex items-center gap-4">
                    <div className={`text-3xl font-bold font-mono ${color}`}>{score}</div>
                    <div className="flex-1 space-y-1 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-text-muted">System Health</span>
                        <span className="text-text-secondary">{Math.round(avgHealth)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Heat Level</span>
                        <span className="text-text-secondary">{overview.heatLevel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Defense Slots</span>
                        <span className="text-text-secondary">{filledSlots}/3</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Win Rate</span>
                        <span className="text-text-secondary">{totalAttacks > 0 ? Math.round(winRate) : "—"}%</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Quick Link */}
            <button
              onClick={() => {
                closeModal();
                setTimeout(() => openModal("system_maintenance"), 150);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 min-h-[44px] border border-border-default text-text-secondary rounded hover:border-cyber-cyan hover:text-cyber-cyan transition-colors text-xs"
            >
              <Wrench size={12} />
              Open System Maintenance
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
