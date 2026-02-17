import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletProvider } from "@/components/WalletProvider";
import { AuthGate } from "@/components/AuthGate";
import { router } from "./router";
import { soundManager } from "@/lib/sound";
import "./styles/globals.css";

function initializeSound() {
  soundManager.unlock();
  soundManager.preload();
}

// Unlock the audio context and preload sounds on first direct interaction.
document.addEventListener("pointerdown", initializeSound, { once: true });
document.addEventListener("keydown", initializeSound, { once: true });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <AuthGate>
          <RouterProvider router={router} />
        </AuthGate>
      </WalletProvider>
    </QueryClientProvider>
  </StrictMode>
);
