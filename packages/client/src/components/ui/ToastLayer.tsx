import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useToastStore, type ToastType } from "@/stores/toast";
import { playSound } from "@/lib/sound";
import { useEffect, useRef } from "react";

const ACCENT_COLORS: Record<ToastType, string> = {
  success: "border-l-cyber-green",
  warning: "border-l-cyber-amber",
  error: "border-l-cyber-red",
  info: "border-l-cyber-cyan",
  levelup: "border-l-cyber-magenta",
  combat: "border-l-cyber-green",
};

const TITLE_COLORS: Record<ToastType, string> = {
  success: "text-cyber-green",
  warning: "text-cyber-amber",
  error: "text-cyber-red",
  info: "text-cyber-cyan",
  levelup: "text-cyber-magenta",
  combat: "text-cyber-green",
};

export function ToastLayer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);
  const prevCountRef = useRef(0);

  // Play notification sound when a new toast appears
  useEffect(() => {
    if (toasts.length > prevCountRef.current) {
      playSound("notification");
    }
    prevCountRef.current = toasts.length;
  }, [toasts.length]);

  return (
    <div className="fixed bottom-20 right-4 z-[55] flex flex-col gap-2 pointer-events-none max-sm:left-4 max-sm:right-4 max-sm:bottom-20">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`pointer-events-auto hud-box rounded-sm px-3 py-2.5 border-l-[3px] ${ACCENT_COLORS[toast.type]} w-72 max-sm:w-full cursor-pointer`}
            onClick={() => dismissToast(toast.id)}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className={`text-[11px] font-bold tracking-wider uppercase ${TITLE_COLORS[toast.type]}`}>
                  {toast.title}
                </div>
                {toast.description && (
                  <div className="text-[10px] text-text-secondary mt-0.5 line-clamp-2">
                    {toast.description}
                  </div>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissToast(toast.id);
                }}
                className="text-text-muted hover:text-text-secondary transition-colors shrink-0 mt-0.5"
              >
                <X size={12} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
