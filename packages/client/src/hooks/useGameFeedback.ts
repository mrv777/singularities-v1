import { useCallback } from "react";
import { emitFloat, type FloatColor } from "@/components/ui/FloatingNumber";
import { emitParticle } from "@/components/ui/ParticleBurst";

function getElementCenter(element: HTMLElement | null | undefined): { x: number; y: number } {
  if (!element) {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export function useGameFeedback() {
  /** Emit a floating number at the given element's center position */
  const emitFloatNumber = useCallback(
    (value: string, color: FloatColor, element?: HTMLElement | null) => {
      const { x, y } = getElementCenter(element);
      emitFloat(value, color, x, y);
    },
    []
  );

  /** Emit a particle burst at the given element's center position */
  const emitParticleBurst = useCallback(
    (element?: HTMLElement | null, color?: string) => {
      const { x, y } = getElementCenter(element);
      emitParticle(x, y, color);
    },
    []
  );

  /**
   * Trigger a CSS screen-shake animation.
   * - subtle: 3px — for warnings, minor hits
   * - dramatic: 8px — for death, critical events
   * Skipped when prefers-reduced-motion is active.
   */
  const triggerShake = useCallback((intensity: "subtle" | "dramatic" = "subtle") => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    // Remove attribute first to allow re-triggering
    root.removeAttribute("data-shake");
    // Force reflow so removing + re-adding the attribute registers as a new animation
    void root.offsetWidth;
    root.setAttribute("data-shake", intensity);
    setTimeout(() => root.removeAttribute("data-shake"), 650);
  }, []);

  return { emitFloatNumber, emitParticleBurst, triggerShake };
}
