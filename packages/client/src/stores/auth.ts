import { create } from "zustand";
import type { Player } from "@singularities/shared";

interface AuthState {
  player: Player | null;
  isAuthenticated: boolean;
  setPlayer: (player: Player) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  player: null,
  isAuthenticated: false,
  setPlayer: (player) => set({ player, isAuthenticated: true }),
  logout: () => set({ player: null, isAuthenticated: false }),
}));
