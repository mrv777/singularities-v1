import { motion } from "framer-motion";
import type { HackResult as HackResultType } from "@singularities/shared";
import { useEffect, useState } from "react";

interface HackResultProps {
  result: HackResultType;
  onDone: () => void;
}

export function HackResultDisplay({ result, onDone }: HackResultProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [typingDone, setTypingDone] = useState(false);

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
    }, 15);
    return () => clearInterval(timer);
  }, [result.narrative]);

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
          className="grid grid-cols-4 gap-2 text-xs text-center"
        >
          <div className="bg-bg-secondary rounded p-2">
            <div className="text-cyber-amber font-bold">+{result.rewards.credits}</div>
            <div className="text-text-muted">CR</div>
          </div>
          <div className="bg-bg-secondary rounded p-2">
            <div className="text-cyber-green font-bold">+{result.rewards.data}</div>
            <div className="text-text-muted">DATA</div>
          </div>
          <div className="bg-bg-secondary rounded p-2">
            <div className="text-text-primary font-bold">+{result.rewards.reputation}</div>
            <div className="text-text-muted">REP</div>
          </div>
          <div className="bg-bg-secondary rounded p-2">
            <div className="text-cyber-cyan font-bold">+{result.rewards.xp}</div>
            <div className="text-text-muted">XP</div>
          </div>
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
          className="w-full py-2 text-sm border border-border-default rounded hover:border-cyber-cyan hover:text-cyber-cyan transition-colors text-text-secondary"
        >
          Continue
        </motion.button>
      )}
    </div>
  );
}
