import { useEffect, useRef, type ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useTutorialStore } from "@/stores/tutorial";
import bs58 from "bs58";
import { usePlayer } from "@/hooks/usePlayer";

/**
 * Single component that owns all auth side effects.
 * Mount once at the app root — never duplicated.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { publicKey, signMessage, connected } = useWallet();
  const { isAuthenticated, setPlayer, logout } = useAuthStore();
  const initTutorial = useTutorialStore((s) => s.initFromPlayer);
  const authenticatingRef = useRef(false);
  const { data: livePlayer, error: livePlayerError } = usePlayer();

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
        initTutorial(player.tutorialStep);
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
      .then(({ player }) => {
        setPlayer(player);
        initTutorial(player.tutorialStep);
      })
      .catch(() => {
        api.setToken(null);
        logout();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep local auth store in sync with the polled /player/me query.
  useEffect(() => {
    if (livePlayer?.player) {
      setPlayer(livePlayer.player);
      initTutorial(livePlayer.player.tutorialStep);
    }
  }, [livePlayer?.player, setPlayer, initTutorial]);

  // Expired/invalid token while polling: clear session.
  useEffect(() => {
    if (!(livePlayerError instanceof ApiError)) return;
    if (livePlayerError.statusCode !== 401) return;

    api.setToken(null);
    logout();
  }, [livePlayerError, logout]);

  return <>{children}</>;
}
