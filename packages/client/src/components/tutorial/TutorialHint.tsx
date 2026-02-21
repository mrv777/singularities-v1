import { useTutorialStore } from "@/stores/tutorial";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import {
  TUTORIAL_DIRECTIVES,
  TUTORIAL_MODAL,
  type TutorialStep,
} from "@singularities/shared";
import { playSound } from "@/lib/sound";
import { ChevronRight } from "lucide-react";

export function TutorialHint() {
  const step = useTutorialStore((s) => s.step);
  const skipTutorial = useTutorialStore((s) => s.skipTutorial);
  const openModal = useUIStore((s) => s.openModal);
  const playerLevel = useAuthStore((s) => s.player?.level) ?? 1;

  const directive = TUTORIAL_DIRECTIVES[step as TutorialStep];
  if (!directive) return null;

  // Special case: upgrade step but player hasn't reached L2 yet
  const isUpgradeBlocked = step === "upgrade" && playerLevel < 2;

  const modalId = TUTORIAL_MODAL[step as TutorialStep];
  const handleAction = () => {
    if (isUpgradeBlocked) {
      // Open scanner instead — they need to hack more to level up
      playSound("click");
      openModal("scanner");
      return;
    }
    if (modalId) {
      playSound("click");
      openModal(modalId);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded border border-cyber-cyan/40 bg-cyber-cyan/5"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {/* Pulsing left accent */}
        <div className="w-1 h-8 rounded-full bg-cyber-cyan animate-pulse shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-cyber-cyan/60 uppercase tracking-wider mb-0.5">
            Directive
          </div>
          <div className="text-xs text-text-primary truncate">
            {isUpgradeBlocked
              ? "Complete more infiltrations to reach Level 2"
              : directive}
          </div>
        </div>

        <button
          onClick={handleAction}
          className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-[11px] border border-cyber-cyan/50 text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors"
        >
          {isUpgradeBlocked ? "SCAN" : step === "scan" ? "OPEN SCANNER" : step === "hack" ? "OPEN SCANNER" : step === "upgrade" ? "TECH TREE" : step === "equip" ? "LOADOUTS" : "GO"}
          <ChevronRight size={12} />
        </button>

        <button
          onClick={skipTutorial}
          className="shrink-0 text-[10px] text-text-muted hover:text-text-secondary transition-colors"
        >
          SKIP
        </button>
      </div>
    </div>
  );
}
