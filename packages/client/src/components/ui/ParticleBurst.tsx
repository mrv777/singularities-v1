import { useEffect, useState } from "react";

interface BurstInstance {
  id: string;
  x: number;
  y: number;
  color: string;
}

// Event bus
type ParticleListener = (event: { x: number; y: number; color: string }) => void;
const particleListeners = new Set<ParticleListener>();

export function emitParticle(x: number, y: number, color = "var(--color-cyber-cyan)") {
  particleListeners.forEach((l) => l({ x, y, color }));
}

const PARTICLE_COUNT = 6;

function SingleBurst({
  x,
  y,
  color,
  onDone,
}: {
  x: number;
  y: number;
  color: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <>
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (i / PARTICLE_COUNT) * 360;
        const distance = 25 + Math.random() * 25;
        const dx = Math.cos((angle * Math.PI) / 180) * distance;
        const dy = Math.sin((angle * Math.PI) / 180) * distance;
        const delay = Math.random() * 0.1;
        return (
          <div
            key={i}
            style={{
              position: "fixed",
              left: x,
              top: y,
              width: 3 + Math.random() * 3,
              height: 3 + Math.random() * 3,
              borderRadius: "50%",
              backgroundColor: color,
              boxShadow: `0 0 4px ${color}`,
              pointerEvents: "none",
              animation: `particle-burst 0.7s ${delay}s ease-out forwards`,
              "--dx": `${dx}px`,
              "--dy": `${dy}px`,
            } as React.CSSProperties}
          />
        );
      })}
    </>
  );
}

export function ParticleLayer() {
  const [bursts, setBursts] = useState<BurstInstance[]>([]);

  useEffect(() => {
    const handler: ParticleListener = ({ x, y, color }) => {
      const id = Math.random().toString(36).slice(2);
      setBursts((prev) => [...prev, { id, x, y, color }]);
    };
    particleListeners.add(handler);
    return () => {
      particleListeners.delete(handler);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9997]" aria-hidden>
      {bursts.map((b) => (
        <SingleBurst
          key={b.id}
          x={b.x}
          y={b.y}
          color={b.color}
          onDone={() => setBursts((prev) => prev.filter((p) => p.id !== b.id))}
        />
      ))}
    </div>
  );
}
