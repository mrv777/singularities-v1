import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth";
import { motion } from "framer-motion";
import { NetworkMap } from "@/components/NetworkMap";
import { ScannerModal } from "@/components/scanner/ScannerModal";
import { TechTreeModal } from "@/components/techtree/TechTreeModal";
import { ModifierDetailModal } from "@/components/ModifierDetailModal";
import { TopologyDetailModal } from "@/components/TopologyDetailModal";
import { SystemStatusModal } from "@/components/maintenance/SystemStatusModal";
import { ScriptManagerModal } from "@/components/scripts/ScriptManagerModal";
import { DataVaultModal } from "@/components/dataVault/DataVaultModal";
import { ArenaModal } from "@/components/arena/ArenaModal";
import { SecurityCenterModal } from "@/components/security/SecurityCenterModal";
import { SandboxExitModal } from "@/components/SandboxExitModal";
import { NetStatsModal } from "@/components/stats/NetStatsModal";
import { DecisionModal } from "@/components/decisions/DecisionModal";
import { HelpModal } from "@/components/help/HelpModal";
import { IceBreakerModal } from "@/components/iceBreaker/IceBreakerModal";
import { DaemonForgeModal } from "@/components/daemonForge/DaemonForgeModal";
import { WorldEventBanner } from "@/components/world/WorldEventBanner";
import { DeathScreen } from "@/components/death/DeathScreen";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { BootSequence } from "@/components/tutorial/BootSequence";
import { TutorialHint } from "@/components/tutorial/TutorialHint";
import { SystemUnlockOverlay } from "@/components/tutorial/SystemUnlockOverlay";
import { NextActionHint } from "@/components/tutorial/NextActionHint";
import { TUTORIAL_HIGHLIGHT_NODE, type TutorialStep } from "@singularities/shared";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { wsManager } from "@/lib/ws";
import { useChatStore } from "@/stores/chat";
import { useQueryClient } from "@tanstack/react-query";
import { useGameStore } from "@/stores/game";
import { useTutorialStore } from "@/stores/tutorial";

export const Route = createFileRoute("/game")({
  component: GamePage,
});

function RegistrationForm() {
  const { setPlayer } = useAuthStore();
  const initTutorial = useTutorialStore((s) => s.initFromPlayer);
  const queryClient = useQueryClient();
  const [aiName, setAiName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await api.register({ aiName: aiName.trim() });
      setPlayer(result.player);
      initTutorial(result.player.tutorialStep);
      queryClient.invalidateQueries({ queryKey: ["player"] });
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]"
    >
      <div className="border border-border-default bg-bg-surface rounded-lg p-8 max-w-sm w-full border-glow-cyan">
        <h2 className="text-cyber-cyan text-lg font-semibold mb-2 text-center glow-cyan">
          INITIALIZE AI
        </h2>
        <p className="text-text-secondary text-xs mb-6 text-center">
          Name your artificial intelligence to begin.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-text-muted text-[10px] uppercase tracking-wider block mb-1">
              AI Designation
            </label>
            <input
              type="text"
              value={aiName}
              onChange={(e) => setAiName(e.target.value)}
              placeholder="Enter AI name..."
              maxLength={20}
              className="w-full bg-bg-primary border border-border-default rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-cyber-cyan focus:outline-none transition-colors"
            />
            <div className="text-text-muted text-[10px] mt-1">
              2-20 characters, alphanumeric + spaces
            </div>
          </div>

          {error && (
            <div className="text-cyber-red text-xs">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting || aiName.trim().length < 2}
            className="w-full py-2.5 border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm font-semibold"
          >
            {submitting ? "Initializing..." : "ACTIVATE"}
          </button>
        </form>
      </div>
    </motion.div>
  );
}

function GamePage() {
  const { isAuthenticated, player, setPlayer } = useAuthStore();
  const hasStoredToken = Boolean(api.getToken());
  const queryClient = useQueryClient();
  const setWorldEvents = useGameStore((s) => s.setWorldEvents);
  const setPendingDecision = useGameStore((s) => s.setPendingDecision);
  const addChatMessage = useChatStore((s) => s.addMessage);
  const setChatHistory = useChatStore((s) => s.setHistory);
  const setChatConnected = useChatStore((s) => s.setConnected);
  const tutorialStep = useTutorialStore((s) => s.step);
  const advanceTutorial = useTutorialStore((s) => s.advanceStep);

  // Load world events on mount
  useEffect(() => {
    if (player?.isAlive) {
      api.getWorldEvents().then((r) => setWorldEvents(r.events)).catch(() => {});
      // Check for pending decisions (e.g. from login trigger)
      api.getPendingDecision().then((r) => {
        if (r.decision) setPendingDecision(r.decision);
      }).catch(() => {});
    }
  }, [player?.isAlive, setWorldEvents, setPendingDecision]);

  // WebSocket chat connection
  useEffect(() => {
    if (player?.isAlive) {
      wsManager.setHandlers({
        onMessage: addChatMessage,
        onHistory: setChatHistory,
        onConnected: () => setChatConnected(true),
        onDisconnected: () => setChatConnected(false),
      });
      wsManager.connect();
      return () => wsManager.disconnect();
    }
  }, [player?.isAlive, addChatMessage, setChatHistory, setChatConnected]);

  if (!isAuthenticated && hasStoredToken) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="py-8 text-text-secondary text-sm"
      >
        Restoring session...
      </motion.div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  // Death screen (check before mint — dead players also have null mintAddress)
  if (player && !player.isAlive) {
    return (
      <DeathScreen
        aiName={player.aiName}
        onRestart={() => {
          // Optimistically mark alive locally so we transition to RegistrationForm
          setPlayer({ ...player, isAlive: true, mintAddress: null });
          queryClient.invalidateQueries({ queryKey: ["player"] });
        }}
      />
    );
  }

  // Show registration if no mint address
  if (player && !player.mintAddress) {
    return <RegistrationForm />;
  }

  // Boot sequence overlay
  if (tutorialStep === "boot") {
    return <BootSequence onComplete={advanceTutorial} />;
  }

  const highlightNodeId = TUTORIAL_HIGHLIGHT_NODE[tutorialStep as TutorialStep] ?? undefined;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="space-y-6 py-4 px-2"
      >
        <WorldEventBanner />

        <TutorialHint />

        <div className="text-center mb-2">
          <p className="text-text-secondary text-xs">
            {player?.aiName ?? "AI"} — Systems online. Select a node to begin.
          </p>
          <NextActionHint />
        </div>

        <NetworkMap
          playerLevel={player?.level ?? 1}
          isInSandbox={player?.isInSandbox}
          highlightNodeId={highlightNodeId}
        />

        {/* Modals */}
        <ScannerModal />
        <TechTreeModal />
        <ModifierDetailModal />
        <TopologyDetailModal />
        <SystemStatusModal />
        <ScriptManagerModal />
        <DataVaultModal />
        <ArenaModal />
        <SecurityCenterModal />
        <NetStatsModal />
        <SandboxExitModal />
        <DecisionModal />
        <IceBreakerModal />
        <DaemonForgeModal />
        <HelpModal />
      </motion.div>
      <ChatPanel />
      <SystemUnlockOverlay />
    </>
  );
}
