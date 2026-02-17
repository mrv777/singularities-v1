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
    <div className="flex items-center gap-2 group cursor-help" title={`Alignment: ${alignment.toFixed(2)} (${label})`}>
      <div className="flex flex-col items-end">
        <span className={`text-[10px] font-bold leading-none ${color} uppercase tracking-tighter`}>{label}</span>
        <span className="text-[7px] text-text-muted mt-0.5 font-mono">ALIGN_IDX</span>
      </div>
      <div className="w-10 h-1.5 bg-bg-primary/50 rounded-full overflow-hidden relative border border-white/5">
        <div className="absolute inset-0 flex">
          <div className="w-1/2 bg-gradient-to-r from-cyber-red/30 to-transparent" />
          <div className="w-1/2 bg-gradient-to-l from-cyber-green/30 to-transparent" />
        </div>
        <div
          className="absolute top-0 h-full w-1 bg-text-primary shadow-[0_0_5px_white] rounded-full transition-all"
          style={{ left: `calc(${Math.max(0, Math.min(100, percent))}% - 2px)` }}
        />
      </div>
    </div>
  );
}
