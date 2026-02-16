import { useEffect, useRef, type ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import bs58 from "bs58";

/**
 * Single component that owns all auth side effects.
 * Mount once at the app root — never duplicated.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { publicKey, signMessage, connected } = useWallet();
  const { isAuthenticated, setPlayer, logout } = useAuthStore();
  const authenticatingRef = useRef(false);

  // Auto-authenticate when wallet connects
  useEffect(() => {
    if (!connected || !publicKey || !signMessage || authenticatingRef.current) return;

    // If already authenticated with this wallet, skip
    const store = useAuthStore.getState();
    if (store.isAuthenticated && store.player?.walletAddress === publicKey.toBase58()) return;

    // Wallet changed or not yet authenticated — clear stale state and re-auth
    if (store.isAuthenticated && store.player?.walletAddress !== publicKey.toBase58()) {
      api.setToken(null);
      logout();
    }

    authenticatingRef.current = true;

    const walletAddress = publicKey.toBase58();

    api
      .authChallenge({ walletAddress })
      .then(({ nonce, message }) => {
        const messageBytes = new TextEncoder().encode(message);
        return signMessage(messageBytes).then((sig) => ({ nonce, signature: bs58.encode(sig) }));
      })
      .then(({ nonce, signature }) =>
        api.authVerify({ walletAddress, signature, nonce })
      )
      .then(({ token, player }) => {
        api.setToken(token);
        setPlayer(player);
      })
      .catch((err) => {
        console.error("Authentication failed:", err);
        api.setToken(null);
        logout();
      })
      .finally(() => {
        authenticatingRef.current = false;
      });
  }, [connected, publicKey, signMessage, setPlayer, logout]);

  // Restore session on mount (token in localStorage but store is empty)
  useEffect(() => {
    const token = api.getToken();
    if (!token || isAuthenticated) return;

    api
      .getMe()
      .then(({ player }) => setPlayer(player))
      .catch(() => {
        api.setToken(null);
        logout();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
