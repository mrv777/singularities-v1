import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playSound } from "@/lib/sound";
import { useAuthStore } from "@/stores/auth";

interface BootSequenceProps {
  onComplete: () => void;
}

const SYSTEM_CHECKS = [
  "Neural core initialization",
  "Memory bank allocation",
  "Quantum processor calibration",
  "Security protocol deployment",
  "Data pathway synchronization",
  "Energy distribution matrix",
];

export function BootSequence({ onComplete }: BootSequenceProps) {
  const aiName = useAuthStore((s) => s.player?.aiName) ?? "UNKNOWN";
  const [phase, setPhase] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);
  const [checksComplete, setChecksComplete] = useState(0);
  const [fading, setFading] = useState(false);

  const finish = useCallback(() => {
    setFading(true);
    setTimeout(onComplete, 600);
  }, [onComplete]);

  // Phase progression
  useEffect(() => {
    if (fading) return;

    if (phase === 0) {
      // Phase 1: OS title + AI name (2s)
      const t1 = setTimeout(() => { playSound("scan"); setVisibleLines(1); }, 300);
      const t2 = setTimeout(() => setVisibleLines(2), 800);
      const t3 = setTimeout(() => { playSound("click"); setVisibleLines(3); }, 1400);
      const t4 = setTimeout(() => setPhase(1), 2000);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }

    if (phase === 1) {
      // Phase 2: System checks animate in with [OK] (3s)
      const timers: ReturnType<typeof setTimeout>[] = [];
      SYSTEM_CHECKS.forEach((_, i) => {
        timers.push(setTimeout(() => {
          playSound("click");
          setChecksComplete(i + 1);
        }, (i + 1) * 450));
      });
      timers.push(setTimeout(() => setPhase(2), SYSTEM_CHECKS.length * 450 + 400));
      return () => timers.forEach(clearTimeout);
    }

    if (phase === 2) {
      // Phase 3: Resource summary + sandbox mode (2s)
      const t = setTimeout(() => setPhase(3), 2000);
      return () => clearTimeout(t);
    }

    if (phase === 3) {
      // Phase 4: "ENTERING NETWORK..." + fade out (1.5s)
      playSound("scan");
      const t = setTimeout(finish, 1500);
      return () => clearTimeout(t);
    }
  }, [phase, fading, finish]);

  return (
    <AnimatePresence>
      {!fading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[55] bg-black flex flex-col items-center justify-center p-6"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <div className="w-full max-w-lg space-y-1 text-[13px] leading-relaxed">
            {/* Phase 1: Title */}
            {phase >= 0 && visibleLines >= 1 && (
              <TermLine delay={0}>
                <span className="text-cyber-cyan">SINGULARITIES OS</span> <span className="text-text-muted">v3.7.1</span>
              </TermLine>
            )}
            {phase >= 0 && visibleLines >= 2 && (
              <TermLine delay={0.1}>
                <span className="text-text-secondary">Initializing AI construct...</span>
              </TermLine>
            )}
            {phase >= 0 && visibleLines >= 3 && (
              <TermLine delay={0.15}>
                <span className="text-text-muted">&gt; Designation: </span>
                <span className="text-cyber-green font-bold">{aiName}</span>
              </TermLine>
            )}

            {/* Phase 2: System checks */}
            {phase >= 1 && (
              <div className="mt-3 space-y-0.5">
                {SYSTEM_CHECKS.map((label, i) => (
                  i < checksComplete && (
                    <TermLine key={label} delay={0}>
                      <span className="text-cyber-green">[OK]</span>{" "}
                      <span className="text-text-secondary">{label}</span>
                    </TermLine>
                  )
                ))}
              </div>
            )}

            {/* Phase 3: Resources */}
            {phase >= 2 && (
              <div className="mt-3 space-y-0.5">
                <TermLine delay={0.1}>
                  <span className="text-text-muted">&gt; Credits: </span>
                  <span className="text-cyber-cyan">100</span>
                  <span className="text-text-muted ml-4">Data: </span>
                  <span className="text-cyber-cyan">50</span>
                  <span className="text-text-muted ml-4">Energy: </span>
                  <span className="text-cyber-cyan">100</span>
                </TermLine>
                <TermLine delay={0.3}>
                  <span className="text-cyber-yellow font-bold">SANDBOX MODE: ACTIVE</span>
                </TermLine>
              </div>
            )}

            {/* Phase 4: Entering */}
            {phase >= 3 && (
              <div className="mt-4">
                <TermLine delay={0.1}>
                  <span className="text-cyber-cyan font-bold animate-pulse">ENTERING NETWORK...</span>
                </TermLine>
              </div>
            )}
          </div>

          {/* Skip button */}
          <button
            onClick={finish}
            className="absolute bottom-6 right-6 text-text-muted text-xs hover:text-text-secondary transition-colors tracking-wider"
          >
            SKIP &gt;&gt;
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[55] bg-black"
        />
      )}
    </AnimatePresence>
  );
}

function TermLine({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay }}
    >
      {children}
    </motion.div>
  );
}
