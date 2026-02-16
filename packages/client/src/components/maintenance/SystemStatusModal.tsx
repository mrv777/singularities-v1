import { Modal } from "../Modal";
import { useUIStore } from "@/stores/ui";
import { SystemCard } from "./SystemCard";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ENERGY_COSTS, REPAIR_CREDIT_COST } from "@singularities/shared";
import type { PlayerSystem } from "@singularities/shared";
import { AlertTriangle, RefreshCw } from "lucide-react";

export function SystemStatusModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const { setPlayer } = useAuthStore();
  const queryClient = useQueryClient();
  const open = activeModal === "system_maintenance";

  const [systems, setSystems] = useState<PlayerSystem[]>([]);
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadSystems = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.fullScan();
      setSystems(result.systems);
    } catch (err: any) {
      setError(err.message || "Failed to scan systems");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadSystems();
    }
  }, [open]);

  const handleRepair = async (systemType: string) => {
    setRepairing(systemType);
    setError("");
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

  const criticalCount = systems.filter(
    (s) => s.status === "CRITICAL" || s.status === "CORRUPTED"
  ).length;

  return (
    <Modal open={open} onClose={closeModal} title="SYSTEM MAINTENANCE" maxWidth="max-w-3xl">
      <div className="space-y-4">
        {/* Cost info */}
        <div className="flex items-center justify-between text-[10px] text-text-muted">
          <span>Repair cost: {ENERGY_COSTS.repair} EN + {REPAIR_CREDIT_COST} CR</span>
          <button
            onClick={loadSystems}
            disabled={loading}
            className="flex items-center gap-1 text-cyber-cyan hover:text-cyber-cyan/80 transition-colors"
          >
            <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

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
                repairing={repairing === system.systemType}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
