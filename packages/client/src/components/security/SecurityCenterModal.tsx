import { Modal } from "@/components/Modal";
import { useUIStore } from "@/stores/ui";
import { useGameStore } from "@/stores/game";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import {
  MODULE_MAP,
  HEAT_DAMAGE,
  DIVERSITY_BONUS,
  LEVEL_UNLOCKS,
} from "@singularities/shared";
import type {
  SecurityOverviewResponse,
  LoadoutType,
  PlayerLoadout,
} from "@singularities/shared";
import { ModuleSlotPicker } from "@/components/loadout/ModuleSlotPicker";
import { useTutorialStore } from "@/stores/tutorial";
import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  AlertTriangle,
  BarChart3,
  Wrench,
  Crosshair,
  Lock,
  Layers,
} from "lucide-react";

type Tab = "loadouts" | "threats" | "overview";

const LOADOUT_DESCRIPTIONS: Record<LoadoutType, string> = {
  infiltration:
    "Modules equipped here boost your hacking power, stealth, and rewards during Scanner operations and ICE Breaker runs.",
  attack:
    "Modules equipped here determine your offensive power in PvP Arena combat.",
  defense:
    "Modules equipped here protect you when other players attack you in the Arena.",
};

const LOADOUT_LABELS: Record<LoadoutType, string> = {
  infiltration: "Infiltration",
  attack: "Attack",
  defense: "Defense",
};

