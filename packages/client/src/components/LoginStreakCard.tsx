import { LOGIN_STREAK_REWARDS, type StreakReward } from "@singularities/shared";
import { usePlayer } from "@/hooks/usePlayer";
import { Flame } from "lucide-react";

function formatReward(reward: StreakReward): string {
  const parts: string[] = [];
  if (reward.credits > 0) parts.push(`+${reward.credits} CR`);
  if (reward.data > 0) parts.push(`+${reward.data} DATA`);
  if (reward.processingPower > 0) parts.push(`+${reward.processingPower} PP`);
  return parts.join(", ");
}

export function LoginStreakCard() {
  const { data } = usePlayer();
  if (!data) return null;

  const { player, passiveIncome } = data;
  const streak = player.loginStreak;
  const streakReward = passiveIncome?.streakReward ?? null;

  // Don't show if streak is 0 (never logged in) and no reward was just claimed
  if (streak === 0 && !streakReward) return null;

  const currentDayIndex = streak > 0 ? (streak - 1) % LOGIN_STREAK_REWARDS.length : 0;

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex items-center gap-3 px-3 py-2 rounded border border-cyber-amber/20 bg-cyber-amber/5 text-xs">
        <Flame size={14} className="text-cyber-amber shrink-0" />
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-cyber-amber font-semibold shrink-0">
            {streak} day streak
          </span>
          {streakReward ? (
            <span className="text-cyber-green">
              Claimed: {formatReward(streakReward)}
            </span>
          ) : (
            <span className="text-text-muted">
              Today: {formatReward(LOGIN_STREAK_REWARDS[currentDayIndex])}
            </span>
          )}
          <span className="text-text-muted/60 hidden sm:inline">
            | Next: {[1, 2, 3].map((offset) => {
              const idx = (currentDayIndex + offset) % LOGIN_STREAK_REWARDS.length;
              return (
                <span key={idx} className="mx-0.5">
                  D{((streak + offset - 1) % 7) + 1}: {formatReward(LOGIN_STREAK_REWARDS[idx])}
                </span>
              );
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
