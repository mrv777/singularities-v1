import type { ReactNode } from "react";
import { Header } from "./Header";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary scanlines">
      <Header />
      <main className="p-4 lg:p-6">{children}</main>
    </div>
  );
}
