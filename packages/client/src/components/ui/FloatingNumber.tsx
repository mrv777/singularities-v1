import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

export type FloatColor = "green" | "cyan" | "amber" | "purple";

interface FloatingNumberInstance {
  id: string;
  value: string;
  color: FloatColor;
  x: number;
  y: number;
}

const COLOR_MAP: Record<FloatColor, string> = {
  green: "var(--color-cyber-green)",
  cyan: "var(--color-cyber-cyan)",
  amber: "var(--color-cyber-amber)",
  purple: "var(--color-cyber-magenta)",
};

// Simple event bus — avoids Zustand subscription churn for fire-and-forget events
type FloatEvent = Omit<FloatingNumberInstance, "id">;
type FloatListener = (event: FloatEvent) => void;
const floatListeners = new Set<FloatListener>();

export function emitFloat(value: string, color: FloatColor, x: number, y: number) {
  floatListeners.forEach((l) => l({ value, color, x, y }));
}

export function FloatingNumberLayer() {
  const [floats, setFloats] = useState<FloatingNumberInstance[]>([]);

  useEffect(() => {
    const handler: FloatListener = (event) => {
      const id = Math.random().toString(36).slice(2);
      setFloats((prev) => [...prev, { ...event, id }]);
      // Self-cleanup after animation completes
      setTimeout(() => {
        setFloats((prev) => prev.filter((f) => f.id !== id));
      }, 1400);
    };
    floatListeners.add(handler);
    return () => {
      floatListeners.delete(handler);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9998]" aria-hidden>
      <AnimatePresence>
        {floats.map((f) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: 0, scale: 1.3, y: -60 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: f.x,
              top: f.y,
              color: COLOR_MAP[f.color],
              fontFamily: "var(--font-mono)",
              fontWeight: "bold",
              fontSize: "14px",
              textShadow: `0 0 12px ${COLOR_MAP[f.color]}, 0 0 24px ${COLOR_MAP[f.color]}80`,
              pointerEvents: "none",
              userSelect: "none",
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
            }}
          >
            {f.value}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
