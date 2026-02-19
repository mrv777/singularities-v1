import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { playSound } from "@/lib/sound";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useUITier } from "@/hooks/useUITier";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
  /** Optional full-panel background image — covers the entire modal including title bar */
  backgroundSrc?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-2xl",
  backgroundSrc,
}: ModalProps) {
  const isMobile = useIsMobile();
  const { tier } = useUITier();
  const prevOpen = useRef(open);

  useEffect(() => {
    if (open && !prevOpen.current) playSound("navOpen");
    if (!open && prevOpen.current) playSound("navClose");
    prevOpen.current = open;
  }, [open]);

  // Tier-aware animation variants
  const contentAnimation = tier === 1
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } as const }
    : tier === 3
      ? { initial: { y: 20, scale: 0.95 }, animate: { y: 0, scale: 1 }, exit: { y: 20, scale: 0.95 }, transition: { type: "spring" as const, stiffness: 400, damping: 25 } }
      : { initial: { y: 20, scale: 0.97 }, animate: { y: 0, scale: 1 }, exit: { y: 20, scale: 0.97 }, transition: { duration: 0.25, ease: "easeOut" as const } };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 bg-[#0a0a0f]/90 z-50"
                onClick={onClose}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <Dialog.Content aria-describedby={undefined} asChild>
              {isMobile ? (
                /* Mobile: bottom sheet — keep as-is for UX */
                <motion.div
                  className="fixed inset-x-0 bottom-0 z-50 pointer-events-auto"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <div className="border-t border-border-default bg-bg-surface rounded-t-xl overflow-hidden max-h-[90vh] flex flex-col safe-bottom">
                    {/* Drag handle */}
                    <motion.div
                      className="flex justify-center py-2 cursor-grab active:cursor-grabbing"
                      drag="y"
                      dragConstraints={{ top: 0 }}
                      dragElastic={0.2}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="w-10 h-1 rounded-full bg-border-bright" />
                    </motion.div>

                    <div className="flex items-center justify-between px-4 py-2 border-b border-border-default bg-bg-secondary shrink-0">
                      <Dialog.Title className="text-cyber-cyan text-sm font-semibold tracking-wider">
                        {title}
                      </Dialog.Title>
                      <Dialog.Close asChild>
                        <button className="text-text-muted hover:text-cyber-cyan transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                          <X size={18} />
                        </button>
                      </Dialog.Close>
                    </div>
                    <div className="p-4 overflow-y-auto flex-1">
                      {children}
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* Desktop: angled game panel */
                <motion.div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto"
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) onClose();
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <motion.div
                    className={`w-full ${maxWidth} border border-border-default bg-bg-surface border-glow-cyan pointer-events-auto max-h-[calc(100vh-2rem)] flex flex-col modal-panel relative overflow-hidden`}
                    {...contentAnimation}
                  >
                    {/* Full-panel background image layer */}
                    {backgroundSrc && (
                      <div className="absolute inset-0 pointer-events-none">
                        <img
                          src={backgroundSrc}
                          alt=""
                          className="w-full h-full object-cover"
                          style={{ filter: "blur(6px) brightness(0.6)", transform: "scale(1.05)" }}
                        />
                        {/* Radial vignette — keeps center readable, edges show image */}
                        <div
                          className="absolute inset-0"
                          style={{
                            background: "radial-gradient(ellipse at center, rgba(26,26,36,0.6) 30%, rgba(26,26,36,0.1) 100%)",
                          }}
                        />
                      </div>
                    )}

                    {/* Title bar — angled left accent + separator */}
                    <div
                      className="relative z-10 flex items-center justify-between px-5 py-3 border-b border-cyber-cyan/20 shrink-0"
                      style={{
                        borderLeft: "4px solid var(--color-cyber-cyan)",
                        background: backgroundSrc
                          ? "rgba(17,17,24,0.75)"
                          : "var(--color-bg-secondary)",
                        backdropFilter: backgroundSrc ? "blur(4px)" : undefined,
                      }}
                    >
                      {/* HUD corner decorations */}
                      <div className="hud-corner hud-corner-lg hud-corner-tl border-cyber-cyan" style={{ opacity: 0.9 }} />
                      <div className="hud-corner hud-corner-lg hud-corner-br border-cyber-cyan" style={{ opacity: 0.9 }} />

                      <Dialog.Title className="text-cyber-cyan text-sm font-bold tracking-[0.2em] uppercase flex items-center gap-2">
                        <span className="text-cyber-cyan/60 text-xs">▸</span>
                        {title}
                      </Dialog.Title>
                      <Dialog.Close asChild>
                        <motion.button
                          className="text-text-muted hover:text-cyber-cyan transition-colors p-1.5 rounded border border-transparent hover:border-cyber-cyan/30"
                          whileTap={{ scale: 0.9 }}
                        >
                          <X size={14} />
                        </motion.button>
                      </Dialog.Close>
                    </div>

                    {/* Cyan accent separator line */}
                    <div
                      className="relative z-10 h-px shrink-0"
                      style={{
                        background: "linear-gradient(to right, var(--color-cyber-cyan), transparent)",
                        opacity: 0.3,
                      }}
                    />

                    <div className="relative z-10 p-4 overflow-y-auto flex-1">
                      {children}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
