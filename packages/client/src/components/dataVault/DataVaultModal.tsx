import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Database, Gauge, Shield, Timer } from "lucide-react";
import type {
  DataVaultActiveProtocol,
  DataVaultBuffKey,
  DataVaultProtocolDefinition,
} from "@singularities/shared";
import { Modal } from "@/components/Modal";
import { ResourceCost } from "@/components/ui/ResourceCost";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";

interface DataVaultState {
  protocols: DataVaultProtocolDefinition[];
  activeProtocol: DataVaultActiveProtocol | null;
  cooldownExpiresAt: string | null;
  dailyUses: number;
  dailyUseCap: number;
}

const BUFF_LABELS: Record<DataVaultBuffKey, string> = {
  hackPower: "Hack Power",
  stealth: "Stealth",
  detectionReduction: "Detection Reduction",
  dataBonus: "Data Gain",
};

function formatRemaining(expiresAt: string | null, nowMs: number): string {
  if (!expiresAt) return "Ready";
  const delta = new Date(expiresAt).getTime() - nowMs;
  if (delta <= 0) return "Ready";
  const totalMinutes = Math.ceil(delta / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatBuffs(protocol: DataVaultProtocolDefinition): string {
  const parts = Object.entries(protocol.buffs).map(([key, value]) => {
    const label = BUFF_LABELS[key as DataVaultBuffKey];
    const sign = value && value > 0 ? "+" : "";
    return `${sign}${value} ${label}`;
  });
  return parts.join(" | ");
}

function formatBuffEntries(buffs: Partial<Record<DataVaultBuffKey, number>>): string {
  const parts = Object.entries(buffs).map(([key, value]) => {
    const label = BUFF_LABELS[key as DataVaultBuffKey];
    const sign = value && value > 0 ? "+" : "";
    return `${sign}${value} ${label}`;
  });
  return parts.join(" | ");
}

export function DataVaultModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const player = useAuthStore((s) => s.player);
  const setPlayer = useAuthStore((s) => s.setPlayer);
  const queryClient = useQueryClient();
  const open = activeModal === "data_vault";

  const [status, setStatus] = useState<DataVaultState | null>(null);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const loadStatus = async () => {
    setLoading(true);
    setError("");
    try {
      const next = await api.getDataVaultStatus();
      setStatus(next);
    } catch (err: any) {
      setError(err.message ?? "Failed to load Data Vault");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadStatus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  const cooldownRemaining = useMemo(
    () => formatRemaining(status?.cooldownExpiresAt ?? null, nowMs),
    [status?.cooldownExpiresAt, nowMs]
  );
  const activeRemaining = useMemo(
    () => formatRemaining(status?.activeProtocol?.expiresAt ?? null, nowMs),
    [status?.activeProtocol?.expiresAt, nowMs]
  );
  const isCoolingDown = cooldownRemaining !== "Ready";
  const hasActiveProtocol = Boolean(status?.activeProtocol && activeRemaining !== "Ready");
  const dailyLimitReached = !!status && status.dailyUses >= status.dailyUseCap;
  const isActivatingAny = activating !== null;

  const handleActivate = async (protocolId: string) => {
    setActivating(protocolId);
    setError("");
    try {
      const result = await api.activateDataVaultProtocol({ protocolId });
      setPlayer(result.player);
      queryClient.invalidateQueries({ queryKey: ["player"] });
      await loadStatus();
    } catch (err: any) {
      setError(err.message ?? "Activation failed");
    } finally {
      setActivating(null);
    }
  };

  return (
    <Modal open={open} onClose={closeModal} title="DATA VAULT" maxWidth="max-w-3xl">
      <div className="space-y-4">
        <div className="border border-border-default rounded-lg p-3 bg-bg-secondary">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-wider text-cyber-cyan font-semibold flex items-center gap-1.5">
              <Database size={12} />
              Vault Status
            </div>
            {status && (
              <div className="text-[10px] text-text-muted">
                Uses today: <span className="text-text-primary">{status.dailyUses}/{status.dailyUseCap}</span>
              </div>
            )}
          </div>

          {status?.activeProtocol ? (
            <div className="mt-2 text-xs text-text-secondary">
              <div className="text-text-primary font-semibold">{status.activeProtocol.name} active</div>
              <div className="text-text-muted mt-0.5">
                {formatBuffEntries(status.activeProtocol.buffs)}
              </div>
              <div className="text-cyber-cyan mt-1">Ends in {activeRemaining}</div>
            </div>
          ) : (
            <div className="mt-2 text-xs text-text-muted">
              No active protocol.
            </div>
          )}

          <div className="mt-2 text-[10px] text-text-muted flex items-center gap-4">
            <span className="inline-flex items-center gap-1">
              <Timer size={10} />
              Cooldown: {cooldownRemaining}
            </span>
            <span className="inline-flex items-center gap-1">
              <Gauge size={10} />
              Daily cap: {status ? status.dailyUseCap : "-"}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-text-muted">
          Use one short protocol at a time. These buffs are deterministic and never fail.
        </div>

        {error && (
          <div className="text-cyber-red text-xs p-2 border border-cyber-red/20 rounded">
            {error}
          </div>
        )}

        {loading && !status ? (
          <div className="text-text-muted text-sm text-center py-6">Loading Data Vault...</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {(status?.protocols ?? []).map((protocol) => {
              const hasResources = !!player
                && player.credits >= protocol.costs.credits
                && player.data >= protocol.costs.data;
              const blocked = isActivatingAny
                || hasActiveProtocol
                || isCoolingDown
                || dailyLimitReached
                || !hasResources;
              return (
                <div key={protocol.id} className="border border-border-default rounded-lg p-3 bg-bg-elevated space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-text-primary text-sm font-semibold">{protocol.name}</div>
                      <div className="text-[10px] text-text-muted mt-1">{protocol.description}</div>
                    </div>
                    {protocol.recommended && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-cyber-cyan/40 text-cyber-cyan">
                        Recommended
                      </span>
                    )}
                  </div>

                  <div className="text-[10px] text-cyber-green flex items-center gap-1">
                    <Shield size={10} />
                    {formatBuffs(protocol)}
                  </div>

                  <div className="text-[10px] text-text-muted">
                    Duration: {Math.round(protocol.durationSeconds / 60)}m
                  </div>

                  <div className="text-[10px]">
                    <ResourceCost
                      costs={protocol.costs}
                      available={player ? { credits: player.credits, data: player.data } : undefined}
                    />
                  </div>

                  <button
                    onClick={() => handleActivate(protocol.id)}
                    disabled={blocked || activating === protocol.id}
                    className="w-full py-2 min-h-[44px] text-xs border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {activating === protocol.id ? "Activating..." : "Activate Protocol"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
