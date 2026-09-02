import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  showToast: (message: string) => void;
  dismissToast: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  showToast: (message) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, message }] });
    window.setTimeout(() => get().dismissToast(id), 2200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