export function SecurityCenterModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const openModal = useUIStore((s) => s.openModal);
  const player = useAuthStore((s) => s.player);
  const { ownedModules, setOwnedModules, setLoadout } = useGameStore();

  const [tab, setTab] = useState<Tab>("loadouts");
  const [loadoutType, setLoadoutType] = useState<LoadoutType>("infiltration");
  const [slots, setSlots] = useState<Record<LoadoutType, (string | null)[]>>({
    infiltration: [null, null, null],
    attack: [null, null, null],
    defense: [null, null, null],
  });
  const [loadedTypes, setLoadedTypes] = useState<Set<LoadoutType>>(new Set());
  const [saving, setSaving] = useState(false);
  const [overview, setOverview] = useState<SecurityOverviewResponse | null>(
    null,
  );

  const tutorialStep = useTutorialStore((s) => s.step);
  const advanceTutorial = useTutorialStore((s) => s.advanceStep);

  const open = activeModal === "security_center";
  const pvpLevel = LEVEL_UNLOCKS.pvp_arena;
  const playerLevel = player?.level ?? 1;
  const isPvpUnlocked = playerLevel >= pvpLevel;

  const slotsToLoadout = (
    type: LoadoutType,
    raw: PlayerLoadout[],
  ): (string | null)[] => {
    return [1, 2, 3].map((s) => {
      const entry = raw.find((l) => l.slot === s);
      return entry?.moduleId ?? null;
    });
  };

  const fetchLoadoutType = useCallback(
    async (type: LoadoutType) => {
      try {
        const r = await api.getLoadoutsByType(type);
        setSlots((prev) => ({
          ...prev,
          [type]: slotsToLoadout(type, r.loadout),
        }));
        setLoadedTypes((prev) => new Set(prev).add(type));
        if (type === "infiltration") {
          setLoadout(r.loadout);
        }
      } catch {
        /* ignore */
      }
    },
    [setLoadout],
  );

  // On open: fetch overview, modules, and current loadout type
  useEffect(() => {
    if (open) {
      api
        .getSecurityOverview()
        .then((r) => setOverview(r))
        .catch(() => {});
      api
        .getModules()
        .then((r) => setOwnedModules(r.owned))
        .catch(() => {});
      fetchLoadoutType(loadoutType);
    } else {
      // Reset on close
      setLoadedTypes(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fetch loadout when type changes (if not already loaded)
  useEffect(() => {
    if (open && !loadedTypes.has(loadoutType)) {
      fetchLoadoutType(loadoutType);
    }
  }, [open, loadoutType, loadedTypes, fetchLoadoutType]);

  const handleSlotChange = (slotIndex: number, moduleId: string | null) => {
    setSlots((prev) => {
      const updated = [...prev[loadoutType]];
      updated[slotIndex] = moduleId;
      return { ...prev, [loadoutType]: updated };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await api.updateLoadoutByType(
        loadoutType,
        slots[loadoutType] as [string | null, string | null, string | null],
      );
      if (loadoutType === "infiltration") {
        setLoadout(result.loadout);
      }
      // Advance tutorial if player saved a non-empty loadout
      if (tutorialStep === "equip" && slots[loadoutType].some(Boolean)) {
        advanceTutorial();
      }
    } catch (err: any) {
      console.error("Save failed:", err.message);
    } finally {
      setSaving(false);
    }
  };

  // Compute stat totals for current loadout type
  const computeStats = () => {
    const currentSlots = slots[loadoutType];
    const totals: Record<string, number> = {};
    const categories = new Set<string>();

    currentSlots.forEach((slotId) => {
      if (!slotId) return;
      const def = MODULE_MAP[slotId];
      const owned = ownedModules.find((m) => m.moduleId === slotId);
      if (!def || !owned) return;
      categories.add(def.category);
      for (const [k, v] of Object.entries(def.effects)) {
        if (v) totals[k] = (totals[k] ?? 0) + v * owned.level;
      }
    });

    const categoryCount = categories.size;
    const diversityBonus = DIVERSITY_BONUS[categoryCount] ?? 0;
    return { totals, categoryCount, diversityBonus };
  };

  const isLockedType = (type: LoadoutType) =>
    type !== "infiltration" && !isPvpUnlocked;

  return (
    <Modal open={open} onClose={closeModal} title="SECURITY CENTER">
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-border-default">
          <button
            onClick={() => setTab("loadouts")}
            className={`px-3 py-1.5 min-h-[44px] text-xs transition-colors ${
              tab === "loadouts"
                ? "text-cyber-cyan border-b border-cyber-cyan"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <Layers size={11} className="inline mr-1" />
            Loadouts
          </button>
          {isPvpUnlocked && (
            <button
              onClick={() => setTab("threats")}
              className={`px-3 py-1.5 min-h-[44px] text-xs transition-colors ${
                tab === "threats"
                  ? "text-cyber-cyan border-b border-cyber-cyan"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <AlertTriangle size={11} className="inline mr-1" />
              Threats
            </button>
          )}
          <button
            onClick={() => setTab("overview")}
            className={`px-3 py-1.5 min-h-[44px] text-xs transition-colors ${
              tab === "overview"
                ? "text-cyber-cyan border-b border-cyber-cyan"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <BarChart3 size={11} className="inline mr-1" />
            Overview
          </button>
        </div>

        {/* Loadouts Tab */}
        {tab === "loadouts" && (
          <div className="space-y-3">
            {/* Loadout type selector */}
            <div className="flex gap-1 bg-bg-secondary rounded p-1">
              {(["infiltration", "attack", "defense"] as LoadoutType[]).map(
                (type) => {
                  const locked = isLockedType(type);
                  return (
                    <button
                      key={type}
                      onClick={() => !locked && setLoadoutType(type)}
                      disabled={locked}
                      className={`flex-1 py-1.5 min-h-[36px] text-xs rounded transition-colors flex items-center justify-center gap-1 ${
                        loadoutType === type
                          ? "bg-bg-primary text-cyber-cyan border border-cyber-cyan/30"
                          : locked
                            ? "text-text-muted cursor-not-allowed opacity-50"
                            : "text-text-secondary hover:text-text-primary hover:bg-bg-primary/50"
                      }`}
                    >
                      {type === "infiltration" && (
                        <Crosshair size={11} />
                      )}
                      {type === "attack" && (
                        locked ? <Lock size={11} /> : <Crosshair size={11} />
                      )}
                      {type === "defense" && (
                        locked ? <Lock size={11} /> : <Shield size={11} />
                      )}
                      {LOADOUT_LABELS[type]}
                    </button>
                  );
                },
              )}
            </div>

            {/* Locked type message */}
            {isLockedType(loadoutType) ? (
              <div className="text-center py-8 text-text-muted text-xs">
                <Lock size={20} className="mx-auto mb-2 opacity-50" />
                Unlocks with PvP Arena (Level {pvpLevel})
              </div>
            ) : (
              <>
                {/* Description */}
                <p className="text-text-secondary text-xs">
                  {LOADOUT_DESCRIPTIONS[loadoutType]}
                </p>

                {/* Module slots */}
                {[0, 1, 2].map((i) => {
                  const disabledModuleIds = new Set(
                    slots[loadoutType].filter(
                      (id, j) => j !== i && id != null,
                    ) as string[],
                  );
                  return (
                    <ModuleSlotPicker
                      key={`${loadoutType}-${i}`}
                      slotIndex={i}
                      selectedModuleId={slots[loadoutType][i]}
                      ownedModules={ownedModules}
                      onChange={(moduleId) => handleSlotChange(i, moduleId)}
                      label={`${LOADOUT_LABELS[loadoutType].toUpperCase()} SLOT`}
                      disabledModuleIds={disabledModuleIds}
                    />
                  );
                })}

                {/* Stat summary */}
                {(() => {
                  const { totals, categoryCount, diversityBonus } =
                    computeStats();
                  const entries = Object.entries(totals);
                  if (entries.length === 0 && categoryCount === 0) return null;
                  return (
                    <div className="border border-border-default bg-bg-secondary rounded p-3">
                      <div className="text-text-muted text-[10px] uppercase tracking-wider mb-2">
                        LOADOUT POWER
                      </div>
                      {entries.length > 0 ? (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {entries.map(([key, val]) => (
                            <div
                              key={key}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-text-secondary capitalize">
                                {key}
                              </span>
                              <span className="text-cyber-cyan font-mono">
                                {val > 0 ? "+" : ""}
                                {val}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-text-muted text-xs">
                          No modules equipped
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-border-default">
                        <span className="text-text-muted">
                          Categories: {categoryCount}
                        </span>
                        <span
                          className={`font-mono ${diversityBonus > 0 ? "text-cyber-green" : "text-text-muted"}`}
                        >
                          Diversity: +{diversityBonus}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Save button */}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-2 min-h-[44px] border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-30 text-sm"
                >
                  {saving
                    ? "Saving..."
                    : `Save ${LOADOUT_LABELS[loadoutType]}`}
                </button>
              </>
            )}
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
                    <span
                      className={
                        log.result === "defender_win"
                          ? "text-cyber-green"
                          : "text-cyber-red"
                      }
                    >
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
              <div className="text-text-muted text-[10px] uppercase tracking-wider mb-2">
                HEAT LEVEL
              </div>
              <div className="flex gap-1 mb-2 h-3 rounded overflow-hidden">
                <div
                  className={`flex-1 rounded-l ${overview.heatLevel === 0 ? "bg-cyber-green" : "bg-cyber-green/20"}`}
                />
                <div
                  className={`flex-1 ${overview.heatLevel === 1 ? "bg-cyber-amber" : "bg-cyber-amber/20"}`}
                />
                <div
                  className={`flex-1 rounded-r ${overview.heatLevel >= 2 ? "bg-cyber-red" : "bg-cyber-red/20"}`}
                />
              </div>
              <div
                className={`text-[10px] ${overview.heatLevel >= 2 ? "text-cyber-red" : overview.heatLevel >= 1 ? "text-cyber-amber" : "text-cyber-green"}`}
              >
                {overview.heatLevel === 0
                  ? "Low Profile — Minimal detection risk"
                  : overview.heatLevel === 1
                    ? `On Radar — Moderate damage to ${HEAT_DAMAGE[1].systemsAffected} systems`
                    : `Hunted — Heavy damage to ${HEAT_DAMAGE[2].systemsAffected} systems, cooldown penalty`}
              </div>
            </div>

            {/* Security Score */}
            <div className="border border-border-default bg-bg-secondary rounded p-3">
              <div className="text-text-muted text-[10px] uppercase tracking-wider mb-2">
                SECURITY SCORE
              </div>
              {(() => {
                const avgHealth =
                  overview.systemHealthSummary.length > 0
                    ? overview.systemHealthSummary.reduce(
                        (sum, s) => sum + s.health,
                        0,
                      ) / overview.systemHealthSummary.length
                    : 100;
                const healthScore = avgHealth;
                const heatScore =
                  overview.heatLevel === 0
                    ? 100
                    : overview.heatLevel === 1
                      ? 50
                      : 0;
                const defenseSlots = slots.defense;
                const filledSlots = defenseSlots.filter(Boolean).length;
                const slotScore =
                  filledSlots === 3
                    ? 100
                    : filledSlots === 2
                      ? 66
                      : filledSlots === 1
                        ? 33
                        : 0;
                const totalAttacks = overview.recentAttacks.length;
                const wins = overview.recentAttacks.filter(
                  (a) => a.result === "defender_win",
                ).length;
                const winRate =
                  totalAttacks > 0 ? (wins / totalAttacks) * 100 : 50;

                const score = Math.round(
                  healthScore * 0.3 +
                    heatScore * 0.2 +
                    slotScore * 0.3 +
                    winRate * 0.2,
                );
                const color =
                  score >= 70
                    ? "text-cyber-green"
                    : score >= 40
                      ? "text-cyber-amber"
                      : "text-cyber-red";

                return (
                  <div className="flex items-center gap-4">
                    <div className={`text-3xl font-bold font-mono ${color}`}>
                      {score}
                    </div>
                    <div className="flex-1 space-y-1 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-text-muted">System Health</span>
                        <span className="text-text-secondary">
                          {Math.round(avgHealth)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Heat Level</span>
                        <span className="text-text-secondary">
                          {overview.heatLevel}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Defense Slots</span>
                        <span className="text-text-secondary">
                          {filledSlots}/3
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Win Rate</span>
                        <span className="text-text-secondary">
                          {totalAttacks > 0 ? Math.round(winRate) : "—"}%
                        </span>
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
