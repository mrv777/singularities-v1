import type { ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Header } from "./Header";
import { MobileSidebar } from "./MobileSidebar";
import { useUITier } from "@/hooks/useUITier";
import { FloatingNumberLayer } from "./ui/FloatingNumber";
import { ParticleLayer } from "./ui/ParticleBurst";
import { ToastLayer } from "./ui/ToastLayer";

export function Layout({ children }: { children: ReactNode }) {
  const { tierClass } = useUITier();

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className={`min-h-screen bg-bg-primary scanlines relative overflow-x-hidden ${tierClass}`}>
        {/* Background patterns */}
        <div className="fixed inset-0 cyber-grid pointer-events-none opacity-40" />

        <Header />
        <MobileSidebar />
        <main className="relative z-10 p-4 lg:p-6">{children}</main>

        {/* Game feedback overlays — pointer-events: none, highest z-index */}
        <FloatingNumberLayer />
        <ParticleLayer />
        <ToastLayer />
      </div>
    </Tooltip.Provider>
  );
}
