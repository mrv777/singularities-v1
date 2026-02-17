import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Database, Gauge, Shield, Timer } from "lucide-react";
import type {
  DataVaultActiveProtocol,
  DataVaultBuffKey,
  DataVaultProtocolDefinition,
  Player,
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

interface ProtocolRecommendation {
  recommendedId: string | null;
  reasonsById: Record<string, string>;
  hintsById: Record<string, string>;
}

function getShortfall(player: Player | null, protocol: DataVaultProtocolDefinition) {
  if (!player) {
    return { credits: 0, data: 0, affordable: true };
  }
  const credits = Math.max(0, protocol.costs.credits - player.credits);
  const data = Math.max(0, protocol.costs.data - player.data);
  return { credits, data, affordable: credits === 0 && data === 0 };
}

function getProtocolHint(protocol: DataVaultProtocolDefinition): string {
  const hack = protocol.buffs.hackPower ?? 0;
  const stealth = protocol.buffs.stealth ?? 0;
  const detectionReduction = protocol.buffs.detectionReduction ?? 0;
  const dataBonus = protocol.buffs.dataBonus ?? 0;

  if (hack > 0 && (stealth > 0 || detectionReduction > 0)) {
    return "Use for mixed offense + safety.";
  }
  if (hack > 0) {
    return "Use for faster progression.";
  }
  if (dataBonus > 0) {
    return "Use to grow data income.";
  }
  if (stealth > 0 || detectionReduction > 0) {
    return "Use to lower detection risk.";
  }
  return "Situational utility protocol.";
}

function getRecommendationReason(
  protocol: DataVaultProtocolDefinition,
  player: Player | null,
  shortfall: { credits: number; data: number; affordable: boolean }
): string {
  const hack = protocol.buffs.hackPower ?? 0;
  const stealth = protocol.buffs.stealth ?? 0;
  const detectionReduction = protocol.buffs.detectionReduction ?? 0;
  const dataBonus = protocol.buffs.dataBonus ?? 0;
  const safety = stealth + detectionReduction;

  if (!shortfall.affordable) {
    const parts: string[] = [];
    if (shortfall.credits > 0) parts.push(`+${shortfall.credits} credits`);
    if (shortfall.data > 0) parts.push(`+${shortfall.data} data`);
    return `Closest unlock once you gain ${parts.join(" and ")}.`;
  }

  if (player && player.heatLevel >= 2 && safety > 0) {
    return "Best fit at high heat; strongest detection safety.";
  }
  if (player && player.inPvpArena && safety > 0) {
    return "Best fit during PvP windows for stealth safety.";
  }
  if (player && player.data < 45 && dataBonus > 0) {
    return "Best fit while data is low; improves data gain.";
  }
  if (player && player.heatLevel <= 1 && hack > 0) {
    return "Best fit for current PvE pacing and success rate.";
  }
  if (hack > 0 && safety > 0) {
    return "Balanced value across offense and stealth.";
  }
  if (hack > 0) {
    return "Highest immediate hack-power throughput.";
  }
  if (dataBonus > 0) {
    return "Strongest data-yield acceleration right now.";
  }
  if (safety > 0) {
    return "Safest choice for lowering detection pressure.";
  }
  return protocol.recommendationReason ?? "Strong all-around value right now.";
}

function scoreProtocol(
  protocol: DataVaultProtocolDefinition,
  player: Player,
  shortfall: { credits: number; data: number; affordable: boolean }
): number {
  const hack = protocol.buffs.hackPower ?? 0;
  const stealth = protocol.buffs.stealth ?? 0;
  const detectionReduction = protocol.buffs.detectionReduction ?? 0;
  const dataBonus = protocol.buffs.dataBonus ?? 0;
  const safety = stealth + detectionReduction;

  const hackWeight = player.heatLevel >= 2 ? 0.9 : 1.9;
  const safetyWeight = player.heatLevel >= 2 ? 2.2 : player.heatLevel === 1 ? 1.5 : 0.8;
  const dataWeight = player.data < 45 ? 2.2 : 1.2;

  let score = hack * hackWeight + safety * safetyWeight + dataBonus * dataWeight;

  if (hack > 0 && safety > 0) {
    score += 2;
  }
  if (player.inPvpArena && safety > 0) {
    score += 3;
  }

  const creditCostWeight = player.credits < 30 ? 0.17 : 0.1;
  const dataCostWeight = player.data < 50 ? 0.15 : 0.08;
  score -= protocol.costs.credits * creditCostWeight;
  score -= protocol.costs.data * dataCostWeight;

  if (!shortfall.affordable) {
    score -= 40 + shortfall.credits + shortfall.data;
  }

  return score;
}

function buildProtocolRecommendation(
  protocols: DataVaultProtocolDefinition[],
  player: Player | null
): ProtocolRecommendation {
  if (protocols.length === 0) {
    return { recommendedId: null, reasonsById: {}, hintsById: {} };
  }

  const reasonsById = Object.fromEntries(
    protocols.map((protocol) => {
      const shortfall = getShortfall(player, protocol);
      return [protocol.id, getRecommendationReason(protocol, player, shortfall)];
    })
  );
  const hintsById = Object.fromEntries(protocols.map((protocol) => [protocol.id, getProtocolHint(protocol)]));

  if (!player) {
    const fallback = protocols.find((protocol) => protocol.recommended)?.id ?? protocols[0]?.id ?? null;
    return { recommendedId: fallback, reasonsById, hintsById };
  }

  const ranked = protocols.map((protocol) => {
    const shortfall = getShortfall(player, protocol);
    return {
      protocol,
      shortfall,
      score: scoreProtocol(protocol, player, shortfall),
      deficit: shortfall.credits + shortfall.data,
    };
  });

  const affordable = ranked.filter((entry) => entry.shortfall.affordable);
  const pool = affordable.length > 0 ? affordable : ranked;
  const sorted = [...pool].sort((a, b) => {
    if (affordable.length === 0 && a.deficit !== b.deficit) {
      return a.deficit - b.deficit;
    }
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return a.protocol.id.localeCompare(b.protocol.id);
  });

  return {
    recommendedId: sorted[0]?.protocol.id ?? null,
    reasonsById,
    hintsById,
  };
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
  const protocolRecommendation = useMemo(
    () => buildProtocolRecommendation(status?.protocols ?? [], player),
    [status?.protocols, player]
  );
  const recommendationContext = useMemo(() => {
    if (!protocolRecommendation.recommendedId) return "";
    if (dailyLimitReached) return "Daily cap reached; recommendation is precomputed for next UTC reset.";
    if (hasActiveProtocol) return "Current recommendation applies to your next activation after the active protocol ends.";
    if (isCoolingDown) return "Current recommendation applies once cooldown ends.";
    return "Recommendation updates dynamically from your heat level and current credits/data.";
  }, [protocolRecommendation.recommendedId, dailyLimitReached, hasActiveProtocol, isCoolingDown]);

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
        {recommendationContext && (
          <div className="text-[11px] text-cyber-cyan/90">
            {recommendationContext}
          </div>
        )}

        {error && (
          <div className="text-cyber-red text-xs p-2 border border-cyber-red/20 rounded">
            {error}
          </div>
        )}

        {loading && !status ? (
          <div className="text-text-muted text-sm text-center py-6">Loading Data Vault...</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3 auto-rows-fr items-stretch">
            {(status?.protocols ?? []).map((protocol) => {
              const hasResources = !!player
                && player.credits >= protocol.costs.credits
                && player.data >= protocol.costs.data;
              const shortfall = getShortfall(player, protocol);
              const blocked = isActivatingAny
                || hasActiveProtocol
                || isCoolingDown
                || dailyLimitReached
                || !hasResources;
              const isRecommended = protocol.id === protocolRecommendation.recommendedId;
              const recommendationReason = protocolRecommendation.reasonsById[protocol.id] ?? "";
              const usageHint = protocolRecommendation.hintsById[protocol.id] ?? "";
              const shortageLine = !shortfall.affordable
                ? `Need +${shortfall.credits} credits / +${shortfall.data} data`
                : "";
              return (
                <div
                  key={protocol.id}
                  className="border border-border-default rounded-lg p-3 bg-bg-elevated h-full flex flex-col"
                >
                  <div className="space-y-2">
                    <div className="min-h-[70px]">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-text-primary text-sm font-semibold">{protocol.name}</div>
                          <div className="text-[10px] text-text-muted mt-1">{protocol.description}</div>
                        </div>
                        {isRecommended && (
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-cyber-cyan/40 text-cyber-cyan">
                            Recommended
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-[10px] min-h-[30px] leading-relaxed">
                      {isRecommended ? (
                        <span className="text-cyber-cyan/90">Why now: {recommendationReason}</span>
                      ) : (
                        <span className="text-text-muted">Use case: {usageHint}</span>
                      )}
                    </div>

                    <div className="text-[10px] text-cyber-green flex items-center gap-1">
                      <Shield size={10} />
                      {formatBuffs(protocol)}
                    </div>

                    <div className="text-[10px] text-text-muted">
                      Duration: {Math.round(protocol.durationSeconds / 60)}m
                    </div>

                    <div className="text-[10px] min-h-[16px] text-cyber-amber/90">
                      {shortageLine}
                    </div>

                    <div className="text-[10px]">
                      <ResourceCost
                        costs={protocol.costs}
                        available={player ? { credits: player.credits, data: player.data } : undefined}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => handleActivate(protocol.id)}
                    disabled={blocked || activating === protocol.id}
                    className="w-full py-2 min-h-[44px] text-xs border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-auto"
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
