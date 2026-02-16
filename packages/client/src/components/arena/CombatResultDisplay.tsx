import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { ArenaAttackResponse } from "@singularities/shared";

interface CombatResultDisplayProps {
  result: ArenaAttackResponse;
  onClose: () => void;
}

export function CombatResultDisplay({ result, onClose }: CombatResultDisplayProps) {
  const [visibleLines, setVisibleLines] = useState(0);
  const won = result.result === "attacker_win";

  useEffect(() => {
    if (visibleLines < result.narrative.length) {
      const timer = setTimeout(() => {
        setVisibleLines((prev) => prev + 1);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [visibleLines, result.narrative.length]);

  return (
    <div className="space-y-4">
      {/* Narrative */}
      <div className="bg-bg-primary border border-border-default rounded p-3 font-mono text-[11px] space-y-1 max-h-64 overflow-y-auto">
        {result.narrative.slice(0, visibleLines).map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className={
              line.includes("RESULT:")
                ? won
                  ? "text-cyber-green font-bold"
                  : "text-cyber-red font-bold"
                : line.includes("IMPACT:")
                  ? "text-cyber-yellow"
                  : line.includes("BLOCKED:")
                    ? "text-cyber-cyan"
                    : "text-text-secondary"
            }
          >
            {line}
          </motion.div>
        ))}
        {visibleLines < result.narrative.length && (
          <span className="text-text-muted animate-pulse">_</span>
        )}
      </div>

      {/* Outcome Summary */}
      {visibleLines >= result.narrative.length && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div
            className={`text-center py-2 rounded border ${
              won
                ? "border-cyber-green/50 bg-cyber-green/5 text-cyber-green"
                : "border-cyber-red/50 bg-cyber-red/5 text-cyber-red"
            }`}
          >
            <span className="text-sm font-bold">
              {won ? "VICTORY" : "DEFEAT"}
            </span>
          </div>

          {result.rewards && (
            <div className="flex gap-3 justify-center text-xs">
              <span className="text-cyber-yellow">+{result.rewards.credits} CR</span>
              <span className="text-cyber-purple">+{result.rewards.reputation} REP</span>
              <span className="text-cyber-cyan">+{result.rewards.xp} XP</span>
            </div>
          )}

          {result.damage && (
            <div className="text-xs text-cyber-red text-center">
              Damage: {result.damage.systems.map((d) => `${d.systemType} -${d.damage}HP`).join(", ")}
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full py-2 border border-border-default text-text-secondary rounded hover:border-cyber-cyan hover:text-cyber-cyan transition-colors text-xs"
          >
            Close
          </button>
        </motion.div>
      )}
    </div>
  );
}
