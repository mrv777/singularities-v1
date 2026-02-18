import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type {
  GameMoveResult,
  SignalCrackConfig,
  SignalCrackFeedback,
  SignalCrackMoveResult,
} from "@singularities/shared";
import { GameTimer } from "./GameTimer";
import { playSound } from "@/lib/sound";

interface SignalCrackProps {
  config: SignalCrackConfig;
  expiresAt: string;
  onMove: (guess: number[]) => Promise<SignalCrackMoveResult | null>;
  onGameOver: () => void;
  isSubmitting: boolean;
  initialMoveHistory?: GameMoveResult[];
}

interface GuessRow {
  guess: number[];
  feedback: SignalCrackFeedback[];
  possibilitiesRemaining: number;
}

const FEEDBACK_COLORS: Record<SignalCrackFeedback, string> = {
  EXACT: "#00ff88",
  PRESENT: "#ffaa00",
  MISS: "#555",
};

const FEEDBACK_LABELS: Record<SignalCrackFeedback, string> = {
  EXACT: "Exact",
  PRESENT: "Present",
  MISS: "Miss",
};

export function SignalCrack({
  config,
  expiresAt,
  onMove,
  onGameOver,
  isSubmitting,
  initialMoveHistory = [],
}: SignalCrackProps) {
  const [currentGuess, setCurrentGuess] = useState<number[]>([]);
  const [history, setHistory] = useState<GuessRow[]>([]);
  const [guessesRemaining, setGuessesRemaining] = useState(config.maxGuesses);
  const [possibilitiesRemaining, setPossibilitiesRemaining] = useState<number | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [solved, setSolved] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const prior = initialMoveHistory.filter(
      (m): m is SignalCrackMoveResult => m.type === "signal_crack"
    );
    if (prior.length === 0) return;

    setHistory(prior.map((result) => ({
      guess: result.guess,
      feedback: result.feedback,
      possibilitiesRemaining: result.possibilitiesRemaining,
    })));
    const last = prior[prior.length - 1];
    setGuessesRemaining(last.guessesRemaining);
    setPossibilitiesRemaining(last.possibilitiesRemaining);
    setSolved(last.solved);
    setGameOver(last.gameOver);
  }, [initialMoveHistory]);

  const handleDigitPress = useCallback((digit: number) => {
    if (gameOver || isSubmitting) return;
    if (currentGuess.length >= config.codeLength) return;
    playSound("gameMove");
    const next = [...currentGuess, digit];
    setCurrentGuess(next);
    // Check for duplicates
    setDuplicateWarning(new Set(next).size !== next.length);
  }, [config.codeLength, gameOver, isSubmitting, currentGuess]);

  const handleBackspace = useCallback(() => {
    if (gameOver || isSubmitting) return;
    setCurrentGuess((prev) => {
      const next = prev.slice(0, -1);
      setDuplicateWarning(new Set(next).size !== next.length);
      return next;
    });
  }, [gameOver, isSubmitting]);

  const handleSubmit = useCallback(async () => {
    if (currentGuess.length !== config.codeLength || isSubmitting || gameOver) return;

    // Block duplicate digits
    if (new Set(currentGuess).size !== currentGuess.length) {
      setDuplicateWarning(true);
      return;
    }

    const result = await onMove(currentGuess);
    if (!result) return;

    setHistory((prev) => [...prev, {
      guess: currentGuess,
      feedback: result.feedback,
      possibilitiesRemaining: result.possibilitiesRemaining,
    }]);
    setGuessesRemaining(result.guessesRemaining);
    setPossibilitiesRemaining(result.possibilitiesRemaining);
    setCurrentGuess([]);
    setDuplicateWarning(false);

    if (result.solved) {
      playSound("gameCorrect");
      setSolved(true);
      setGameOver(true);
    } else if (result.gameOver) {
      playSound("gameWrong");
      setGameOver(true);
    }
  }, [currentGuess, config.codeLength, isSubmitting, gameOver, onMove]);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const digit = parseInt(e.key, 10);
      if (!isNaN(digit) && digit < config.digitPool) {
        handleDigitPress(digit);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Enter") {
        handleSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [config.digitPool, handleDigitPress, handleBackspace, handleSubmit]);

  // Auto-resolve when game over
  useEffect(() => {
    if (gameOver) {
      const t = setTimeout(onGameOver, 800);
      return () => clearTimeout(t);
    }
  }, [gameOver, onGameOver]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-cyber-cyan text-sm font-bold">SIGNAL CRACK</h3>
          <p className="text-text-muted text-[11px]">
            Break the {config.codeLength}-digit code (digits 0-{config.digitPool - 1})
          </p>
        </div>
        <GameTimer expiresAt={expiresAt} onExpired={onGameOver} />
      </div>

      <div className="flex justify-center gap-6 text-[11px]">
        <span className="text-text-secondary">
          {guessesRemaining} guesses remaining
        </span>
        {possibilitiesRemaining !== null && (
          <span className="text-text-secondary">
            Possible codes: <span className="text-cyber-cyan font-bold font-mono">{possibilitiesRemaining}</span>
          </span>
        )}
      </div>

      {/* Guess history */}
      <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
        {history.map((row, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 justify-center"
          >
            <span className="text-text-muted text-[10px] w-4 text-right">{i + 1}.</span>
            {row.guess.map((digit, j) => (
              <div
                key={j}
                className="w-9 h-9 rounded border flex items-center justify-center text-sm font-bold font-mono"
                style={{
                  borderColor: FEEDBACK_COLORS[row.feedback[j]],
                  backgroundColor: `${FEEDBACK_COLORS[row.feedback[j]]}15`,
                  color: FEEDBACK_COLORS[row.feedback[j]],
                }}
                title={FEEDBACK_LABELS[row.feedback[j]]}
              >
                {digit}
              </div>
            ))}
          </motion.div>
        ))}
      </div>

      {/* Current guess input */}
      {!gameOver && (
        <div className="flex items-center gap-2 justify-center">
          <span className="text-text-muted text-[10px] w-4 text-right">{history.length + 1}.</span>
          {Array.from({ length: config.codeLength }).map((_, i) => (
            <div
              key={i}
              className={`w-9 h-9 rounded border flex items-center justify-center text-sm font-bold font-mono ${
                i < currentGuess.length
                  ? "border-cyber-cyan text-cyber-cyan bg-cyber-cyan/10"
                  : "border-border-default text-text-muted"
              }`}
            >
              {currentGuess[i] ?? "_"}
            </div>
          ))}
        </div>
      )}

      {/* Digit palette */}
      {!gameOver && (
        <div className="space-y-2">
          <div className="flex gap-1.5 justify-center flex-wrap">
            {Array.from({ length: config.digitPool }).map((_, digit) => (
              <button
                key={digit}
                onClick={() => handleDigitPress(digit)}
                disabled={currentGuess.length >= config.codeLength || isSubmitting}
                className="w-9 h-9 rounded border border-border-default text-text-primary text-sm font-mono font-bold hover:border-cyber-cyan hover:text-cyber-cyan transition-colors disabled:opacity-30"
              >
                {digit}
              </button>
            ))}
          </div>

          {duplicateWarning && (
            <div className="text-cyber-amber text-[10px] text-center">
              No duplicate digits allowed
            </div>
          )}

          <div className="flex gap-2 justify-center">
            <button
              onClick={handleBackspace}
              disabled={currentGuess.length === 0 || isSubmitting}
              className="px-3 py-1.5 text-xs border border-border-default text-text-secondary rounded hover:border-cyber-amber transition-colors disabled:opacity-30"
            >
              DEL
            </button>
            <button
              onClick={handleSubmit}
              disabled={currentGuess.length !== config.codeLength || isSubmitting || duplicateWarning}
              className="px-6 py-1.5 text-xs border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-30 font-bold"
            >
              {isSubmitting ? "..." : "SUBMIT"}
            </button>
          </div>
        </div>
      )}

      {/* Solved / failed banner */}
      {gameOver && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`text-center py-2 rounded border ${
            solved
              ? "border-cyber-green/50 bg-cyber-green/10 text-cyber-green"
              : "border-cyber-red/50 bg-cyber-red/10 text-cyber-red"
          }`}
        >
          <div className="text-sm font-bold">
            {solved ? "CODE CRACKED!" : "CODE NOT BROKEN"}
          </div>
        </motion.div>
      )}

      {/* Legend */}
      <div className="flex gap-4 justify-center text-[10px]">
        <span style={{ color: FEEDBACK_COLORS.EXACT }}>&#9632; Exact</span>
        <span style={{ color: FEEDBACK_COLORS.PRESENT }}>&#9632; Wrong Position</span>
        <span style={{ color: FEEDBACK_COLORS.MISS }}>&#9632; Not in Code</span>
      </div>
    </div>
  );
}
