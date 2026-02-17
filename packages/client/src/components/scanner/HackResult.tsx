import { motion } from "framer-motion";
import type { HackResult as HackResultType } from "@singularities/shared";
import { Coins, Cpu, Database, Star, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { playSound } from "@/lib/sound";
import { useUITier } from "@/hooks/useUITier";

interface HackResultProps {
  result: HackResultType;
  onDone: () => void;
}

export function HackResultDisplay({ result, onDone }: HackResultProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [typingDone, setTypingDone] = useState(false);
  const { tier } = useUITier();

  // Tier-aware typing speed
  const typingSpeed = tier === 1 ? 8 : tier === 3 ? 20 : 15;

  // Play sound on mount based on result
  useEffect(() => {
    if (result.success) {
      playSound("hackSuccess");
      if (result.levelUp) playSound("levelUp");
    } else if (result.detected) {
      playSound("detection");
    } else {
      playSound("hackFail");
    }
  }, [result.success, result.detected, result.levelUp]);

  useEffect(() => {
    const lines = result.narrative;
    let i = 0;
    const timer = setInterval(() => {
      if (i <= lines.length) {
        setDisplayedText(lines.slice(0, i));
        i++;
      } else {
        clearInterval(timer);
        setTypingDone(true);
      }
    }, typingSpeed);
    return () => clearInterval(timer);
  }, [result.narrative, typingSpeed]);

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`text-center py-3 rounded border ${
          result.success
            ? "border-cyber-green/50 bg-cyber-green/10 text-cyber-green"
            : "border-cyber-red/50 bg-cyber-red/10 text-cyber-red"
        }`}
      >
        <div className="text-lg font-bold">
          {result.success ? "HACK SUCCESSFUL" : "HACK FAILED"}
        </div>
        {result.detected && (
          <div className="text-xs mt-1 text-cyber-red">DETECTED</div>
        )}
      </motion.div>

      {/* Terminal output */}
      <div className="bg-bg-primary border border-border-default rounded p-3 font-mono text-xs leading-relaxed min-h-[100px]">
        <pre className="whitespace-pre-wrap text-cyber-green">
          {displayedText}
          {!typingDone && <span className="animate-pulse">_</span>}
        </pre>
      </div>

      {/* Resource changes */}
      {result.rewards && typingDone && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`grid ${result.rewards.processingPower ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4"} gap-2 text-xs text-center`}
        >
          <div className="bg-bg-secondary rounded p-2 flex flex-col items-center gap-1">
            <Coins size={14} className="text-cyber-amber" />
            <div className="text-cyber-amber font-bold">+{result.rewards.credits}</div>
          </div>
          <div className="bg-bg-secondary rounded p-2 flex flex-col items-center gap-1">
            <Database size={14} className="text-cyber-green" />
            <div className="text-cyber-green font-bold">+{result.rewards.data}</div>
          </div>
          <div className="bg-bg-secondary rounded p-2 flex flex-col items-center gap-1">
            <Star size={14} className="text-text-secondary" />
            <div className="text-text-primary font-bold">+{result.rewards.reputation}</div>
          </div>
          <div className="bg-bg-secondary rounded p-2 flex flex-col items-center gap-1">
            <Trophy size={14} className="text-cyber-cyan" />
            <div className="text-cyber-cyan font-bold">+{result.rewards.xp}</div>
          </div>
          {result.rewards.processingPower ? (
            <div className="bg-bg-secondary rounded p-2 flex flex-col items-center gap-1">
              <Cpu size={14} className="text-cyber-magenta" />
              <div className="text-cyber-magenta font-bold">+{result.rewards.processingPower}</div>
            </div>
          ) : null}
        </motion.div>
      )}

      {/* Damage report */}
      {result.damage && typingDone && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-cyber-red/30 bg-cyber-red/5 rounded p-3"
        >
          <div className="text-cyber-red text-xs font-bold mb-1">DAMAGE REPORT</div>
          {result.damage.systems.map((s, i) => (
            <div key={i} className="text-xs text-text-secondary">
              {s.systemType}: <span className="text-cyber-red">-{s.damage} HP</span>
            </div>
          ))}
        </motion.div>
      )}

      {typingDone && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onDone}
          className="w-full py-2 min-h-[44px] text-sm border border-border-default rounded hover:border-cyber-cyan hover:text-cyber-cyan transition-colors text-text-secondary"
        >
          Continue
        </motion.button>
      )}
    </div>
  );
}
