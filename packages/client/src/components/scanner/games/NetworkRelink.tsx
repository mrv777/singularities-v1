import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import type {
  GameMoveResult,
  NetworkRelinkConfig,
  NetworkRelinkMoveResult,
} from "@singularities/shared";
import { RELINK_COLORS } from "@singularities/shared";
import { GameTimer } from "./GameTimer";
import { playSound } from "@/lib/sound";

interface NetworkRelinkProps {
  config: NetworkRelinkConfig;
  expiresAt: string;
  onMove: (paths: Array<{ pairIndex: number; cells: [number, number][] }>, drawCount: number) => Promise<NetworkRelinkMoveResult | null>;
  onGameOver: () => void;
  isSubmitting: boolean;
  initialMoveHistory?: GameMoveResult[];
}

type CellOwner = { pairIndex: number; pathPos: number } | null;

export function NetworkRelink({
  config,
  expiresAt,
  onMove,
  onGameOver,
  isSubmitting,
  initialMoveHistory = [],
}: NetworkRelinkProps) {
  const N = config.gridSize;
  const totalPairs = config.pairs;

  // Grid ownership: which pair (if any) owns each cell
  const [grid, setGrid] = useState<CellOwner[][]>(() =>
    Array.from({ length: N }, () => Array.from({ length: N }, () => null))
  );

  // Paths for each pair: cells in order
  const [paths, setPaths] = useState<Map<number, [number, number][]>>(() => new Map());

  // Currently drawing path for which pair
  const [activePair, setActivePair] = useState<number | null>(null);

  // Track draw count for anti-cheat
  const [drawCount, setDrawCount] = useState(0);

  // Game state
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState<NetworkRelinkMoveResult | null>(null);

  // Mouse/touch tracking
  const isDrawing = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const prior = initialMoveHistory.filter(
      (m): m is NetworkRelinkMoveResult => m.type === "network_relink"
    );
    if (prior.length === 0) return;

    const last = prior[prior.length - 1];
    setResult(last);
    setGameOver(last.gameOver);
  }, [initialMoveHistory]);

  // Build endpoint lookup — useMemo so it's available on the very first render
  const endpointMap = useMemo(() => {
    const map = new Map<string, number>();
    config.endpoints.forEach(([[r1, c1], [r2, c2]], i) => {
      map.set(`${r1},${c1}`, i);
      map.set(`${r2},${c2}`, i);
    });
    return map;
  }, [config.endpoints]);

  const getEndpointPair = (r: number, c: number): number | undefined => {
    return endpointMap.get(`${r},${c}`);
  };

  const isEndpoint = (r: number, c: number): boolean => {
    return endpointMap.has(`${r},${c}`);
  };

  const getEndpoints = (pairIndex: number): [[number, number], [number, number]] => {
    return config.endpoints[pairIndex];
  };

  // Get completed pair count
  const completedPairs = (() => {
    let count = 0;
    paths.forEach((cells, pairIndex) => {
      if (cells.length < 2) return;
      const [[ep1r, ep1c], [ep2r, ep2c]] = getEndpoints(pairIndex);
      const [sr, sc] = cells[0];
      const [er, ec] = cells[cells.length - 1];
      const connected = (sr === ep1r && sc === ep1c && er === ep2r && ec === ep2c)
        || (sr === ep2r && sc === ep2c && er === ep1r && ec === ep1c);
      if (connected) count++;
    });
    return count;
  })();

  // Count filled cells
  const filledCells = (() => {
    let count = 0;
    for (const row of grid) {
      for (const cell of row) {
        if (cell !== null) count++;
      }
    }
    return count;
  })();

  const clearPathFromGrid = useCallback((pairIndex: number, currentGrid: CellOwner[][]) => {
    const newGrid = currentGrid.map(row => row.map(cell =>
      cell && cell.pairIndex === pairIndex ? null : cell
    ));
    return newGrid;
  }, []);

  const handleCellInteraction = useCallback((r: number, c: number) => {
    if (gameOver || isSubmitting) return;

    const cellOwner = grid[r][c];
    const epPair = getEndpointPair(r, c);

    // If clicking on an endpoint
    if (epPair !== undefined) {
      // If this endpoint's pair already has a path, clear it
      if (paths.has(epPair)) {
        setGrid(prev => clearPathFromGrid(epPair, prev));
        setPaths(prev => {
          const next = new Map(prev);
          next.delete(epPair);
          return next;
        });
      }

      // Start a new path from this endpoint
      setActivePair(epPair);
      isDrawing.current = true;
      setDrawCount(d => d + 1);

      // Place the first cell
      setGrid(prev => {
        const next = prev.map(row => [...row]);
        next[r][c] = { pairIndex: epPair, pathPos: 0 };
        return next;
      });
      setPaths(prev => {
        const next = new Map(prev);
        next.set(epPair, [[r, c]]);
        return next;
      });

      playSound("gameMove");
      return;
    }

    // If clicking on an existing path cell, clear that path
    if (cellOwner !== null) {
      const pi = cellOwner.pairIndex;
      setGrid(prev => clearPathFromGrid(pi, prev));
      setPaths(prev => {
        const next = new Map(prev);
        next.delete(pi);
        return next;
      });
      setActivePair(null);
      isDrawing.current = false;
      return;
    }

    // If actively drawing, extend the path
    if (activePair !== null && isDrawing.current) {
      extendPath(r, c);
    }
  }, [gameOver, isSubmitting, grid, paths, activePair, clearPathFromGrid]);

  const extendPath = useCallback((r: number, c: number) => {
    if (activePair === null) return;

    const currentPath = paths.get(activePair);
    if (!currentPath || currentPath.length === 0) return;

    const [lastR, lastC] = currentPath[currentPath.length - 1];

    // Must be 4-directional adjacent
    const dr = Math.abs(r - lastR);
    const dc = Math.abs(c - lastC);
    if (dr + dc !== 1) return;

    // Check bounds
    if (r < 0 || r >= N || c < 0 || c >= N) return;

    // If cell is an endpoint for THIS pair, allow it (completing the path)
    const epPair = getEndpointPair(r, c);
    if (epPair === activePair) {
      // Check it's the OTHER endpoint (not the one we started from)
      const [[ep1r, ep1c], [ep2r, ep2c]] = getEndpoints(activePair);
      const [startR, startC] = currentPath[0];
      const isOtherEnd = (r !== startR || c !== startC)
        && ((r === ep1r && c === ep1c) || (r === ep2r && c === ep2c));

      if (isOtherEnd) {
        // Complete the path
        const newPath: [number, number][] = [...currentPath, [r, c]];
        setGrid(prev => {
          const next = prev.map(row => [...row]);
          next[r][c] = { pairIndex: activePair, pathPos: newPath.length - 1 };
          return next;
        });
        setPaths(prev => {
          const next = new Map(prev);
          next.set(activePair, newPath);
          return next;
        });
        setActivePair(null);
        isDrawing.current = false;
        playSound("gameCorrect");
        return;
      }
    }

    // If cell is occupied by another pair's endpoint, skip
    if (epPair !== undefined && epPair !== activePair) return;

    // Cell must be empty
    if (grid[r][c] !== null) return;

    // Extend
    const newPath: [number, number][] = [...currentPath, [r, c]];
    setGrid(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = { pairIndex: activePair, pathPos: newPath.length - 1 };
      return next;
    });
    setPaths(prev => {
      const next = new Map(prev);
      next.set(activePair, newPath);
      return next;
    });
  }, [activePair, paths, grid, N]);

  const handleCellHover = useCallback((r: number, c: number) => {
    if (!isDrawing.current || activePair === null || gameOver || isSubmitting) return;
    extendPath(r, c);
  }, [activePair, gameOver, isSubmitting, extendPath]);

  const handleMouseUp = useCallback(() => {
    if (isDrawing.current && activePair !== null) {
      // Check if path is complete (connects both endpoints)
      const currentPath = paths.get(activePair);
      if (currentPath && currentPath.length >= 2) {
        const [[ep1r, ep1c], [ep2r, ep2c]] = getEndpoints(activePair);
        const [sr, sc] = currentPath[0];
        const [er, ec] = currentPath[currentPath.length - 1];
        const connected = (sr === ep1r && sc === ep1c && er === ep2r && ec === ep2c)
          || (sr === ep2r && sc === ep2c && er === ep1r && ec === ep1c);

        if (!connected) {
          // Path incomplete — keep it for now (partial credit)
        }
      }
    }
    isDrawing.current = false;
    setActivePair(null);
  }, [activePair, paths]);

  // Global mouse up listener
  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchend", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [handleMouseUp]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting || gameOver) return;

    const pathArray: Array<{ pairIndex: number; cells: [number, number][] }> = [];
    paths.forEach((cells, pairIndex) => {
      if (cells.length >= 2) {
        pathArray.push({ pairIndex, cells });
      }
    });

    const res = await onMove(pathArray, drawCount);
    if (!res) return;

    setResult(res);
    setGameOver(true);
  }, [isSubmitting, gameOver, paths, drawCount, onMove]);

  const handleClearAll = useCallback(() => {
    if (gameOver || isSubmitting) return;
    setGrid(Array.from({ length: N }, () => Array.from({ length: N }, () => null)));
    setPaths(new Map());
    setActivePair(null);
    isDrawing.current = false;
  }, [gameOver, isSubmitting, N]);

  // Auto-resolve when game over
  useEffect(() => {
    if (gameOver) {
      const t = setTimeout(onGameOver, 1200);
      return () => clearTimeout(t);
    }
  }, [gameOver, onGameOver]);

  // Cell sizing based on grid size
  const cellPx = N <= 6 ? 44 : N <= 7 ? 38 : 34;
  const gapPx = 2;

  const getCellColor = (r: number, c: number): string | null => {
    const owner = grid[r][c];
    if (owner !== null) {
      return RELINK_COLORS[owner.pairIndex % RELINK_COLORS.length];
    }
    return null;
  };

  const getEndpointColor = (r: number, c: number): string | null => {
    const epPair = getEndpointPair(r, c);
    if (epPair !== undefined) {
      return RELINK_COLORS[epPair % RELINK_COLORS.length];
    }
    return null;
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-cyber-cyan text-sm font-bold">NETWORK RELINK</h3>
          <p className="text-text-muted text-[11px]">
            Draw paths between matching colored dots — fill every cell
          </p>
        </div>
        <GameTimer expiresAt={expiresAt} onExpired={handleSubmit} />
      </div>

      {/* How to play hint */}
      {!gameOver && (
        <div className="text-[10px] text-text-muted text-center border border-border-default rounded px-2 py-1.5 bg-bg-secondary/50">
          Click a colored dot to start drawing, then click adjacent cells to trace a path to its matching dot. Click an existing path to erase it.
        </div>
      )}

      {/* Stats */}
      <div className="flex justify-center gap-6 text-[11px]">
        <span className="text-text-secondary">
          Links: <span className="text-cyber-green font-bold">{completedPairs}</span>/{totalPairs}
        </span>
        <span className="text-text-secondary">
          Coverage: <span className="text-cyber-cyan font-bold">{Math.round((filledCells / (N * N)) * 100)}%</span>
        </span>
      </div>

      {/* Grid */}
      <div className="flex justify-center select-none">
        <div
          ref={gridRef}
          className="inline-grid"
          style={{
            gridTemplateColumns: `repeat(${N}, ${cellPx}px)`,
            gap: `${gapPx}px`,
          }}
          onMouseLeave={() => {
            if (isDrawing.current) {
              // Don't end drawing on grid leave — wait for mouseup
            }
          }}
        >
          {Array.from({ length: N }).map((_, r) =>
            Array.from({ length: N }).map((_, c) => {
              const owner = grid[r][c];
              const epColor = getEndpointColor(r, c);
              const cellColor = getCellColor(r, c);
              const isEp = isEndpoint(r, c);
              const ownerColor = cellColor || epColor;

              return (
                <div
                  key={`${r}-${c}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleCellInteraction(r, c);
                  }}
                  onMouseEnter={() => handleCellHover(r, c)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    handleCellInteraction(r, c);
                  }}
                  className={`rounded flex items-center justify-center cursor-pointer transition-all duration-75 ${
                    gameOver ? "pointer-events-none" : ""
                  }`}
                  style={{
                    width: cellPx,
                    height: cellPx,
                    backgroundColor: ownerColor
                      ? `${ownerColor}${owner !== null ? "30" : "15"}`
                      : "rgba(255,255,255,0.03)",
                    border: isEp
                      ? `2px solid ${epColor}`
                      : owner !== null
                        ? `1px solid ${cellColor}50`
                        : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {isEp && (
                    <div
                      className="rounded-full"
                      style={{
                        width: cellPx * 0.45,
                        height: cellPx * 0.45,
                        backgroundColor: epColor ?? undefined,
                        boxShadow: epColor ? `0 0 6px ${epColor}` : undefined,
                      }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Color legend */}
      <div className="flex gap-2 justify-center flex-wrap">
        {config.endpoints.map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-1"
          >
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: RELINK_COLORS[i % RELINK_COLORS.length] }}
            />
            <span
              className="text-[10px] font-mono font-bold"
              style={{ color: RELINK_COLORS[i % RELINK_COLORS.length] }}
            >
              {i + 1}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      {!gameOver && (
        <div className="flex gap-2 justify-center">
          <button
            onClick={handleClearAll}
            disabled={isSubmitting || filledCells === 0}
            className="px-3 py-1.5 text-xs border border-border-default text-text-secondary rounded hover:border-cyber-amber transition-colors disabled:opacity-30"
          >
            CLEAR ALL
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-1.5 text-xs border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/10 transition-colors disabled:opacity-30 font-bold"
          >
            {isSubmitting ? "..." : "SUBMIT SOLUTION"}
          </button>
        </div>
      )}

      {/* Result banner */}
      {gameOver && result && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`text-center py-2 rounded border ${
            result.connectedPairs === result.totalPairs && result.filledCells === result.totalCells
              ? "border-cyber-green/50 bg-cyber-green/10 text-cyber-green"
              : result.connectedPairs > 0
                ? "border-cyber-amber/50 bg-cyber-amber/10 text-cyber-amber"
                : "border-cyber-red/50 bg-cyber-red/10 text-cyber-red"
          }`}
        >
          <div className="text-sm font-bold">
            {result.connectedPairs === result.totalPairs && result.filledCells === result.totalCells
              ? "NETWORK FULLY RESTORED!"
              : `${result.connectedPairs}/${result.totalPairs} LINKS RESTORED`}
          </div>
          <div className="text-[10px] mt-0.5 opacity-70">
            Score: {result.score}%
          </div>
        </motion.div>
      )}
    </div>
  );
}
