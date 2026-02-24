import { create } from "zustand";

export type ToastType =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "levelup"
  | "combat";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, title: string, description?: string) => void;
  dismissToast: (id: string) => void;
}

const MAX_TOASTS = 4;
const TOAST_DURATION = 6000;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (type, title, description) => {
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = { id, type, title, description, createdAt: Date.now() };

    set((state) => ({
      toasts: [...state.toasts.slice(-(MAX_TOASTS - 1)), toast],
    }));

    // Auto-dismiss
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, TOAST_DURATION);
  },
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
