import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Plus } from "lucide-react";
import type { DaemonForgeStatusResponse, PlayerDaemon, DaemonType } from "@singularities/shared";
import { DAEMON_DEFINITIONS, DAEMON_TYPES, DAEMON_MISSION_DURATIONS } from "@singularities/shared";
import { Modal } from "@/components/Modal";
import { ResourceCost } from "@/components/ui/ResourceCost";
import { DaemonCard } from "./DaemonCard";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { playSound } from "@/lib/sound";

const DURATION_LABELS: Record<number, string> = {
  30: "30 min",
  120: "2 hours",
  240: "4 hours",
};

export function DaemonForgeModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const player = useAuthStore((s) => s.player);
  const setPlayer = useAuthStore((s) => s.setPlayer);
  const queryClient = useQueryClient();
  const open = activeModal === "daemon_forge";

  const [status, setStatus] = useState<DaemonForgeStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [showCraft, setShowCraft] = useState(false);
  const [deployTarget, setDeployTarget] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const loadStatus = async () => {
    setLoading(true);
    setError("");
    try {
      const s = await api.getDaemonForgeStatus();
      setStatus(s);
    } catch (err: any) {
      setError(err.message ?? "Failed to load Daemon Forge");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setShowCraft(false);
      setDeployTarget(null);
      void loadStatus();
    }
  }, [open]);

  // Tick timer for deployment countdowns
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, [open]);

  const handleCraft = async (daemonType: DaemonType) => {
    setActing(true);
    setError("");
    try {
      const result = await api.craftDaemon(daemonType);
      setPlayer(result.player);
      queryClient.invalidateQueries({ queryKey: ["player"] });
      playSound("click");
      setShowCraft(false);
      await loadStatus();
    } catch (err: any) {
      setError(err.message ?? "Craft failed");
    } finally {
      setActing(false);
    }
  };

  const handleDeploy = async (daemonId: string, duration: number) => {
    setActing(true);
    setError("");
    try {
      await api.deployDaemon(daemonId, duration);
      playSound("click");
      setDeployTarget(null);
      await loadStatus();
    } catch (err: any) {
      setError(err.message ?? "Deploy failed");
    } finally {
      setActing(false);
    }
  };

  const handleCollect = async (daemonId: string) => {
    setActing(true);
    setError("");
    try {
      const result = await api.collectDaemon(daemonId);
      setPlayer(result.player);
      queryClient.invalidateQueries({ queryKey: ["player"] });
      playSound("click");
      await loadStatus();
    } catch (err: any) {
      setError(err.message ?? "Collect failed");
    } finally {
      setActing(false);
    }
  };

  const handleScrap = async (daemonId: string) => {
    setActing(true);
    setError("");
    try {
      await api.scrapDaemon(daemonId);
      playSound("click");
      await loadStatus();
    } catch (err: any) {
      setError(err.message ?? "Scrap failed");
    } finally {
      setActing(false);
    }
  };

  return (
    <Modal open={open} onClose={closeModal} title="DAEMON FORGE" maxWidth="max-w-lg">
      <div className="space-y-4">
        {/* Status */}
        <div className="border border-border-default rounded-lg p-3 bg-bg-secondary">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-cyber-cyan font-semibold flex items-center gap-1.5">
              <Bot size={12} />
              Forge Status
            </div>
            {status && (
              <div className="text-[10px] text-text-muted">
                Slots: <span className="text-text-primary">{status.daemons.length}/{status.maxSlots}</span>
              </div>
            )}
          </div>
          <div className="mt-1 text-[10px] text-text-muted">
            Craft autonomous daemons and deploy them on timed missions for passive rewards.
          </div>
        </div>

        {error && (
          <div className="text-cyber-red text-xs p-2 border border-cyber-red/20 rounded bg-cyber-red/5">
            {error}
          </div>
        )}

        {loading && !status ? (
          <div className="text-text-muted text-sm text-center py-6">Loading...</div>
        ) : (
          <>
            {/* Deploy duration selector overlay */}
            {deployTarget && (
              <div className="border border-cyber-cyan/30 rounded-lg p-3 bg-bg-surface space-y-2">
                <div className="text-xs text-text-secondary">Select mission duration:</div>
                <div className="flex gap-2">
                  {DAEMON_MISSION_DURATIONS.map((d) => {
                    const daemon = status?.daemons.find((dm) => dm.id === deployTarget);
                    const def = daemon ? DAEMON_DEFINITIONS[daemon.daemonType] : null;
                    const rewards = def?.missionRewards[d];
                    return (
                      <button
                        key={d}
                        onClick={() => handleDeploy(deployTarget, d)}
                        disabled={acting}
                        className="flex-1 py-2 border border-border-default rounded hover:border-cyber-cyan text-xs transition-colors disabled:opacity-30 space-y-1"
                      >
                        <div className="font-semibold text-text-primary">{DURATION_LABELS[d]}</div>
                        {rewards && (
                          <div className="text-[10px] text-text-muted">
                            +{rewards.credits}CR +{rewards.data}D
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setDeployTarget(null)}
                  className="text-[10px] text-text-muted hover:text-text-secondary"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Daemon grid */}
            {status && status.daemons.length > 0 && (
              <div className="space-y-2">
                {status.daemons.map((daemon) => (
                  <DaemonCard
                    key={daemon.id}
                    daemon={daemon}
                    onDeploy={(id) => setDeployTarget(id)}
                    onCollect={handleCollect}
                    onScrap={handleScrap}
                    acting={acting}
                  />
                ))}
              </div>
            )}

            {status && status.daemons.length === 0 && !showCraft && (
              <div className="text-center py-4 text-text-muted text-sm">
                No daemons crafted yet. Forge your first daemon below.
              </div>
            )}

            {/* Craft button / panel */}
            {status && status.availableSlots > 0 && !showCraft && (
              <button
                onClick={() => setShowCraft(true)}
                className="w-full py-2 min-h-[44px] border border-cyber-cyan/40 text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors text-sm flex items-center justify-center gap-1.5"
              >
                <Plus size={14} /> CRAFT NEW DAEMON
              </button>
            )}

            {showCraft && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-text-secondary">Select Daemon Type</span>
                  <button onClick={() => setShowCraft(false)} className="text-[10px] text-text-muted hover:text-text-secondary">Cancel</button>
                </div>
                {DAEMON_TYPES.map((type) => {
                  const def = DAEMON_DEFINITIONS[type];
                  const canAfford = !!player
                    && player.credits >= def.craftCost.credits
                    && player.data >= def.craftCost.data
                    && player.processingPower >= def.craftCost.processingPower;
                  return (
                    <div key={type} className="border border-border-default rounded-lg p-3 bg-bg-surface">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-text-primary">{def.label}</div>
                          <div className="text-[10px] text-text-muted mt-0.5">{def.description}</div>
                          <div className="text-[10px] text-text-muted mt-1">
                            Durability: {def.baseDurability} uses
                          </div>
                        </div>
                        <button
                          onClick={() => handleCraft(type)}
                          disabled={acting || !canAfford}
                          className="px-3 py-1.5 min-h-[32px] text-[11px] border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-30 shrink-0"
                        >
                          CRAFT
                        </button>
                      </div>
                      <div className="mt-2">
                        <ResourceCost
                          costs={def.craftCost}
                          available={player ? {
                            credits: player.credits,
                            data: player.data,
                            processingPower: player.processingPower,
                          } : undefined}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
