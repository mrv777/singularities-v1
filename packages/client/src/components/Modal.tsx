import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";

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
            <Dialog.Content asChild>
              <motion.div
                className={`fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] ${maxWidth} -translate-x-1/2 -translate-y-1/2 border border-border-default bg-bg-surface rounded-lg border-glow-cyan overflow-hidden`}
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border-default bg-bg-secondary">
                  <Dialog.Title className="text-cyber-cyan text-sm font-semibold tracking-wider">
                    {title}
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button className="text-text-muted hover:text-cyber-cyan transition-colors p-1">
                      <X size={16} />
                    </button>
                  </Dialog.Close>
                </div>
                <div className="p-4 max-h-[70vh] overflow-y-auto">
                  {children}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
