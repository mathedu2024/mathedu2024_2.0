'use client';

import { useEffect } from 'react';
import alerts from '@/utils/alerts';

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
  confirmText: _confirmText,
  cancelText: _cancelText,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (open) {
      // 修正：alerts.confirm 第二個參數預期為字串 (text)，而非物件
      // 這裡將第一個參數設為標題 '確認'，第二個參數為訊息內容
      alerts.confirm('確認', message).then(isConfirmed => {
        if (isConfirmed) {
          onConfirm();
        } else {
          onCancel();
        }
      });
    }
  }, [open, message, onConfirm, onCancel]);

  return null;
}