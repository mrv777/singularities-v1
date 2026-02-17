import { create } from "zustand";
import { soundManager } from "@/lib/sound";

interface UIState {
  sidebarOpen: boolean;
  activeModal: string | null;
  soundEnabled: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  openModal: (id: string) => void;
  closeModal: () => void;
  toggleSound: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  activeModal: null,
  soundEnabled: soundManager.isEnabled,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
  toggleSound: () => {
    const enabled = soundManager.toggle();
    set({ soundEnabled: enabled });
  },
}));
