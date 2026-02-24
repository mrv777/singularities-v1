import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  /** Format the number for display (default: toLocaleString) */
  format?: (n: number) => string;
  className?: string;
  /** Duration in ms (default: 400) */
  duration?: number;
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  className = "",
  duration = 400,
}: AnimatedNumberProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const prevValueRef = useRef(value);
  const rafRef = useRef<number>(0);
  const [flashClass, setFlashClass] = useState("");

  useEffect(() => {
    const prev = prevValueRef.current;
    if (prev === value) return;

    const diff = value - prev;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Flash color
    if (diff > 0) {
      setFlashClass("animate-num-gain");
    } else if (diff < 0) {
      setFlashClass("animate-num-loss");
    }
    const flashTimer = setTimeout(() => setFlashClass(""), 300);

    if (prefersReduced) {
      // Skip animation, just set value
      if (spanRef.current) spanRef.current.textContent = format(value);
      prevValueRef.current = value;
      return () => clearTimeout(flashTimer);
    }

    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutQuart(progress);
      const current = prev + diff * eased;

      if (spanRef.current) {
        spanRef.current.textContent = format(current);
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevValueRef.current = value;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(flashTimer);
    };
  }, [value, format, duration]);

  // Set initial value on mount
  useEffect(() => {
    if (spanRef.current) {
      spanRef.current.textContent = format(value);
    }
    prevValueRef.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span ref={spanRef} className={`${className} ${flashClass}`}>
      {format(value)}
    </span>
  );
}
