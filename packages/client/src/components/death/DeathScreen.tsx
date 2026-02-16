import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { SYSTEM_LABELS, type SystemType, SYSTEM_TYPES } from "@singularities/shared";

interface DeathScreenProps {
  aiName: string;
  onRestart: () => void;
}

export function DeathScreen({ aiName, onRestart }: DeathScreenProps) {
  const [phase, setPhase] = useState(0);
  // Phase 0: System shutdown sequence
  // Phase 1: Death message
  // Phase 2: Restart prompt

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), SYSTEM_TYPES.length * 500 + 500);
    const t2 = setTimeout(() => setPhase(2), SYSTEM_TYPES.length * 500 + 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] bg-[#050508] flex items-center justify-center"
    >
      <div className="max-w-md w-full px-6 space-y-6">
        {/* System shutdown sequence */}
        <div className="space-y-1 font-mono text-xs">
          {SYSTEM_TYPES.map((sys, i) => (
            <motion.div
              key={sys}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.5, duration: 0.3 }}
              className="flex items-center gap-2"
            >
              <span className="text-cyber-red">
                [OFFLINE]
              </span>
              <span className="text-text-muted">
                {SYSTEM_LABELS[sys as SystemType]} — SHUTDOWN
              </span>
            </motion.div>
          ))}
        </div>

        {/* Death message */}
        {phase >= 1 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-2"
          >
            <div className="text-cyber-red text-lg font-bold tracking-widest glitch-text">
              3 SYSTEMS CORRUPTED
            </div>
            <div className="text-cyber-red text-sm">
              AI TERMINATED
            </div>
            <div className="text-text-muted text-xs mt-2">
              {aiName} has been irreversibly corrupted.
            </div>
          </motion.div>
        )}

        {/* Restart prompt */}
        {phase >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center space-y-4"
          >
            <div className="border border-border-default bg-bg-surface rounded p-4 space-y-2">
              <p className="text-text-secondary text-xs">
                Your highest-level module has been preserved. Some additional modules may have survived.
              </p>
              <p className="text-cyber-purple text-xs">
                Rebirth grants genetic traits — permanent mutations that shape your next iteration.
              </p>
            </div>

            <button
              onClick={onRestart}
              className="px-8 py-3 border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors text-sm font-semibold tracking-wider"
            >
              MINT NEW AI
            </button>
          </motion.div>
        )}
      </div>

      {/* Background glitch effect */}
      <style>{`
        .glitch-text {
          animation: glitch 1s ease-in-out infinite alternate;
        }
        @keyframes glitch {
          0%, 100% { text-shadow: 2px 0 #ff0040, -2px 0 #0ff; }
          25% { text-shadow: -2px 0 #ff0040, 2px 0 #0ff; }
          50% { text-shadow: 2px 2px #ff0040, -2px -2px #0ff; }
          75% { text-shadow: -2px 2px #ff0040, 2px -2px #0ff; }
        }
      `}</style>
    </motion.div>
  );
}
