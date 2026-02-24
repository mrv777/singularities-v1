import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ArenaAttackResponse } from "@singularities/shared";
import { ResourceCost } from "../ui/ResourceCost";
import { playSound } from "@/lib/sound";
import { useGameFeedback } from "@/hooks/useGameFeedback";

interface CombatResultDisplayProps {
  result: ArenaAttackResponse;
  onClose: () => void;
}

export function CombatResultDisplay({ result, onClose }: CombatResultDisplayProps) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [showFlash, setShowFlash] = useState(true);
  const won = result.result === "attacker_win";
  const { triggerShake, emitFloatNumber, emitParticleBurst } = useGameFeedback();

  useEffect(() => {
    playSound(won ? "pvpWin" : "pvpLoss");
    triggerShake(won ? "subtle" : "dramatic");
    emitParticleBurst(
      undefined,
      won ? "var(--color-cyber-green)" : "var(--color-cyber-red)"
    );
    if (result.rewards?.credits) {
      const prefix = won ? "+" : "";
      emitFloatNumber(
        `${prefix}${result.rewards.credits} CR`,
        won ? "green" : "amber"
      );
    }
    const flashTimer = setTimeout(() => setShowFlash(false), 300);
    return () => clearTimeout(flashTimer);
  }, [won, triggerShake, emitFloatNumber, emitParticleBurst, result.rewards?.credits]);

  useEffect(() => {
    if (visibleLines < result.narrative.length) {
      const timer = setTimeout(() => {
        setVisibleLines((prev) => prev + 1);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [visibleLines, result.narrative.length]);

  return (
    <div className="space-y-4 relative">
      {/* Flash overlay */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-10 rounded pointer-events-none"
            style={{
              backgroundColor: won
                ? "rgba(0, 255, 136, 0.15)"
                : "rgba(255, 51, 51, 0.15)",
            }}
          />
        )}
      </AnimatePresence>

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
            <div className="flex gap-3 justify-center text-xs flex-wrap">
              <ResourceCost costs={{ credits: result.rewards.credits }} prefix="+" />
              <ResourceCost costs={{ reputation: result.rewards.reputation }} prefix="+" />
              <ResourceCost costs={{ xp: result.rewards.xp }} prefix="+" />
            </div>
          )}

          {result.damage && (
            <div className="text-xs text-cyber-red text-center">
              Damage: {result.damage.systems.map((d) => `${d.systemType} -${d.damage}HP`).join(", ")}
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full py-2 min-h-[44px] border border-border-default text-text-secondary rounded hover:border-cyber-cyan hover:text-cyber-cyan transition-colors text-xs"
          >
            Close
          </button>
        </motion.div>
      )}
    </div>
  );
}
