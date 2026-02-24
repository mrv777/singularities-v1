import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth";
import { motion } from "framer-motion";
import { CyberButton } from "@/components/ui/CyberButton";
import { CyberInput } from "@/components/ui/CyberInput";
import { NetworkMap } from "@/components/NetworkMap";
import { DecisionModal } from "@/components/decisions/DecisionModal";
import { WorldEventBanner } from "@/components/world/WorldEventBanner";
import { LoginStreakCard } from "@/components/LoginStreakCard";
import { RecentBattleCard } from "@/components/arena/RecentBattleCard";
import { DeathScreen } from "@/components/death/DeathScreen";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { BootSequence } from "@/components/tutorial/BootSequence";
import { TutorialHint } from "@/components/tutorial/TutorialHint";
import { SystemUnlockOverlay } from "@/components/tutorial/SystemUnlockOverlay";
import { NextActionHint } from "@/components/tutorial/NextActionHint";
import { TUTORIAL_HIGHLIGHT_NODE, type TutorialStep } from "@singularities/shared";
import { ModalSkeleton } from "@/components/ui/ModalSkeleton";
import { useState, useEffect, lazy, Suspense, type ComponentType } from "react";
import { api } from "@/lib/api";
import { wsManager } from "@/lib/ws";
import { useChatStore } from "@/stores/chat";
import { useQueryClient } from "@tanstack/react-query";
import { useGameStore } from "@/stores/game";
import { useUIStore } from "@/stores/ui";
import { useTutorialStore } from "@/stores/tutorial";
import { useToastStore } from "@/stores/toast";

/* ── Lazy modal imports ──────────────────────────────────────────────────── */
const ScannerModal = lazy(() => import("@/components/scanner/ScannerModal").then(m => ({ default: m.ScannerModal })));
const TechTreeModal = lazy(() => import("@/components/techtree/TechTreeModal").then(m => ({ default: m.TechTreeModal })));
const ModifierDetailModal = lazy(() => import("@/components/ModifierDetailModal").then(m => ({ default: m.ModifierDetailModal })));
const TopologyDetailModal = lazy(() => import("@/components/TopologyDetailModal").then(m => ({ default: m.TopologyDetailModal })));
const SystemStatusModal = lazy(() => import("@/components/maintenance/SystemStatusModal").then(m => ({ default: m.SystemStatusModal })));
const ScriptManagerModal = lazy(() => import("@/components/scripts/ScriptManagerModal").then(m => ({ default: m.ScriptManagerModal })));
const DataVaultModal = lazy(() => import("@/components/dataVault/DataVaultModal").then(m => ({ default: m.DataVaultModal })));
const ArenaModal = lazy(() => import("@/components/arena/ArenaModal").then(m => ({ default: m.ArenaModal })));
const SecurityCenterModal = lazy(() => import("@/components/security/SecurityCenterModal").then(m => ({ default: m.SecurityCenterModal })));
const SandboxExitModal = lazy(() => import("@/components/SandboxExitModal").then(m => ({ default: m.SandboxExitModal })));
const NetStatsModal = lazy(() => import("@/components/stats/NetStatsModal").then(m => ({ default: m.NetStatsModal })));
const HelpModal = lazy(() => import("@/components/help/HelpModal").then(m => ({ default: m.HelpModal })));
const IceBreakerModal = lazy(() => import("@/components/iceBreaker/IceBreakerModal").then(m => ({ default: m.IceBreakerModal })));
const DaemonForgeModal = lazy(() => import("@/components/daemonForge/DaemonForgeModal").then(m => ({ default: m.DaemonForgeModal })));

const MODAL_MAP: Record<string, ComponentType> = {
  scanner: ScannerModal,
  tech_tree: TechTreeModal,
  modifier_detail: ModifierDetailModal,
  topology_detail: TopologyDetailModal,
  system_maintenance: SystemStatusModal,
  script_manager: ScriptManagerModal,
  data_vault: DataVaultModal,
  pvp_arena: ArenaModal,
  security_center: SecurityCenterModal,
  sandbox_exit: SandboxExitModal,
  network_stats: NetStatsModal,
  help: HelpModal,
  ice_breaker: IceBreakerModal,
  daemon_forge: DaemonForgeModal,
};

function ModalRouter() {
  const activeModal = useUIStore((s) => s.activeModal);
  const ModalComponent = activeModal ? MODAL_MAP[activeModal] : null;
  if (!ModalComponent) return null;
  return (
    <Suspense fallback={<ModalSkeleton />}>
      <ModalComponent />
    </Suspense>
  );
}

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
          <CyberInput
            label="AI Designation"
            value={aiName}
            onChange={(e) => setAiName(e.target.value)}
            placeholder="Enter AI name..."
            maxLength={20}
            error={error || undefined}
          />
          <div className="text-text-muted text-[10px] -mt-3">
            2-20 characters, alphanumeric + spaces
          </div>

          <CyberButton
            type="submit"
            disabled={submitting || aiName.trim().length < 2}
            className="w-full"
          >
            {submitting ? "Initializing..." : "ACTIVATE"}
          </CyberButton>
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
  const addToast = useToastStore((s) => s.addToast);
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
        onMessage: (msg) => {
          addChatMessage(msg);
          // Fire toast for activity & event messages
          if (msg.channel === "activity") {
            const content = msg.content;
            const type = content.includes("level") ? "levelup" as const
              : content.includes("won") || content.includes("victory") ? "combat" as const
              : content.includes("lost") || content.includes("defeat") ? "error" as const
              : "info" as const;
            addToast(type, "Activity", content);
          } else if (msg.channel === "events") {
            addToast("warning", "World Event", msg.content);
          }
        },
        onHistory: setChatHistory,
        onConnected: () => setChatConnected(true),
        onDisconnected: () => setChatConnected(false),
      });
      wsManager.connect();
      return () => wsManager.disconnect();
    }
  }, [player?.isAlive, addChatMessage, setChatHistory, setChatConnected, addToast]);

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
        {tutorialStep === "done" && <LoginStreakCard />}
        {tutorialStep === "done" && <RecentBattleCard />}

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

        {/* Lazy-mounted modal — only the active one renders */}
        <ModalRouter />
        {/* DecisionModal is state-driven (not from activeModal), always mounted */}
        <DecisionModal />
      </motion.div>
      <ChatPanel />
      <SystemUnlockOverlay />
    </>
  );
}
