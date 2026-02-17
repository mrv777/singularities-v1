import { useAuthStore } from "@/stores/auth";
import { ALIGNMENT_THRESHOLDS } from "@singularities/shared";

export function AlignmentIndicator() {
  const player = useAuthStore((s) => s.player);
  if (!player) return null;

  const alignment = player.alignment;
  const label =
    alignment >= ALIGNMENT_THRESHOLDS.extreme
      ? "Benevolent"
      : alignment <= -ALIGNMENT_THRESHOLDS.extreme
        ? "Domination"
        : alignment > 0.3
          ? "Cooperative"
          : alignment < -0.3
            ? "Aggressive"
            : "Neutral";

  const color =
    alignment >= ALIGNMENT_THRESHOLDS.extreme
      ? "text-cyber-green"
      : alignment <= -ALIGNMENT_THRESHOLDS.extreme
        ? "text-cyber-red"
        : alignment > 0
          ? "text-text-secondary"
          : alignment < 0
            ? "text-text-secondary"
            : "text-text-muted";

  // Visual bar: -1 to 1 mapped to 0% to 100%
  const percent = ((alignment + 1) / 2) * 100;

  return (
    <div className="flex items-center gap-1.5" title={`Alignment: ${alignment.toFixed(2)} (${label})`}>
      <span className="text-[10px] text-text-muted">ALN</span>
      <div className="w-12 h-1.5 bg-bg-primary rounded-full overflow-hidden relative">
        <div className="absolute inset-0 flex">
          <div className="w-1/2 bg-gradient-to-r from-cyber-red/20 to-transparent" />
          <div className="w-1/2 bg-gradient-to-l from-cyber-green/20 to-transparent" />
        </div>
        <div
          className="absolute top-0 h-full w-1 bg-text-primary rounded-full transition-all"
          style={{ left: `calc(${Math.max(0, Math.min(100, percent))}% - 2px)` }}
        />
      </div>
      <span className={`text-[10px] ${color}`}>{label}</span>
    </div>
  );
}
