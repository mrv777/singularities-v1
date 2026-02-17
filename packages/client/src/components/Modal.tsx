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
}

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-2xl",
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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <Dialog.Content aria-describedby={undefined} asChild>
              {isMobile ? (
                /* Mobile: bottom sheet */
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
                /* Desktop: centered modal */
                <motion.div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <motion.div
                    className={`w-full ${maxWidth} border border-border-default bg-bg-surface rounded-lg border-glow-cyan overflow-hidden pointer-events-auto max-h-[calc(100vh-2rem)] flex flex-col`}
                    {...contentAnimation}
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border-default bg-bg-secondary shrink-0">
                      <Dialog.Title className="text-cyber-cyan text-sm font-semibold tracking-wider">
                        {title}
                      </Dialog.Title>
                      <Dialog.Close asChild>
                        <button className="text-text-muted hover:text-cyber-cyan transition-colors p-1">
                          <X size={16} />
                        </button>
                      </Dialog.Close>
                    </div>
                    <div className="p-4 overflow-y-auto">
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
