'use client';

import { useToastStore, ToastType } from '@/lib/stores/toastStore';
import { useEffect, useState } from 'react';

const toastStyles: Record<ToastType, { bg: string; icon: string }> = {
  success: {
    bg: 'bg-green-600 dark:bg-green-700',
    icon: '✓',
  },
  error: {
    bg: 'bg-red-600 dark:bg-red-700',
    icon: '✕',
  },
  warning: {
    bg: 'bg-yellow-500 dark:bg-yellow-600',
    icon: '⚠',
  },
  info: {
    bg: 'bg-blue-600 dark:bg-blue-700',
    icon: 'ℹ',
  },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const style = toastStyles[toast.type];

        return (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={`
              ${style.bg}
              rounded-lg shadow-lg px-4 py-3
              animate-in slide-in-from-right duration-300
              flex items-center gap-3
              cursor-pointer hover:opacity-90 transition-opacity
            `}
          >
            <span className="text-white text-sm flex-shrink-0">
              {style.icon}
            </span>
            <p className="text-white text-sm flex-1">
              {toast.message}
            </p>
          </div>
        );
      })}
    </div>
  );
}
