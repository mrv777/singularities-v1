import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Flame, ArrowDown, LogOut, Timer, AlertTriangle } from "lucide-react";
import type {
  IceBreakerStatusResponse,
  IceBreakerRunState,
  IceBreakerResolveResponse,
} from "@singularities/shared";
import { ICE_BREAKER_BALANCE } from "@singularities/shared";
import { Modal } from "@/components/Modal";
import { ResourceCost } from "@/components/ui/ResourceCost";
import { IceLayerCard } from "./IceLayerCard";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { playSound } from "@/lib/sound";

export function IceBreakerModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const openModal = useUIStore((s) => s.openModal);
  const player = useAuthStore((s) => s.player);
  const setPlayer = useAuthStore((s) => s.setPlayer);
  const queryClient = useQueryClient();
  const open = activeModal === "ice_breaker";

  const [status, setStatus] = useState<IceBreakerStatusResponse | null>(null);
  const [run, setRun] = useState<IceBreakerRunState | null>(null);
  const [lastResult, setLastResult] = useState<IceBreakerResolveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = async () => {
    setLoading(true);
    setError("");
    try {
      const s = await api.getIceBreakerStatus();
      setStatus(s);
      setRun(s.activeRun);
    } catch (err: any) {
      setError(err.message ?? "Failed to load ICE Breaker");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setLastResult(null);
      void loadStatus();
    }
  }, [open]);

  const handleInitiate = async () => {
    setActing(true);
    setError("");
    setLastResult(null);
    try {
      const result = await api.initiateIceBreach();
      setRun(result.run);
      setPlayer(result.player);
      queryClient.invalidateQueries({ queryKey: ["player"] });
      playSound("scan");
    } catch (err: any) {
      setError(err.message ?? "Failed to initiate breach");
    } finally {
      setActing(false);
    }
  };

  const handleResolve = async () => {
    setActing(true);
    setResolving(true);
    setError("");
    setLastResult(null);
    try {
      const [result] = await Promise.all([
        api.resolveIceLayer(),
        new Promise((r) => setTimeout(r, 1000)),
      ]);
      setResolving(false);
      setRun(result.run);
      setLastResult(result);
      if (result.passed) {
        playSound("hackSuccess");
      } else {
        playSound("hackFail");
      }
    } catch (err: any) {
      setResolving(false);
      setError(err.message ?? "Failed to resolve layer");
    } finally {
      setActing(false);
    }
  };

  const handleExtract = async () => {
    setActing(true);
    setError("");
    try {
      const result = await api.extractIceRewards();
      setPlayer(result.player);
      queryClient.invalidateQueries({ queryKey: ["player"] });
      setRun(null);
      setLastResult(null);
      playSound("click");
      await loadStatus();
    } catch (err: any) {
      setError(err.message ?? "Failed to extract rewards");
    } finally {
      setActing(false);
    }
  };

  const hasActiveRun = run && !run.completed && !run.failed;
  const runFinished = run && (run.completed || run.failed);

  return (
    <Modal open={open} onClose={closeModal} title="ICE BREAKER" maxWidth="max-w-lg">
      <div className="space-y-4">
        {/* Status bar */}
        <div className="border border-border-default rounded-lg p-3 bg-bg-secondary">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-cyber-cyan font-semibold flex items-center gap-1.5">
              <Flame size={12} />
              Breach Status
            </div>
            {status && (
              <div className="text-[10px] text-text-muted">
                Runs today: <span className="text-text-primary">{ICE_BREAKER_BALANCE.dailyLimit - status.dailyAttemptsRemaining}/{ICE_BREAKER_BALANCE.dailyLimit}</span>
              </div>
            )}
          </div>
          {status && status.cooldownTTL > 0 && (
            <div className="mt-2 text-xs text-cyber-amber flex items-center gap-1">
              <Timer size={10} />
              Cooldown: {Math.ceil(status.cooldownTTL / 60)}m remaining
            </div>
          )}
        </div>

        {/* Infiltration stats preview */}
        {status && (
          <div className="border border-border-default rounded-lg p-3 bg-bg-secondary">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">
                Infiltration Stats
              </div>
              <button
                onClick={() => openModal("security_center")}
                className="text-[10px] text-cyber-cyan hover:underline"
              >
                Configure Loadout →
              </button>
            </div>
            <div className="flex gap-3 text-xs">
              <span className={status.playerStats.hackPower === 0 ? "text-cyber-amber" : "text-text-secondary"}>
                HACK <span className="font-semibold text-text-primary">{status.playerStats.hackPower}</span>
              </span>
              <span className={status.playerStats.stealth === 0 ? "text-cyber-amber" : "text-text-secondary"}>
                STEALTH <span className="font-semibold text-text-primary">{status.playerStats.stealth}</span>
              </span>
              <span className={status.playerStats.defense === 0 ? "text-cyber-amber" : "text-text-secondary"}>
                DEFENSE <span className="font-semibold text-text-primary">{status.playerStats.defense}</span>
              </span>
            </div>
            {(status.playerStats.hackPower === 0 || status.playerStats.stealth === 0 || status.playerStats.defense === 0) && (
              <div className="mt-2 text-[10px] text-cyber-amber flex items-center gap-1">
                <AlertTriangle size={10} />
                One or more infiltration stats are 0. Equip modules to your infiltration loadout before breaching.
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="text-cyber-red text-xs p-2 border border-cyber-red/20 rounded bg-cyber-red/5">
            {error}
          </div>
        )}

        {/* No active run — show initiate */}
        {!run && !loading && (
          <div className="text-center py-6">
            <p className="text-text-secondary text-sm mb-4">
              Breach layered ICE defenses. Each layer tests a different stat.
              Push deeper for bigger rewards, or extract early to keep what you've earned.
            </p>
            <button
              onClick={handleInitiate}
              disabled={acting || !status || status.dailyAttemptsRemaining <= 0 || status.cooldownTTL > 0 || !player || player.energy < ICE_BREAKER_BALANCE.energyCost}
              className="px-6 py-2 min-h-[44px] border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm font-semibold"
            >
              {acting ? "Initiating..." : (
                <span className="inline-flex items-center gap-1.5">
                  INITIATE BREACH <ResourceCost costs={{ energy: ICE_BREAKER_BALANCE.energyCost }} />
                </span>
              )}
            </button>
            {player && player.energy < ICE_BREAKER_BALANCE.energyCost && (
              <p className="text-cyber-red text-xs mt-2">Insufficient energy</p>
            )}
            {status && status.dailyAttemptsRemaining <= 0 && (
              <p className="text-cyber-amber text-xs mt-2">Daily limit reached</p>
            )}
          </div>
        )}

        {loading && !run && (
          <div className="text-text-muted text-sm text-center py-6">Loading...</div>
        )}

        {/* Active run — show layers + actions */}
        {run && (
          <>
            {/* Layer list */}
            <div className="space-y-1.5">
              {run.layers.map((layer, i) => (
                <IceLayerCard
                  key={i}
                  type={layer.type}
                  depth={layer.depth}
                  threshold={layer.threshold}
                  state={
                    run.failed && i === run.currentDepth ? "failed"
                    : i < run.currentDepth ? "passed"
                    : i === run.currentDepth && resolving ? "resolving"
                    : i === run.currentDepth && !run.completed && !run.failed ? "current"
                    : run.completed && i < run.layers.length ? "passed"
                    : "pending"
                  }
                />
              ))}
            </div>

            {/* Last result feedback */}
            {lastResult && (
              <div className={`text-xs p-2 rounded border ${
                lastResult.passed
                  ? "border-cyber-green/30 bg-cyber-green/5 text-cyber-green"
                  : "border-cyber-red/30 bg-cyber-red/5 text-cyber-red"
              }`}>
                {lastResult.passed ? (
                  <span>Layer cracked! ({lastResult.passRate}% chance)</span>
                ) : (
                  <span className="space-y-1">
                    <div className="flex items-center gap-1">
                      <AlertTriangle size={12} />
                      ICE breach failed ({lastResult.passRate}% chance)
                    </div>
                    {lastResult.damage && (
                      <div className="text-[10px] text-text-muted">
                        System damage: {lastResult.damage.systems.map(d => `${d.systemType} -${d.damage}HP`).join(", ")}
                      </div>
                    )}
                  </span>
                )}
              </div>
            )}

            {/* Accumulated rewards */}
            <div className="border border-border-default rounded p-2 bg-bg-surface">
              {run.completed && (
                <div className="text-[10px] uppercase tracking-wider text-cyber-cyan font-semibold mb-1.5 flex items-center gap-1">
                  <Flame size={10} />
                  Full Breach Bonus: 1.5x
                </div>
              )}
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Accumulated Rewards</div>
              <div className="flex gap-4 text-xs">
                <span className="text-cyber-amber">{run.accumulatedRewards.credits} CR</span>
                <span className="text-cyber-green">{run.accumulatedRewards.data} DATA</span>
                <span className="text-text-secondary">{run.accumulatedRewards.xp} XP</span>
                {run.accumulatedRewards.processingPower > 0 && (
                  <span className="text-cyber-magenta">{run.accumulatedRewards.processingPower} PP</span>
                )}
              </div>
              {run.failed && (
                <div className="text-[10px] text-cyber-amber mt-1">
                  50% penalty applied due to breach failure
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {hasActiveRun && (
                <>
                  <button
                    onClick={handleResolve}
                    disabled={acting}
                    className="flex-1 py-2 min-h-[44px] border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-30 text-sm font-semibold flex items-center justify-center gap-1.5"
                  >
                    {acting ? "..." : <><ArrowDown size={14} /> PUSH DEEPER</>}
                  </button>
                  <button
                    onClick={handleExtract}
                    disabled={acting || run.currentDepth === 0}
                    className="flex-1 py-2 min-h-[44px] border border-cyber-green text-cyber-green rounded hover:bg-cyber-green/10 transition-colors disabled:opacity-30 text-sm font-semibold flex items-center justify-center gap-1.5"
                  >
                    {acting ? "..." : <><LogOut size={14} /> EXTRACT</>}
                  </button>
                </>
              )}
              {runFinished && (
                <button
                  onClick={handleExtract}
                  disabled={acting}
                  className="flex-1 py-2 min-h-[44px] border border-cyber-green text-cyber-green rounded hover:bg-cyber-green/10 transition-colors disabled:opacity-30 text-sm font-semibold"
                >
                  {acting ? "Extracting..." : run.completed ? "COLLECT REWARDS" : "COLLECT PARTIAL REWARDS"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
