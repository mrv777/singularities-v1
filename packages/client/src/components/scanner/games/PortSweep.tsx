import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { GameMoveResult, PortSweepConfig, PortSweepMoveResult } from "@singularities/shared";
import { GameTimer } from "./GameTimer";
import { playSound } from "@/lib/sound";

interface PortSweepProps {
  config: PortSweepConfig;
  expiresAt: string;
  onMove: (row: number, col: number) => Promise<PortSweepMoveResult | null>;
  onGameOver: () => void;
  isSubmitting: boolean;
  initialMoveHistory?: GameMoveResult[];
}

interface CellState {
  probed: boolean;
  hit: boolean;
  adjacency: number | null;
  mineSurge?: boolean;
}

function ModifierBadge({ modifier }: { modifier: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-cyber-amber/50 text-cyber-amber bg-cyber-amber/10">
      ⚠ {modifier}
    </span>
  );
}

export function PortSweep({
  config,
  expiresAt,
  onMove,
  onGameOver,
  isSubmitting,
  initialMoveHistory = [],
}: PortSweepProps) {
  const [grid, setGrid] = useState<CellState[][]>(() =>
    Array.from({ length: config.gridSize }, () =>
      Array.from({ length: config.gridSize }, () => ({
        probed: false,
        hit: false,
        adjacency: null,
      }))
    )
  );
  const [portsFound, setPortsFound] = useState(0);
  const [probesRemaining, setProbesRemaining] = useState(config.maxProbes);
  const [gameOver, setGameOver] = useState(false);
  const [allFound, setAllFound] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const prior = initialMoveHistory.filter(
      (m): m is PortSweepMoveResult => m.type === "port_sweep"
    );
    if (prior.length === 0) return;

    const hydratedGrid: CellState[][] = Array.from({ length: config.gridSize }, () =>
      Array.from({ length: config.gridSize }, () => ({
        probed: false,
        hit: false,
        adjacency: null,
      }))
    );

    for (const move of prior) {
      if (move.row < 0 || move.row >= config.gridSize || move.col < 0 || move.col >= config.gridSize) {
        continue;
      }
      hydratedGrid[move.row][move.col] = {
        probed: true,
        hit: move.hit,
        adjacency: move.adjacency,
        mineSurge: move.mineSurge,
      };
    }

    setGrid(hydratedGrid);
    const last = prior[prior.length - 1];
    setPortsFound(last.portsFound);
    setProbesRemaining(last.probesRemaining);
    setAllFound(last.allFound);
    setGameOver(last.gameOver);
  }, [initialMoveHistory, config.gridSize]);

  const handleProbe = useCallback(async (row: number, col: number) => {
    if (gameOver || isSubmitting) return;
    if (grid[row][col].probed) return;

    playSound("gameMove");
    const result = await onMove(row, col);
    if (!result) return;

    setGrid((prev) => {
      const next = prev.map((r) => r.map((c) => ({ ...c })));
      next[row][col] = {
        probed: true,
        hit: result.hit,
        adjacency: result.adjacency,
        mineSurge: result.mineSurge,
      };
      return next;
    });

    setPortsFound(result.portsFound);
    setProbesRemaining(result.probesRemaining);

    if (result.hit) {
      playSound("gameCorrect");
    }

    if (result.allFound) {
      setAllFound(true);
      setGameOver(true);
    } else if (result.gameOver) {
      setGameOver(true);
    }
  }, [gameOver, isSubmitting, grid, onMove]);

  // Auto-resolve when game over
  useEffect(() => {
    if (gameOver) {
      const t = setTimeout(onGameOver, 800);
      return () => clearTimeout(t);
    }
  }, [gameOver, onGameOver]);

  const cellSize = config.gridSize <= 6 ? "w-9 h-9" : "w-8 h-8";
  const fontSize = config.gridSize <= 6 ? "text-sm" : "text-xs";

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-cyber-cyan text-sm font-bold">PORT SWEEP</h3>
          <p className="text-text-muted text-[11px]">
            Find {config.portCount} open ports on the {config.gridSize}x{config.gridSize} grid
          </p>
        </div>
        <div className="flex items-center gap-2">
          {config.modifier && <ModifierBadge modifier={config.modifier} />}
          <GameTimer expiresAt={expiresAt} onExpired={onGameOver} />
        </div>
      </div>

      {/* Stats */}
      <div className="flex justify-center gap-6 text-[11px]">
        <span className="text-text-secondary">
          Ports: <span className="text-cyber-green font-bold">{portsFound}</span>/{config.portCount}
        </span>
        <span className="text-text-secondary">
          Probes: <span className="text-cyber-cyan font-bold">{probesRemaining}</span> left
        </span>
      </div>

      {/* Grid */}
      <div className="flex justify-center">
        <div
          className="inline-grid gap-1"
          style={{ gridTemplateColumns: `repeat(${config.gridSize}, minmax(0, 1fr))` }}
        >
          {grid.map((row, r) =>
            row.map((cell, c) => (
              <motion.button
                key={`${r}-${c}`}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleProbe(r, c)}
                disabled={cell.probed || gameOver || isSubmitting}
                className={`${cellSize} rounded border ${fontSize} font-mono font-bold flex items-center justify-center transition-all relative ${
                  cell.probed
                    ? cell.hit
                        ? "border-cyber-green bg-cyber-green/20 text-cyber-green"
                        : cell.mineSurge
                          ? "border-cyber-red/60 bg-cyber-red/10 text-cyber-red"
                          : cell.adjacency === 0
                            ? "border-border-default bg-bg-primary text-text-muted"
                            : "border-cyber-amber/40 bg-bg-primary text-cyber-amber"
                    : "border-border-default bg-bg-secondary hover:border-cyber-cyan hover:bg-cyber-cyan/5 text-transparent cursor-pointer"
                } disabled:cursor-default`}
              >
                {cell.probed ? (
                  cell.hit ? (
                    <span className="text-base">&#9679;</span>
                  ) : cell.mineSurge ? (
                    <span>-2</span>
                  ) : (
                    cell.adjacency ?? ""
                  )
                ) : (
                  ""
                )}
              </motion.button>
            ))
          )}
        </div>
      </div>

      {/* Game over banner */}
      {gameOver && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`text-center py-2 rounded border ${
            allFound
              ? "border-cyber-green/50 bg-cyber-green/10 text-cyber-green"
              : "border-cyber-amber/50 bg-cyber-amber/10 text-cyber-amber"
          }`}
        >
          <div className="text-sm font-bold">
            {allFound
              ? "ALL PORTS FOUND!"
              : `${portsFound}/${config.portCount} PORTS FOUND`}
          </div>
        </motion.div>
      )}

      {/* Legend */}
      <div className="flex gap-3 justify-center flex-wrap text-[10px]">
        <span className="text-cyber-green">&#9679; Port Found</span>
        <span className="text-cyber-amber">N = Adjacent Ports</span>
        <span className="text-text-muted">0 = No Nearby Ports</span>
        {config.modifier === "decoys" && (
          <span className="text-cyber-amber">DECOY = False Hit</span>
        )}
        {config.modifier === "mines" && (
          <span className="text-cyber-red">-2 = Mine (costs 2 probes)</span>
        )}
      </div>
    </div>
  );
}
