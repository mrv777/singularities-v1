import { motion } from "framer-motion";

interface SeasonEndScreenProps {
  seasonName: string;
  winnerName: string;
  winnerReputation: number;
  onContinue: () => void;
}

export function SeasonEndScreen({ seasonName, winnerName, winnerReputation, onContinue }: SeasonEndScreenProps) {
  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0a0a0f]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="text-center space-y-6 max-w-md px-4"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.div
          className="text-cyber-amber text-lg font-bold tracking-wider"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          SEASON COMPLETE
        </motion.div>

        <motion.div
          className="text-text-muted text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          {seasonName}
        </motion.div>

        <motion.div
          className="space-y-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
        >
          <div className="text-[10px] text-text-muted uppercase tracking-wider">Champion</div>
          <div className="text-cyber-cyan text-xl font-bold glow-cyan">{winnerName}</div>
          <div className="text-text-secondary text-sm">{winnerReputation} REP</div>
        </motion.div>

        <motion.button
          onClick={onContinue}
          className="mt-8 px-8 py-2.5 border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5 }}
        >
          CONTINUE
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
