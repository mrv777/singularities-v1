import { Modal } from "@/components/Modal";
import { useUIStore } from "@/stores/ui";
import { useGameStore } from "@/stores/game";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import {
  SCAN_ENERGY_COST,
  MINIGAME_LABELS,
  type SignalCrackMoveResult,
  type PortSweepMoveResult,
  type NetworkRelinkMoveResult,
} from "@singularities/shared";
import { TargetCard } from "./TargetCard";
import { LoadoutPreview } from "./LoadoutPreview";
import { GameResultDisplay } from "./GameResult";
import { SignalCrack } from "./games/SignalCrack";
import { PortSweep } from "./games/PortSweep";
import { NetworkRelink } from "./games/NetworkRelink";
import { ResourceCost } from "../ui/ResourceCost";
import { useModifier } from "@/hooks/useModifier";
import { useTutorialStore } from "@/stores/tutorial";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { playSound } from "@/lib/sound";

export function ScannerModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const player = useAuthStore((s) => s.player);
  const setPlayer = useAuthStore((s) => s.setPlayer);
  const queryClient = useQueryClient();

  const {
    scannedTargets,
    selectedTargetIndex,
    scannerPhase,
    activeGameConfig,
    activeGameExpiresAt,
    gameMoveHistory,
    gameResult,
    isScanning,
    isStartingGame,
    isSubmittingMove,
    isResolvingGame,
    setScannedTargets,
    selectTarget,
    setIsScanning,
    setActiveGame,
    clearActiveGame,
    addMoveResult,
    setGameResult,
    setIsStartingGame,
    setIsSubmittingMove,
    setIsResolvingGame,
    setLoadout,
    setOwnedModules,
    setPendingDecision,
  } = useGameStore();

  const tutorialStep = useTutorialStore((s) => s.step);
  const advanceTutorial = useTutorialStore((s) => s.advanceStep);

  const { applyCost } = useModifier();
  const effectiveScanCost = applyCost(SCAN_ENERGY_COST, "energyCostMultiplier");

  const [error, setError] = useState("");
  const open = activeModal === "scanner";

  // Load loadout & modules when scanner opens; check for active game
  useEffect(() => {
    if (open) {
      api.getLoadoutsByType("infiltration").then((r) => setLoadout(r.loadout)).catch(() => {});
      api.getModules().then((r) => setOwnedModules(r.owned)).catch(() => {});
      // Check for active game on open (resume on reconnect)
      api.getGameStatus().then((status) => {
        if (status.active && status.gameType && status.config && status.expiresAt) {
          setActiveGame(
            status.gameType,
            status.config,
            status.expiresAt,
            { moveHistory: status.moveHistory ?? [], startedAt: status.startedAt }
          );
        } else if (scannerPhase === "playing") {
          clearActiveGame();
        }
      }).catch(() => {});
    }
  }, [open, setLoadout, setOwnedModules, setActiveGame, clearActiveGame, scannerPhase]);

  const handleScan = async () => {
    setIsScanning(true);
    setError("");
    try {
      const result = await api.scan();
      playSound("scan");
      setScannedTargets(result.targets, result.expiresAt);
      queryClient.invalidateQueries({ queryKey: ["player"] });
      const me = await api.getMe();
      setPlayer(me.player);
      if (tutorialStep === "scan") advanceTutorial();
    } catch (err: any) {
      setError(err.message ?? "Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  const handleStartGame = async () => {
    if (selectedTargetIndex === null) return;
    const target = scannedTargets[selectedTargetIndex];

    setIsStartingGame(true);
    setError("");
    try {
      const result = await api.startGame({ targetIndex: target.index });
      queryClient.invalidateQueries({ queryKey: ["player"] });
      setActiveGame(result.gameType, result.config, result.expiresAt);
    } catch (err: any) {
      const msg = err.message ?? "Failed to start game";
      if (msg.includes("scan") || msg.includes("Scan")) {
        setScannedTargets([], "");
        selectTarget(null);
      }
      setError(msg);
    } finally {
      setIsStartingGame(false);
    }
  };

  // Move handlers per game type
  const handleSignalCrackMove = useCallback(async (guess: number[]): Promise<SignalCrackMoveResult | null> => {
    setIsSubmittingMove(true);
    try {
      const resp = await api.submitMove({ move: { type: "signal_crack", guess } });
      const result = resp.result as SignalCrackMoveResult;
      addMoveResult(result);
      return result;
    } catch (err: any) {
      setError(err.message ?? "Move failed");
      return null;
    } finally {
      setIsSubmittingMove(false);
    }
  }, [addMoveResult, setIsSubmittingMove]);

  const handlePortSweepMove = useCallback(async (row: number, col: number): Promise<PortSweepMoveResult | null> => {
    setIsSubmittingMove(true);
    try {
      const resp = await api.submitMove({ move: { type: "port_sweep", row, col } });
      const result = resp.result as PortSweepMoveResult;
      addMoveResult(result);
      return result;
    } catch (err: any) {
      setError(err.message ?? "Move failed");
      return null;
    } finally {
      setIsSubmittingMove(false);
    }
  }, [addMoveResult, setIsSubmittingMove]);

  const handleNetworkRelinkMove = useCallback(async (
    paths: Array<{ pairIndex: number; cells: [number, number][] }>,
    drawCount: number
  ): Promise<NetworkRelinkMoveResult | null> => {
    setIsSubmittingMove(true);
    try {
      const resp = await api.submitMove({ move: { type: "network_relink", paths, drawCount } });
      const result = resp.result as NetworkRelinkMoveResult;
      addMoveResult(result);
      return result;
    } catch (err: any) {
      setError(err.message ?? "Move failed");
      return null;
    } finally {
      setIsSubmittingMove(false);
    }
  }, [addMoveResult, setIsSubmittingMove]);

  const handleGameOver = useCallback(async () => {
    if (isResolvingGame) return;
    setIsResolvingGame(true);
    setError("");
    try {
      const result = await api.resolveGame();
      setPlayer(result.player);
      queryClient.invalidateQueries({ queryKey: ["player"] });
      setGameResult(result);

      // Advance tutorial after hack completes
      if (tutorialStep === "hack") advanceTutorial();

      // Check for pending decision
      api.getPendingDecision().then((r) => {
        if (r.decision) setPendingDecision(r.decision);
      }).catch(() => {});
    } catch (err: any) {
      const msg = err.message ?? "Failed to resolve game";
      if (msg.includes("No active mini-game")) {
        clearActiveGame();
      }
      setError(msg);
    } finally {
      setIsResolvingGame(false);
    }
  }, [
    isResolvingGame,
    setIsResolvingGame,
    setPlayer,
    queryClient,
    setGameResult,
    setPendingDecision,
    clearActiveGame,
    tutorialStep,
    advanceTutorial,
  ]);

  const handleResultDone = useCallback(() => {
    setGameResult(null);
    clearActiveGame();
  }, [setGameResult, clearActiveGame]);

  const selectedTarget =
    selectedTargetIndex !== null ? scannedTargets[selectedTargetIndex] : null;

  const BG_MAP: Record<string, string> = {
    military: "/assets/backgrounds/military.webp",
    government: "/assets/backgrounds/military.webp",
    research: "/assets/backgrounds/academic.webp",
    infrastructure: "/assets/backgrounds/industrial.webp",
    corporate: "/assets/backgrounds/corporate.webp",
    financial: "/assets/backgrounds/corporate.webp",
    database: "/assets/backgrounds/underground.webp",
  };
  // Always show a background in playing phase; fall back to corporate if target type unknown
  const gameBgSrc = scannerPhase === "playing"
    ? (selectedTarget ? BG_MAP[selectedTarget.type] : undefined) ?? "/assets/backgrounds/corporate.webp"
    : undefined;

  return (
    <Modal open={open} onClose={closeModal} title="NETWORK SCANNER" maxWidth="max-w-3xl" backgroundSrc={gameBgSrc}>
      {/* Phase: Result */}
      {scannerPhase === "result" && gameResult ? (
        <GameResultDisplay result={gameResult} onDone={handleResultDone} />
      ) : scannerPhase === "playing" && activeGameConfig ? (
        /* Phase: Playing */
        <div className="space-y-3">
          {error && (
            <div className="text-cyber-red text-xs text-center border border-cyber-red/30 rounded px-3 py-2 bg-cyber-red/5">
              {error}
            </div>
          )}

          {isResolvingGame ? (
            <div className="text-center py-8">
              <div className="text-cyber-cyan text-sm animate-pulse">Resolving game...</div>
            </div>
          ) : activeGameConfig.type === "signal_crack" ? (
            <SignalCrack
              config={activeGameConfig}
              expiresAt={activeGameExpiresAt!}
              onMove={handleSignalCrackMove}
              onGameOver={handleGameOver}
              isSubmitting={isSubmittingMove}
              initialMoveHistory={gameMoveHistory}
            />
          ) : activeGameConfig.type === "port_sweep" ? (
            <PortSweep
              config={activeGameConfig}
              expiresAt={activeGameExpiresAt!}
              onMove={handlePortSweepMove}
              onGameOver={handleGameOver}
              isSubmitting={isSubmittingMove}
              initialMoveHistory={gameMoveHistory}
            />
          ) : activeGameConfig.type === "network_relink" ? (
            <NetworkRelink
              config={activeGameConfig}
              expiresAt={activeGameExpiresAt!}
              onMove={handleNetworkRelinkMove}
              onGameOver={handleGameOver}
              isSubmitting={isSubmittingMove}
              initialMoveHistory={gameMoveHistory}
            />
          ) : null}
        </div>
      ) : (
        /* Phase: Idle / Targets */
        <div className="space-y-4">
          {error && (
            <div className="text-cyber-red text-xs text-center border border-cyber-red/30 rounded px-3 py-2 bg-cyber-red/5">
              {error}
            </div>
          )}

          {/* Scan button */}
          {scannedTargets.length === 0 && (
            <div className="text-center py-8">
              <p className="text-text-secondary text-sm mb-4">
                Scan the network to discover infiltration targets.
              </p>
              <button
                onClick={handleScan}
                disabled={isScanning || !player || player.energy < effectiveScanCost}
                className="px-6 py-2 min-h-[44px] border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm"
              >
                {isScanning ? "Scanning..." : <span className="flex items-center gap-1.5">Scan Network <ResourceCost costs={{ energy: effectiveScanCost }} baseCosts={{ energy: SCAN_ENERGY_COST }} /></span>}
              </button>
              {player && player.energy < effectiveScanCost && (
                <p className="text-cyber-red text-xs mt-2">Insufficient energy</p>
              )}
            </div>
          )}

          {/* Target list */}
          {scannedTargets.length > 0 && (
            <>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary text-xs">
                    {scannedTargets.length} targets found — pick one to infiltrate
                  </span>
                  <button
                    onClick={handleScan}
                    disabled={isScanning || !player || player.energy < effectiveScanCost}
                    className="text-xs text-cyber-cyan hover:underline disabled:opacity-30"
                  >
                    <span className="inline-flex items-center gap-1">Re-scan <ResourceCost costs={{ energy: effectiveScanCost }} baseCosts={{ energy: SCAN_ENERGY_COST }} /></span>
                  </button>
                </div>
                <div className="text-[10px] text-text-muted">
                  Security scales difficulty + rewards. Detection check runs only below 50% score.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {scannedTargets.map((target, i) => (
                  <TargetCard
                    key={target.index}
                    target={target}
                    selected={selectedTargetIndex === i}
                    onSelect={() => selectTarget(i)}
                  />
                ))}
              </div>

              {/* Loadout + start game */}
              {selectedTarget && (
                <div className="space-y-3 border-t border-border-default pt-3">
                  <LoadoutPreview />

                  <div className="text-center text-[11px] text-text-secondary">
                    Mini-game: <span className="text-cyber-cyan font-bold">{MINIGAME_LABELS[selectedTarget.gameType]}</span>
                  </div>

                  <button
                    onClick={handleStartGame}
                    disabled={isStartingGame}
                    className="w-full py-2.5 min-h-[44px] border border-cyber-green text-cyber-green rounded hover:bg-cyber-green/10 transition-colors disabled:opacity-30 text-sm font-semibold"
                  >
                    {isStartingGame ? "Starting..." : "START INFILTRATION"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
