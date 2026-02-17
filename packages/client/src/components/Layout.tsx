import type { ReactNode } from "react";
import { Header } from "./Header";
import { useUITier } from "@/hooks/useUITier";

export function Layout({ children }: { children: ReactNode }) {
  const { tierClass } = useUITier();

  return (
    <div className={`min-h-screen bg-bg-primary scanlines ${tierClass}`}>
      <Header />
      <main className="p-4 lg:p-6">{children}</main>
    </div>
  );
}
