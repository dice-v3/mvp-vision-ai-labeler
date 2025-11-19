import { create } from 'zustand';

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: (() => void) | null;
  onCancel: (() => void) | null;

  showConfirm: (options: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }) => void;

  closeConfirm: () => void;
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  isOpen: false,
  title: '확인',
  message: '',
  confirmText: '확인',
  cancelText: '취소',
  onConfirm: null,
  onCancel: null,

  showConfirm: (options) => {
    set({
      isOpen: true,
      title: options.title || '확인',
      message: options.message,
      confirmText: options.confirmText || '확인',
      cancelText: options.cancelText || '취소',
      onConfirm: options.onConfirm,
      onCancel: options.onCancel || null,
    });
  },

  closeConfirm: () => {
    set({
      isOpen: false,
      onConfirm: null,
      onCancel: null,
    });
  },
}));

// Helper function for convenience
export const confirm = (options: {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}) => {
  useConfirmStore.getState().showConfirm(options);
};
