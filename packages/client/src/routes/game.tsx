import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth";
import { motion } from "framer-motion";

export const Route = createFileRoute("/game")({
  component: GamePage,
});

function GamePage() {
  const { isAuthenticated, player } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="border border-border-default bg-bg-surface rounded p-6">
        <h2 className="text-cyber-cyan text-lg font-semibold mb-4">
          Network Map
        </h2>
        <p className="text-text-secondary text-sm">
          {player?.aiName ?? "AI"} — Systems online. Awaiting directives.
        </p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {["Scanner", "Tech Tree", "Maintenance", "Scripts", "Arena", "Security"].map(
            (node) => (
              <div
                key={node}
                className="border border-border-default bg-bg-elevated rounded p-3 text-center text-xs text-text-muted hover:border-cyber-cyan hover:text-cyber-cyan transition-colors cursor-pointer"
              >
                {node}
              </div>
            )
          )}
        </div>
      </div>
    </motion.div>
  );
}
