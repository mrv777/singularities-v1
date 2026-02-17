import { Modal } from "@/components/Modal";
import { useUIStore } from "@/stores/ui";
import { useGameStore } from "@/stores/game";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import {
  SCAN_ENERGY_COST,
  getHackEnergyCost,
  type HackResult,
} from "@singularities/shared";
import { TargetCard } from "./TargetCard";
import { LoadoutPreview } from "./LoadoutPreview";
import { HackResultDisplay } from "./HackResult";
import { ResourceCost } from "../ui/ResourceCost";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { playSound } from "@/lib/sound";

export function ScannerModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const player = useAuthStore((s) => s.player);
  const setPlayer = useAuthStore((s) => s.setPlayer);
  const queryClient = useQueryClient();

  const {
    scannedTargets,
    selectedTargetIndex,
    hackResult,
    isScanning,
    isHacking,
    setScannedTargets,
    selectTarget,
    setHackResult,
    clearHackResult,
    setIsScanning,
    setIsHacking,
    setLoadout,
    setOwnedModules,
    setPendingDecision,
  } = useGameStore();

  const [error, setError] = useState("");
  const open = activeModal === "scanner";

  // Load loadout & modules when scanner opens
  useEffect(() => {
    if (open) {
      api.getLoadoutsByType("infiltration").then((r) => setLoadout(r.loadout)).catch(() => {});
      api.getModules().then((r) => setOwnedModules(r.owned)).catch(() => {});
    }
  }, [open, setLoadout, setOwnedModules]);

  const handleScan = async () => {
    setIsScanning(true);
    setError("");
    try {
      const result = await api.scan();
      playSound("scan");
      setScannedTargets(result.targets, result.expiresAt);
      queryClient.invalidateQueries({ queryKey: ["player"] });
      // Refresh player state to get updated energy
      const me = await api.getMe();
      setPlayer(me.player);
    } catch (err: any) {
      setError(err.message ?? "Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  const handleHack = async () => {
    if (selectedTargetIndex === null) return;

    setIsHacking(true);
    setError("");
    try {
      const target = scannedTargets[selectedTargetIndex];
      const result = await api.hack({ targetIndex: target.index });
      setPlayer(result.player);
      queryClient.invalidateQueries({ queryKey: ["player"] });

      // Remove the hacked target from local state (this clears hackResult, so do it first)
      const remaining = scannedTargets.filter((_, i) => i !== selectedTargetIndex);
      if (remaining.length > 0) {
        setScannedTargets(remaining, useGameStore.getState().scanExpiresAt ?? "");
      } else {
        setScannedTargets([], "");
      }
      selectTarget(null);

      // Set hack result LAST — the calls above clear it
      setHackResult(result);

      // Check for pending binary decision triggered by the hack
      api.getPendingDecision().then((r) => {
        if (r.decision) setPendingDecision(r.decision);
      }).catch(() => {});
    } catch (err: any) {
      const msg = err.message ?? "Hack failed";
      // If scan expired, clear stale targets so user can re-scan
      if (msg.includes("scan") || msg.includes("Scan")) {
        setScannedTargets([], "");
        selectTarget(null);
      }
      setError(msg);
    } finally {
      setIsHacking(false);
    }
  };

  const selectedTarget =
    selectedTargetIndex !== null ? scannedTargets[selectedTargetIndex] : null;
  const selectedHackEnergyCost = selectedTarget
    ? getHackEnergyCost(selectedTarget.securityLevel)
    : 0;
  const hasHackEnergy = player ? player.energy >= selectedHackEnergyCost : false;

  return (
    <Modal open={open} onClose={closeModal} title="NETWORK SCANNER" maxWidth="max-w-3xl">
      {hackResult ? (
        <HackResultDisplay
          result={hackResult as HackResult}
          onDone={clearHackResult}
        />
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="text-cyber-red text-xs text-center border border-cyber-red/30 rounded px-3 py-2 bg-cyber-red/5">
              {error}
            </div>
          )}

          {/* Scan button */}
          {scannedTargets.length === 0 && (
            <div className="text-center py-8">
              <p className="text-text-secondary text-sm mb-4">
                Scan the network to discover infiltration targets.
              </p>
              <button
                onClick={handleScan}
                disabled={isScanning || !player || player.energy < SCAN_ENERGY_COST}
                className="px-6 py-2 min-h-[44px] border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm"
              >
                {isScanning ? "Scanning..." : <span className="flex items-center gap-1.5">Scan Network <ResourceCost costs={{ energy: SCAN_ENERGY_COST }} /></span>}
              </button>
              {player && player.energy < SCAN_ENERGY_COST && (
                <p className="text-cyber-red text-xs mt-2">Insufficient energy</p>
              )}
            </div>
          )}

          {/* Target list */}
          {scannedTargets.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary text-xs">
                  {scannedTargets.length} targets found
                </span>
                <button
                  onClick={handleScan}
                  disabled={isScanning || !player || player.energy < SCAN_ENERGY_COST}
                  className="text-xs text-cyber-cyan hover:underline disabled:opacity-30"
                >
                  <span className="inline-flex items-center gap-1">Re-scan <ResourceCost costs={{ energy: SCAN_ENERGY_COST }} /></span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {scannedTargets.map((target, i) => (
                  <TargetCard
                    key={target.index}
                    target={target}
                    selected={selectedTargetIndex === i}
                    onSelect={() => selectTarget(i)}
                  />
                ))}
              </div>

              {/* Loadout + execute */}
              {selectedTarget && (
                <div className="space-y-3 border-t border-border-default pt-3">
                  <LoadoutPreview />
                  <button
                    onClick={handleHack}
                    disabled={isHacking || !hasHackEnergy}
                    className="w-full py-2.5 min-h-[44px] border border-cyber-green text-cyber-green rounded hover:bg-cyber-green/10 transition-colors disabled:opacity-30 text-sm font-semibold"
                  >
                    {isHacking ? "Executing..." : <span className="inline-flex items-center gap-1.5">EXECUTE HACK <ResourceCost costs={{ energy: selectedHackEnergyCost }} /></span>}
                  </button>
                  {!hasHackEnergy && (
                    <div className="text-cyber-red text-[11px] text-center">
                      Not enough energy for this target.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
