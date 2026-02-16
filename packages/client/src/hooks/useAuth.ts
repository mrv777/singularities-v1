import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

/**
 * Read-only hook for auth state + logout action.
 * Side effects (auto-auth, session restore) live in AuthGate — not here.
 * Safe to call from multiple components without duplicate work.
 */
export function useAuth() {
  const { disconnect } = useWallet();
  const { player, isAuthenticated, logout } = useAuthStore();

  const handleLogout = useCallback(() => {
    api.setToken(null);
    logout();
    disconnect();
  }, [logout, disconnect]);

  return {
    player,
    isAuthenticated,
    logout: handleLogout,
  };
}
