import { Modal } from "../Modal";
import { useUIStore } from "@/stores/ui";
import { SystemCard } from "./SystemCard";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ENERGY_COSTS, getRepairCreditCostForHealth } from "@singularities/shared";
import type { PlayerSystem } from "@singularities/shared";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { ResourceCost } from "../ui/ResourceCost";
import { useModifier } from "@/hooks/useModifier";
import { playSound } from "@/lib/sound";

export function SystemStatusModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const { player, setPlayer } = useAuthStore();
  const queryClient = useQueryClient();
  const { applyCost } = useModifier();
  const open = activeModal === "system_maintenance";

  const [systems, setSystems] = useState<PlayerSystem[]>([]);
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState<string | null>(null);
  const [repairingAll, setRepairingAll] = useState(false);
  const [error, setError] = useState("");
  const [syncWarning, setSyncWarning] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [summary, setSummary] = useState<{
    repairedCount: number;
    damagedCount: number;
    creditsSpent: number;
    energySpent: number;
    skippedBudget: number;
  } | null>(null);

  const loadSystems = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const result = await api.fullScan();
      setSystems(result.systems);
      setLastUpdatedAt(Date.now());
      setSyncWarning("");
      if (!silent) setSummary(null);
    } catch (err: any) {
      if (!silent) setError(err.message || "Failed to scan systems");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadSystems();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let timer: number | null = null;
    let inFlight = false;
    let consecutiveSilentFailures = 0;

    const scheduleNext = () => {
      if (cancelled) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(tick, 15_000);
    };

    const tick = async () => {
      if (cancelled) return;
      // Avoid unnecessary requests when tab is hidden.
      if (document.hidden || repairing || repairingAll || inFlight) {
        scheduleNext();
        return;
      }

      inFlight = true;
      try {
        const result = await api.fullScan();
        if (cancelled) return;
        setSystems(result.systems);
        setLastUpdatedAt(Date.now());
        consecutiveSilentFailures = 0;
        setSyncWarning("");
      } catch {
        if (cancelled) return;
        consecutiveSilentFailures += 1;
        if (consecutiveSilentFailures >= 3) {
          setSyncWarning("Auto-sync unstable. Reconnecting...");
        }
      } finally {
        inFlight = false;
        scheduleNext();
      }
    };

    const refreshOnVisibilityOrOnline = () => {
      if (document.hidden || repairing || repairingAll || inFlight) return;
      if (timer !== null) window.clearTimeout(timer);
      void tick();
    };

    timer = window.setTimeout(tick, 15_000);
    document.addEventListener("visibilitychange", refreshOnVisibilityOrOnline);
    window.addEventListener("online", refreshOnVisibilityOrOnline);

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshOnVisibilityOrOnline);
      window.removeEventListener("online", refreshOnVisibilityOrOnline);
    };
  }, [open, repairing, repairingAll]);

  const handleRepair = async (systemType: string) => {
    setRepairing(systemType);
    setError("");
    setSummary(null);
    try {
      const result = await api.repairSystem({ systemType });
      setPlayer(result.player);
      // Update the local system state
      setSystems((prev) =>
        prev.map((s) => (s.systemType === systemType ? result.system : s))
      );
      queryClient.invalidateQueries({ queryKey: ["player"] });
    } catch (err: any) {
      setError(err.message || "Repair failed");
    } finally {
      setRepairing(null);
    }
  };

  const handleRepairAll = async () => {
    setRepairingAll(true);
    setError("");
    setSummary(null);
    try {
      const result = await api.repairAllSystems();
      setPlayer(result.player);
      const repairedMap = new Map(
        result.repaired.map((item) => [item.system.systemType, item.system])
      );
      setSystems((prev) =>
        prev.map((system) => repairedMap.get(system.systemType) ?? system)
      );
      const skippedBudget = result.skipped.filter(
        (s) =>
          s.reason === "insufficient_energy"
          || s.reason === "insufficient_credits"
          || s.reason === "budget_exhausted"
      ).length;
      setSummary({
        repairedCount: result.totals.repairedCount,
        damagedCount: result.totals.damagedCount,
        creditsSpent: result.totals.creditsSpent,
        energySpent: result.totals.energySpent,
        skippedBudget,
      });
      queryClient.invalidateQueries({ queryKey: ["player"] });
    } catch (err: any) {
      setError(err.message || "Repair all failed");
    } finally {
      setRepairingAll(false);
    }
  };

  const criticalCount = systems.filter(
    (s) => s.status === "CRITICAL" || s.status === "CORRUPTED"
  ).length;
  const damagedCount = systems.filter((s) => s.health < 100).length;
  const playerLevel = player?.level ?? 1;
  const baseCreditsToRepairAll = systems
    .filter((s) => s.health < 100)
    .reduce((sum, s) => sum + getRepairCreditCostForHealth(s.health, playerLevel), 0);
  const estimatedCreditsToRepairAll = applyCost(baseCreditsToRepairAll, "repairCostMultiplier");
  const baseEnergyToRepairAll = damagedCount * ENERGY_COSTS.repair;
  const estimatedEnergyToRepairAll = applyCost(baseEnergyToRepairAll, "energyCostMultiplier");

  // Play critical warning if any systems are critical/corrupted
  useEffect(() => {
    if (open && criticalCount > 0) playSound("criticalWarning");
  }, [open, criticalCount]);

  return (
    <Modal open={open} onClose={closeModal} title="SYSTEM MAINTENANCE" maxWidth="max-w-3xl">
      <div className="space-y-4">
        {/* Cost info */}
        <div className="space-y-1 text-[10px] text-text-muted">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span>Available:</span>
              <ResourceCost
                costs={{
                  credits: player?.credits ?? 0,
                  energy: player?.energy ?? 0,
                }}
                size={10}
              />
              <span className="text-text-muted/70">|</span>
              <span>Est. all repairs:</span>
              <ResourceCost
                costs={{
                  credits: estimatedCreditsToRepairAll,
                  energy: estimatedEnergyToRepairAll,
                }}
                baseCosts={{
                  credits: baseCreditsToRepairAll,
                  energy: baseEnergyToRepairAll,
                }}
                available={{
                  credits: player?.credits ?? 0,
                  energy: player?.energy ?? 0,
                }}
                size={10}
              />
            </div>
            <span className="text-text-muted/80">
              Auto-sync: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "syncing..."}
            </span>
          </div>
          <div>
            Repair cost scales with damage (energy fixed at <ResourceCost costs={{ energy: applyCost(ENERGY_COSTS.repair, "energyCostMultiplier") }} baseCosts={{ energy: ENERGY_COSTS.repair }} /> per repaired system).
          </div>
        </div>

        <div className="flex items-center justify-end text-[10px] text-text-muted">
          <button
            onClick={handleRepairAll}
            disabled={loading || repairingAll || repairing !== null || damagedCount === 0}
            className="text-cyber-green hover:text-cyber-green/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {repairingAll ? "Repairing..." : `Repair All (${damagedCount})`}
          </button>
        </div>

        {summary && (
          <div className="text-[10px] p-2 border border-cyber-green/30 rounded bg-cyber-green/5 text-cyber-green">
            Repaired {summary.repairedCount}/{summary.damagedCount} damaged systems.
            Spent <ResourceCost costs={{ credits: summary.creditsSpent, energy: summary.energySpent }} size={10} />.
            {summary.skippedBudget > 0 && ` ${summary.skippedBudget} skipped due to resource budget.`}
          </div>
        )}

        {/* Recovery shield banner */}
        {player?.pvpShieldUntil && new Date(player.pvpShieldUntil) > new Date() && (() => {
          const remaining = new Date(player.pvpShieldUntil).getTime() - Date.now();
          const hours = Math.floor(remaining / 3600000);
          const minutes = Math.floor((remaining % 3600000) / 60000);
          return (
            <div className="flex items-center gap-2 p-2 rounded border border-cyber-cyan/30 bg-cyber-cyan/5 text-cyber-cyan text-xs">
              <ShieldCheck size={14} />
              <span>RECOVERY SHIELD ACTIVE — {hours}h {minutes}m remaining</span>
            </div>
          );
        })()}

        {/* Cascade warning banner */}
        {criticalCount > 0 && (
          <div className="flex items-center gap-2 p-2 rounded border border-cyber-red/30 bg-cyber-red/5 text-cyber-red text-xs">
            <AlertTriangle size={14} />
            <span>
              {criticalCount} system{criticalCount > 1 ? "s" : ""} in critical state. Cascade damage is spreading to adjacent systems.
            </span>
          </div>
        )}

        {error && (
          <div className="text-cyber-red text-xs p-2 border border-cyber-red/20 rounded">
            {error}
          </div>
        )}
        {!error && syncWarning && (
          <div className="text-cyber-amber text-xs p-2 border border-cyber-amber/30 rounded">
            {syncWarning}
          </div>
        )}

        {/* System grid */}
        {loading && systems.length === 0 ? (
          <div className="text-text-muted text-sm text-center py-8">Scanning systems...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {systems.map((system) => (
              <SystemCard
                key={system.systemType}
                system={system}
                onRepair={handleRepair}
                repairing={repairingAll || repairing === system.systemType}
                repairCreditCost={applyCost(getRepairCreditCostForHealth(system.health, playerLevel), "repairCostMultiplier")}
                baseRepairCreditCost={getRepairCreditCostForHealth(system.health, playerLevel)}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
