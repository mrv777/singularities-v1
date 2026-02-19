import type { ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Header } from "./Header";
import { useUITier } from "@/hooks/useUITier";
import { FloatingNumberLayer } from "./ui/FloatingNumber";
import { ParticleLayer } from "./ui/ParticleBurst";

export function Layout({ children }: { children: ReactNode }) {
  const { tierClass } = useUITier();

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className={`min-h-screen bg-bg-primary scanlines relative overflow-x-hidden ${tierClass}`}>
        {/* Background patterns */}
        <div className="fixed inset-0 cyber-grid pointer-events-none opacity-40" />

        <Header />
        <main className="relative z-10 p-4 lg:p-6">{children}</main>

        {/* Game feedback overlays — pointer-events: none, highest z-index */}
        <FloatingNumberLayer />
        <ParticleLayer />
      </div>
    </Tooltip.Provider>
  );
}
