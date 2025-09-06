import { useEffect } from 'react';
import Swal from 'sweetalert2';

interface AlertDialogProps {
  open: boolean;
  message: string;
  onClose: () => void;
  buttonText?: string;
}

export default function AlertDialog({ open, message, onClose, buttonText = '確定' }: AlertDialogProps) {
  useEffect(() => {
    if (!open) return;
    Swal.fire({
      icon: 'info',
      title: message,
      confirmButtonText: buttonText,
    }).finally(() => {
      onClose();
    });
  }, [open, message, onClose, buttonText]);

  return null;
}