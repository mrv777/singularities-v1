import * as Tooltip from "@radix-ui/react-tooltip";
import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";
import { useState } from "react";

interface CyberTooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

export function CyberTooltip({
  content,
  children,
  side = "top",
  align = "center",
}: CyberTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Trigger asChild>
        <span
          className="cursor-help"
          onPointerDown={() => setOpen((v) => !v)}
        >
          {children}
        </span>
      </Tooltip.Trigger>
      <AnimatePresence>
        {open && (
          <Tooltip.Portal forceMount>
            <Tooltip.Content
              side={side}
              align={align}
              sideOffset={6}
              asChild
              onPointerDownOutside={() => setOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.12 }}
                className="z-[100] rounded border border-border-bright bg-bg-elevated px-2.5 py-1.5 text-[10px] font-mono text-text-primary shadow-lg shadow-black/50 max-w-[220px] relative"
              >
                <div className="hud-corner hud-corner-tl !border-cyber-cyan opacity-40" />
                <div className="hud-corner hud-corner-br !border-cyber-cyan opacity-40" />
                {content}
                <Tooltip.Arrow className="fill-bg-elevated" />
              </motion.div>
            </Tooltip.Content>
          </Tooltip.Portal>
        )}
      </AnimatePresence>
    </Tooltip.Root>
  );
}
