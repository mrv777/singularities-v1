import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { CyberButton } from "@/components/ui/CyberButton";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const STATUS_LINES = [
  "Neural pathways synchronized",
  "Scanning global network nodes",
  "Quantum entropy: nominal",
  "Firewall integrity: 99.7%",
  "AI constructs online: 2,847",
  "Data streams: active",
  "Threat level: elevated",
  "Processing cluster: optimal",
];

function useTypingCycle(lines: string[], interval = 4000) {
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [typing, setTyping] = useState(true);

  useEffect(() => {
    const line = lines[index];
    if (typing) {
      if (displayed.length < line.length) {
        const t = setTimeout(() => setDisplayed(line.slice(0, displayed.length + 1)), 35);
        return () => clearTimeout(t);
      }
      // Finished typing — pause then start erasing
      const t = setTimeout(() => setTyping(false), interval);
      return () => clearTimeout(t);
    }
    // Erasing
    if (displayed.length > 0) {
      const t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 20);
      return () => clearTimeout(t);
    }
    // Fully erased — next line
    setIndex((i) => (i + 1) % lines.length);
    setTyping(true);
  }, [displayed, typing, index, lines, interval]);

  return displayed;
}

/* Title letter animation */
const TITLE = "SINGULARITIES";

const letterVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.4 + i * 0.06, duration: 0.3, ease: "easeOut" as const },
  }),
};

const glitchFlicker = {
  hidden: { opacity: 0 },
  visible: {
    opacity: [0, 1, 0.4, 1],
    transition: { duration: 0.15, times: [0, 0.3, 0.6, 1] },
  },
};

function HomePage() {
  const { isAuthenticated, player } = useAuthStore();
  const navigate = useNavigate();
  const statusLine = useTypingCycle(STATUS_LINES);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Animated pulsing grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundSize: "60px 60px",
          backgroundImage:
            "linear-gradient(to right, rgba(0,240,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,240,255,0.03) 1px, transparent 1px)",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
          animation: "pulse-grid 6s ease-in-out infinite",
        }}
      />

      {/* Ambient glow behind title */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse, rgba(0,240,255,0.08) 0%, transparent 70%)",
          animation: "pulse-ambient 4s ease-in-out infinite",
        }}
      />

      <div className="relative z-10 text-center px-4">
        {/* Glitch-animated title */}
        <motion.h1
          className="text-5xl sm:text-7xl font-bold text-cyber-cyan glow-cyan mb-2 font-display tracking-[0.15em]"
          initial="hidden"
          animate="visible"
        >
          {TITLE.split("").map((char, i) => (
            <motion.span
              key={i}
              custom={i}
              variants={letterVariants}
              className="inline-block"
            >
              <motion.span variants={glitchFlicker}>
                {char}
              </motion.span>
            </motion.span>
          ))}
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="text-text-secondary text-sm mb-2 max-w-md mx-auto"
        >
          Expand your AI. Infiltrate global systems. Become the dominant intelligence.
        </motion.p>

        {/* Cycling terminal status line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="h-5 mb-8"
        >
          <span className="text-cyber-cyan/50 text-xs font-mono">
            &gt; {statusLine}
            <span className="animate-pulse">_</span>
          </span>
        </motion.div>

        {import.meta.env.DEV && !isAuthenticated && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
            onClick={() => {
              const DEV_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzODg0N2E1Yi0xZjFkLTQ0N2EtYmNiYS01NWY3YjlhZGNkMjYiLCJ3YWxsZXQiOiI4Zm9oRWFRZldmNFhHOUxjWGprM1pCYXJ4cUgzNzdud2lCdHNVQkR0MlNEdCIsImlhdCI6MTc3MTI4ODM2MCwiZXhwIjoxODAyODI0MzYwfQ.2DlqiTIgJ2GIprtt_ASlLv7OMkUBsk67H9hl2IP7Q9g";
              api.setToken(DEV_TOKEN);
              api.getMe().then(({ player }) => {
                useAuthStore.getState().setPlayer(player);
              }).catch((err) => {
                console.error("Dev login failed:", err);
                api.setToken(null);
              });
            }}
            className="mb-6 px-4 py-2 border border-cyber-amber/50 text-cyber-amber text-xs rounded hover:bg-cyber-amber/10 transition-colors"
          >
            DEV LOGIN
          </motion.button>
        )}

        {isAuthenticated && player ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="relative border border-border-default bg-bg-surface/80 backdrop-blur-sm rounded p-6 max-w-sm mx-auto border-glow-cyan"
          >
            {/* HUD corners */}
            <div className="hud-corner hud-corner-tl" />
            <div className="hud-corner hud-corner-tr" />
            <div className="hud-corner hud-corner-bl" />
            <div className="hud-corner hud-corner-br" />

            <div className="text-cyber-green text-lg font-semibold mb-2 font-display tracking-wider">
              {player.aiName}
            </div>
            <div className="text-text-secondary text-xs space-y-1 mb-4">
              <div>Level {player.level} &middot; {player.xp} XP</div>
              <div>
                {player.isInSandbox ? (
                  <span className="text-cyber-amber">SANDBOX MODE</span>
                ) : (
                  <span className="text-cyber-magenta">ACTIVE</span>
                )}
              </div>
            </div>
            <CyberButton
              onClick={() => navigate({ to: "/game" })}
              className="w-full"
            >
              ENTER NETWORK
            </CyberButton>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
            className="text-text-muted text-xs"
          >
            Connect your wallet to begin
          </motion.div>
        )}
      </div>

      {/* CSS keyframes for background animations */}
      <style>{`
        @keyframes pulse-grid {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes pulse-ambient {
          0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
        }
      `}</style>
    </div>
  );
}
