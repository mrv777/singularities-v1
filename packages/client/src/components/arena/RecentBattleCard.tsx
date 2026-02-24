import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { Swords } from "lucide-react";

export function RecentBattleCard() {
  const player = useAuthStore((s) => s.player);
  const openModal = useUIStore((s) => s.openModal);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["recentBattle"],
    queryFn: () => api.getCombatLogs(),
    enabled: Boolean(player?.isAlive),
    staleTime: 60_000,
  });

  const latestLog = data?.logs?.[0];
  if (!latestLog || !player) return null;

  const isAttacker = latestLog.attackerId === player.id;
  const won =
    (isAttacker && latestLog.result === "attacker_win") ||
    (!isAttacker && latestLog.result === "defender_win");

  const opponentName =
    latestLog.opponentName ?? latestLog.botProfile?.aiName ?? "Unknown";

  const narrative = latestLog.combatLog?.[0]?.description ?? null;

  const handleViewAll = () => {
    openModal("pvp_arena");
    // Refresh on next render so the arena modal has fresh data
    queryClient.invalidateQueries({ queryKey: ["recentBattle"] });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto"
    >
      <div
        className={`flex items-center gap-3 px-3 py-2 rounded border text-xs cursor-pointer hover:opacity-90 transition-opacity ${
          won
            ? "border-cyber-green/20 bg-cyber-green/5"
            : "border-cyber-red/20 bg-cyber-red/5"
        }`}
        onClick={handleViewAll}
      >
        <Swords size={14} className={won ? "text-cyber-green shrink-0" : "text-cyber-red shrink-0"} />
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className={`font-semibold shrink-0 ${won ? "text-cyber-green" : "text-cyber-red"}`}>
            {won ? "WIN" : "LOSS"}
          </span>
          <span className="text-text-secondary">vs {opponentName}</span>
          {won && latestLog.creditsTransferred > 0 && (
            <span className="text-cyber-green">+{latestLog.creditsTransferred} CR</span>
          )}
          {narrative && (
            <span className="text-text-muted truncate hidden sm:inline">{narrative}</span>
          )}
        </div>
        <span className="text-text-muted/50 text-[10px] ml-auto shrink-0">View all</span>
      </div>
    </motion.div>
  );
}
