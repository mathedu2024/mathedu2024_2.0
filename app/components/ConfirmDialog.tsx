'use client';

import { useEffect } from 'react';
import { confirm } from '../utils/alerts';

interface ConfirmDialogProps {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmDialog({
  open,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (open) {
      confirm(message, {
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
      }).then(isConfirmed => {
        if (isConfirmed) {
          onConfirm();
        } else {
          onCancel();
        }
      });
    }
  }, [open, message, onConfirm, onCancel, confirmText, cancelText]);

  return null;
}