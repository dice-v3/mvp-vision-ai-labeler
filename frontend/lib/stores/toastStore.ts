import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // ms, default 3000
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = {
      id,
      duration: 3000,
      ...toast,
    };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    // Auto-remove after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, newToast.duration);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => {
    set({ toasts: [] });
  },
}));

// Helper functions for convenience with type-specific default durations
export const toast = {
  success: (message: string, duration?: number) => {
    useToastStore.getState().addToast({
      type: 'success',
      message,
      duration: duration ?? 2000  // Default: 2 seconds
    });
  },
  error: (message: string, duration?: number) => {
    useToastStore.getState().addToast({
      type: 'error',
      message,
      duration: duration ?? 5000  // Default: 5 seconds
    });
  },
  warning: (message: string, duration?: number) => {
    useToastStore.getState().addToast({
      type: 'warning',
      message,
      duration: duration ?? 3000  // Default: 3 seconds
    });
  },
  info: (message: string, duration?: number) => {
    useToastStore.getState().addToast({
      type: 'info',
      message,
      duration: duration ?? 2000  // Default: 2 seconds
    });
  },
};
