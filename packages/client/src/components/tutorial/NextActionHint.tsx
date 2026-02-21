import { useState } from "react";
import { useTutorialStore } from "@/stores/tutorial";
import { useAuthStore } from "@/stores/auth";
import { useGameStore } from "@/stores/game";
import { useUIStore } from "@/stores/ui";
import { LEVEL_UNLOCKS } from "@singularities/shared";
import { playSound } from "@/lib/sound";

export function NextActionHint() {
  const step = useTutorialStore((s) => s.step);
  const player = useAuthStore((s) => s.player);
  const systemHealth = useGameStore((s) => s.systemHealthSummary);
  const openModal = useUIStore((s) => s.openModal);
  const [dismissed, setDismissed] = useState(false);

  if (step !== "done" || dismissed || !player) return null;

  const level = player.level;
  let text: string | null = null;
  let action: string | null = null;
  let modalId: string | null = null;

  // Priority: damaged systems > energy full
  if (systemHealth?.worstStatus && systemHealth.worstStatus !== "OPTIMAL") {
    text = "Systems damaged — check health";
    action = "System Health";
    modalId = "system_maintenance";
  } else if (player.energy >= player.energyMax * 0.9 && level >= LEVEL_UNLOCKS.scanner) {
    text = "Energy reserves full — time to scan";
    action = "Scanner";
    modalId = "scanner";
  }

  if (!text) return null;

  const handleClick = () => {
    if (modalId) {
      playSound("click");
      openModal(modalId);
    }
  };

  return (
    <div className="mt-1 flex items-center justify-center gap-2 text-[11px] text-text-muted" style={{ fontFamily: "var(--font-mono)" }}>
      <span>{text}</span>
      {action && (
        <button
          onClick={handleClick}
          className="text-cyber-cyan/70 hover:text-cyber-cyan transition-colors underline underline-offset-2"
        >
          {action}
        </button>
      )}
      <button
        onClick={() => setDismissed(true)}
        className="text-text-muted/50 hover:text-text-muted transition-colors ml-1"
      >
        x
      </button>
    </div>
  );
}
