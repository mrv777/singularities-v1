import { useGameStore } from "@/stores/game";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function DecisionModal() {
  const pendingDecision = useGameStore((s) => s.pendingDecision);
  const decisionResult = useGameStore((s) => s.decisionResult);
  const setPendingDecision = useGameStore((s) => s.setPendingDecision);
  const setDecisionResult = useGameStore((s) => s.setDecisionResult);
  const setPlayer = useAuthStore((s) => s.setPlayer);
  const queryClient = useQueryClient();

  const [choosing, setChoosing] = useState(false);
  const [displayedText, setDisplayedText] = useState("");

  const definition = pendingDecision?.definition;

  // Typing animation for the prompt
  useEffect(() => {
    if (!definition) {
      setDisplayedText("");
      return;
    }
    const text = definition.prompt;
    let i = 0;
    setDisplayedText("");
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [definition]);

  const handleChoice = async (choice: "yes" | "no") => {
    if (!pendingDecision) return;
    setChoosing(true);
    try {
      const result = await api.submitDecision({
        decisionId: pendingDecision.decisionId,
        choice,
      });
      setDecisionResult(result);
      setPlayer(result.player);
      queryClient.invalidateQueries({ queryKey: ["player"] });
    } catch {
      // Dismiss on error
      setPendingDecision(null);
    } finally {
      setChoosing(false);
    }
  };

  const handleDismiss = () => {
    setPendingDecision(null);
    setDecisionResult(null);
  };

  if (!pendingDecision && !decisionResult) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop with glitch effect */}
        <div className="absolute inset-0 bg-[#0a0a0f]/95" />

        <motion.div
          className="relative w-full max-w-lg border border-cyber-magenta/50 bg-bg-surface rounded-lg overflow-hidden"
          initial={{ y: 30, scale: 0.95 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: 30, scale: 0.95 }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-cyber-magenta/30 bg-cyber-magenta/5">
            <h2 className="text-cyber-magenta text-sm font-semibold tracking-wider">
              BINARY DECISION
            </h2>
          </div>

          <div className="p-5 space-y-4">
            {decisionResult ? (
              /* Result view */
              <div className="space-y-4">
                <p className="text-text-secondary text-sm">Decision recorded. Effects applied:</p>
                <div className="space-y-1">
                  {decisionResult.effects.map((e, i) => (
                    <div key={i} className="text-cyber-green text-xs flex items-center gap-2">
                      <span className="text-cyber-cyan">&gt;</span> {e.description}
                    </div>
                  ))}
                </div>
                {decisionResult.alignmentShift !== 0 && (
                  <div className={`text-xs ${decisionResult.alignmentShift > 0 ? "text-cyber-green" : "text-cyber-red"}`}>
                    Alignment {decisionResult.alignmentShift > 0 ? "+" : ""}{(decisionResult.alignmentShift * 100).toFixed(0)}%
                  </div>
                )}
                <button
                  onClick={handleDismiss}
                  className="w-full py-2 border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors text-sm"
                >
                  CONTINUE
                </button>
              </div>
            ) : definition ? (
              /* Decision view */
              <div className="space-y-4">
                <div className="text-cyber-cyan text-sm font-mono min-h-[3rem]">
                  {displayedText}
                  <span className="animate-pulse">_</span>
                </div>

                <p className="text-text-muted text-xs">{definition.description}</p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleChoice("yes")}
                    disabled={choosing}
                    className="py-3 border border-cyber-red/50 text-cyber-red rounded hover:bg-cyber-red/10 transition-colors disabled:opacity-30 text-sm font-semibold"
                  >
                    {choosing ? "..." : definition.yesLabel}
                  </button>
                  <button
                    onClick={() => handleChoice("no")}
                    disabled={choosing}
                    className="py-3 border border-cyber-green/50 text-cyber-green rounded hover:bg-cyber-green/10 transition-colors disabled:opacity-30 text-sm font-semibold"
                  >
                    {choosing ? "..." : definition.noLabel}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
