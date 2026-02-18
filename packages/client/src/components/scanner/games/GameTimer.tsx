import { useEffect, useState } from "react";

interface GameTimerProps {
  expiresAt: string;
  onExpired: () => void;
}

export function GameTimer({ expiresAt, onExpired }: GameTimerProps) {
  const [remaining, setRemaining] = useState(() => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 1000));
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      const secs = Math.max(0, Math.ceil(ms / 1000));
      setRemaining(secs);
      if (secs <= 0) {
        clearInterval(timer);
        onExpired();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [expiresAt, onExpired]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isLow = remaining <= 15;
  const isCritical = remaining <= 5;

  return (
    <div
      className={`font-mono text-sm font-bold tabular-nums ${
        isCritical
          ? "text-cyber-red animate-pulse"
          : isLow
            ? "text-cyber-amber"
            : "text-text-secondary"
      }`}
    >
      {minutes}:{seconds.toString().padStart(2, "0")}
    </div>
  );
}
