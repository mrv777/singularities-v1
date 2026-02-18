import { motion } from "framer-motion";

interface ScoreDisplayProps {
  score: number;
}

function getScoreColor(score: number): string {
  if (score >= 75) return "#00ff88";
  if (score >= 50) return "#00ccff";
  if (score >= 25) return "#ffaa00";
  return "#ff3333";
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "PERFECT";
  if (score >= 75) return "EXCELLENT";
  if (score >= 50) return "GOOD";
  if (score >= 25) return "WEAK";
  return "FAILED";
}

export function ScoreDisplay({ score }: ScoreDisplayProps) {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-xs">PERFORMANCE SCORE</span>
        <span className="text-xs font-bold" style={{ color }}>
          {label}
        </span>
      </div>

      {/* Score bar */}
      <div className="relative w-full h-3 bg-bg-primary rounded-full overflow-hidden border border-border-default">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>

      <div className="text-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="text-2xl font-bold font-mono"
          style={{ color }}
        >
          {score}%
        </motion.span>
      </div>
    </div>
  );
}
