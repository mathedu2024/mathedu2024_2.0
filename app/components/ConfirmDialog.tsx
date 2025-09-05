import { useEffect } from 'react';
import Swal from 'sweetalert2';

interface ConfirmDialogProps {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'red' | 'blue' | 'green';
}

export default function ConfirmDialog({ 
  open, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = '確認', 
  cancelText = '取消',
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    Swal.fire({
      icon: 'question',
      title: message,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      focusCancel: true,
    }).then(result => {
      if (result.isConfirmed) onConfirm();
      else onCancel();
    });
  }, [open, message, onConfirm, onCancel, confirmText, cancelText]);

  return null;
} 