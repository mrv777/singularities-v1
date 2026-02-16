import { Modal } from "@/components/Modal";
import { useUIStore } from "@/stores/ui";
import { useGameStore } from "@/stores/game";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import { DAY_PHASE_HOURS } from "@singularities/shared";
import { OpponentCard } from "./OpponentCard";
import { CombatResultDisplay } from "./CombatResultDisplay";
import { useState, useEffect } from "react";
import { Shield, Clock, ScrollText } from "lucide-react";

type Tab = "arena" | "logs";

export function ArenaModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const { player, setPlayer } = useAuthStore();
  const {
    arenaOpponents,
    setArenaOpponents,
    combatResult,
    setCombatResult,
    combatLogs,
    setCombatLogs,
    isAttacking,
    setIsAttacking,
    isEnteringArena,
    setIsEnteringArena,
  } = useGameStore();

  const [tab, setTab] = useState<Tab>("arena");
  const [error, setError] = useState("");
  const open = activeModal === "pvp_arena";

  useEffect(() => {
    if (open) {
      setError("");
      setCombatResult(null);
      api.getArenaOpponents().then((r) => setArenaOpponents(r.opponents)).catch(() => {});
      api.getCombatLogs().then((r) => setCombatLogs(r.logs)).catch(() => {});
    }
  }, [open, setArenaOpponents, setCombatResult, setCombatLogs]);

  const isPvpTime = (() => {
    const hour = new Date().getUTCHours();
    return hour >= DAY_PHASE_HOURS.pvp.start && hour < DAY_PHASE_HOURS.pvp.end;
  })();

  const handleEnterArena = async () => {
    setIsEnteringArena(true);
    setError("");
    try {
      const result = await api.enterArena();
      setPlayer(result.player);
      const opponents = await api.getArenaOpponents();
      setArenaOpponents(opponents.opponents);
    } catch (err: any) {
      setError(err.message ?? "Failed to enter arena");
    } finally {
      setIsEnteringArena(false);
    }
  };

  const handleAttack = async (targetId: string) => {
    setIsAttacking(true);
    setError("");
    try {
      const result = await api.attackPlayer({ targetId });
      setCombatResult(result);
      setPlayer(result.player);
    } catch (err: any) {
      setError(err.message ?? "Attack failed");
    } finally {
      setIsAttacking(false);
    }
  };

  const handleCombatClose = () => {
    setCombatResult(null);
    // Refresh opponents after combat
    api.getArenaOpponents().then((r) => setArenaOpponents(r.opponents)).catch(() => {});
    api.getCombatLogs().then((r) => setCombatLogs(r.logs)).catch(() => {});
  };

  return (
    <Modal open={open} onClose={closeModal} title="PVP ARENA">
      <div className="space-y-4">
        {/* PvP Phase Indicator */}
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded border ${
          isPvpTime
            ? "border-cyber-red/30 bg-cyber-red/5 text-cyber-red"
            : "border-border-default bg-bg-secondary text-text-muted"
        }`}>
          <Clock size={12} />
          <span>
            {isPvpTime
              ? `PVP ACTIVE (${DAY_PHASE_HOURS.pvp.start}:00 - ${DAY_PHASE_HOURS.pvp.end}:00 UTC)`
              : `PVP OFFLINE — Opens at ${DAY_PHASE_HOURS.pvp.start}:00 UTC`
            }
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border-default">
          <button
            onClick={() => setTab("arena")}
            className={`px-3 py-1.5 text-xs transition-colors ${
              tab === "arena" ? "text-cyber-cyan border-b border-cyber-cyan" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <Shield size={11} className="inline mr-1" />
            Arena
          </button>
          <button
            onClick={() => setTab("logs")}
            className={`px-3 py-1.5 text-xs transition-colors ${
              tab === "logs" ? "text-cyber-cyan border-b border-cyber-cyan" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <ScrollText size={11} className="inline mr-1" />
            Combat Logs
          </button>
        </div>

        {error && (
          <div className="text-cyber-red text-xs px-2">{error}</div>
        )}

        {/* Combat Result Overlay */}
        {combatResult && tab === "arena" && (
          <CombatResultDisplay result={combatResult} onClose={handleCombatClose} />
        )}

        {/* Arena Tab */}
        {tab === "arena" && !combatResult && (
          <>
            {!player?.inPvpArena ? (
              <div className="text-center space-y-3">
                <p className="text-text-secondary text-xs">
                  Enter the arena to find opponents and engage in PvP combat. Costs 25 energy per attack.
                </p>
                <button
                  onClick={handleEnterArena}
                  disabled={isEnteringArena || !isPvpTime}
                  className="px-6 py-2 border border-cyber-red text-cyber-red rounded hover:bg-cyber-red/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                >
                  {isEnteringArena ? "Entering..." : "ENTER ARENA"}
                </button>
              </div>
            ) : arenaOpponents.length === 0 ? (
              <div className="text-center text-text-muted text-xs py-4">
                No opponents available in your level range. Check back later.
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-text-muted text-[10px]">
                  {arenaOpponents.length} opponent(s) available
                </p>
                {arenaOpponents.map((opp) => (
                  <OpponentCard
                    key={opp.id}
                    opponent={opp}
                    onAttack={handleAttack}
                    isAttacking={isAttacking}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Logs Tab */}
        {tab === "logs" && (
          <div className="space-y-2">
            {combatLogs.length === 0 ? (
              <div className="text-center text-text-muted text-xs py-4">
                No combat history yet.
              </div>
            ) : (
              combatLogs.map((log) => {
                const isAttacker = log.attackerId === player?.id;
                const won =
                  (isAttacker && log.result === "attacker_win") ||
                  (!isAttacker && log.result === "defender_win");
                return (
                  <div
                    key={log.id}
                    className={`border rounded p-2 text-xs ${
                      won
                        ? "border-cyber-green/30 bg-cyber-green/5"
                        : "border-cyber-red/30 bg-cyber-red/5"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={won ? "text-cyber-green" : "text-cyber-red"}>
                        {won ? "WIN" : "LOSS"} — {isAttacker ? "Attacked" : "Defended"}
                      </span>
                      <span className="text-text-muted text-[10px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-text-muted mt-1">
                      {log.creditsTransferred > 0 && <span className="mr-2">+{log.creditsTransferred} CR</span>}
                      {log.reputationChange > 0 && <span>+{log.reputationChange} REP</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
