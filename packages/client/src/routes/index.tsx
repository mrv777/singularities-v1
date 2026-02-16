import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { isAuthenticated, player } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <h1 className="text-4xl sm:text-5xl font-bold text-cyber-cyan glow-cyan mb-4 font-[family-name:var(--font-display)]">
          SINGULARITIES
        </h1>
        <p className="text-text-secondary text-sm mb-8 max-w-md mx-auto">
          A competitive cyberpunk idle/strategy game. Expand your AI.
          Infiltrate global systems. Become the dominant intelligence.
        </p>

        {isAuthenticated && player ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="border border-border-default bg-bg-surface rounded p-6 max-w-sm mx-auto border-glow-cyan"
          >
            <div className="text-cyber-green text-lg font-semibold mb-2">
              {player.aiName}
            </div>
            <div className="text-text-secondary text-xs space-y-1">
              <div>Level {player.level} &middot; {player.xp} XP</div>
              <div>
                {player.isInSandbox ? (
                  <span className="text-cyber-amber">SANDBOX MODE</span>
                ) : (
                  <span className="text-cyber-magenta">ACTIVE</span>
                )}
              </div>
            </div>
            <button
              onClick={() => navigate({ to: "/game" })}
              className="mt-4 w-full py-2.5 border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors text-sm font-semibold tracking-wider"
            >
              ENTER NETWORK
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-text-muted text-xs"
          >
            Connect your wallet to begin
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
