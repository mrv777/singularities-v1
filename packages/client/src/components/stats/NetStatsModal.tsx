import { Modal } from "@/components/Modal";
import { useUIStore } from "@/stores/ui";
import { usePlayer } from "@/hooks/usePlayer";
import { useAuthStore } from "@/stores/auth";
import { TRAIT_MAP, getXPForNextLevel } from "@singularities/shared";
import type { NetworkStats, SeasonLeaderboardEntry } from "@singularities/shared";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";

export function NetStatsModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const { data } = usePlayer();
  const currentPlayer = useAuthStore((s) => s.player);

  const [netStats, setNetStats] = useState<NetworkStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<SeasonLeaderboardEntry[]>([]);
  const [playerRank, setPlayerRank] = useState<number | null>(null);

  const open = activeModal === "network_stats";

  useEffect(() => {
    if (open) {
      api.getNetworkStats().then((r) => setNetStats(r.stats)).catch(() => {});
      api.getSeasonLeaderboard().then((r) => {
        setLeaderboard(r.leaderboard);
        setPlayerRank(r.playerRank);
      }).catch(() => {});
    }
  }, [open]);

  if (!open || !data) return null;

  const { player, traits, passiveIncome } = data;

  const alignmentLabel =
    player.alignment > 0.3
      ? "Benevolent"
      : player.alignment < -0.3
        ? "Domination"
        : "Neutral";

  const alignmentColor =
    player.alignment > 0.3
      ? "text-cyber-green"
      : player.alignment < -0.3
        ? "text-cyber-red"
        : "text-text-secondary";

  return (
    <Modal open={open} onClose={closeModal} title="NETWORK STATS">
      <div className="space-y-5">
        {/* Core Stats */}
        <section>
          <h3 className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
            Core Stats
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Stat label="Level" value={player.level} />
            <Stat label="XP" value={`${player.xp} / ${getXPForNextLevel(player.level) ?? "MAX"}`} />
            <Stat label="Credits" value={player.credits} color="text-cyber-green" />
            <Stat label="Data" value={player.data} color="text-cyber-cyan" />
            <Stat label="Processing Power" value={player.processingPower} color="text-cyber-magenta" />
            <Stat label="Reputation" value={player.reputation} />
            <Stat label="Alignment" value={alignmentLabel} color={alignmentColor} />
            <Stat label="Heat Level" value={player.heatLevel} color={player.heatLevel > 50 ? "text-cyber-red" : "text-text-primary"} />
          </div>
        </section>

        {/* Status */}
        <section>
          <h3 className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
            Status
          </h3>
          <div className="flex flex-wrap gap-2 text-xs">
            {player.isInSandbox ? (
              <Badge label="SANDBOX" color="border-cyber-amber text-cyber-amber" />
            ) : (
              <Badge label="LIVE" color="border-cyber-green text-cyber-green" />
            )}
            {player.inPvpArena && (
              <Badge label="IN ARENA" color="border-cyber-red text-cyber-red" />
            )}
            {player.isAlive ? (
              <Badge label="ALIVE" color="border-cyber-green text-cyber-green" />
            ) : (
              <Badge label="DEAD" color="border-cyber-red text-cyber-red" />
            )}
          </div>
        </section>

        {/* Genetic Traits */}
        {traits.length > 0 && (
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
              Genetic Traits
            </h3>
            <div className="space-y-1">
              {traits.map((t) => {
                const def = TRAIT_MAP[t.traitId];
                if (!def) return null;
                return (
                  <div
                    key={t.id}
                    className="border border-border-default rounded px-2 py-1.5 text-xs"
                  >
                    <div className="text-cyber-magenta font-semibold">
                      {def.name}
                    </div>
                    <div className="text-text-muted text-[10px]">
                      {def.description}
                    </div>
                    <div className="flex gap-3 mt-0.5 text-[10px]">
                      <span className="text-cyber-green">
                        +{Math.round(def.positive.modifier * 100)}% {def.positive.stat}
                      </span>
                      <span className="text-cyber-red">
                        {Math.round(def.negative.modifier * 100)}% {def.negative.stat}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Passive Income */}
        {passiveIncome && (
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
              Passive Income (per cycle)
            </h3>
            <div className="flex gap-4 text-xs">
              <span className="text-cyber-green">+{passiveIncome.credits} CR</span>
              <span className="text-cyber-cyan">+{passiveIncome.data} DATA</span>
            </div>
          </section>
        )}

        {/* Network Stats */}
        {netStats && (
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
              Network Activity
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="Total AIs" value={netStats.totalPlayers} />
              <Stat label="Active (24h)" value={netStats.activePlayers} />
              <Stat label="Hacks Today" value={netStats.hacksToday} color="text-cyber-green" />
              <Stat label="PvP Battles" value={netStats.pvpBattlesToday} color="text-cyber-red" />
            </div>
          </section>
        )}

        {/* Season Info */}
        {netStats?.season && (
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
              Season
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="Name" value={netStats.season.name} color="text-cyber-amber" />
              <Stat
                label="Days Left"
                value={Math.max(0, Math.ceil((new Date(netStats.season.endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}
              />
              {playerRank && <Stat label="Your Rank" value={`#${playerRank}`} color="text-cyber-cyan" />}
            </div>
          </section>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
              Leaderboard (Top 20)
            </h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {leaderboard.map((entry) => (
                <div
                  key={entry.playerId}
                  className={`flex items-center justify-between text-xs border rounded px-2 py-1.5 ${
                    entry.playerId === currentPlayer?.id
                      ? "border-cyber-cyan/30 bg-cyber-cyan/5"
                      : "border-border-default"
                  }`}
                >
                  <span className="text-text-muted w-6">#{entry.rank}</span>
                  <span className="text-text-primary flex-1 truncate">{entry.aiName}</span>
                  <span className="text-text-muted">LV{entry.level}</span>
                  <span className="text-cyber-amber ml-2">{entry.reputation} REP</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="border border-border-default rounded px-2 py-1.5">
      <div className="text-text-muted text-[10px]">{label}</div>
      <div className={`font-semibold ${color ?? "text-text-primary"}`}>{value}</div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`border rounded px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {label}
    </span>
  );
}
