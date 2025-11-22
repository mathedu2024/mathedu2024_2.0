'use client';

import { useEffect } from 'react';
import { showSuccess, showError, showWarning, showInfo } from '../utils/alerts';

interface AlertDialogProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

export default function AlertDialog({ message, type, onClose }: AlertDialogProps) {
  useEffect(() => {
    let alertPromise;
    switch (type) {
      case 'success':
        alertPromise = showSuccess(message);
        break;
      case 'error':
        alertPromise = showError(message);
        break;
      case 'warning':
        alertPromise = showWarning(message);
        break;
      case 'info':
        alertPromise = showInfo(message);
        break;
      default:
        alertPromise = Promise.resolve();
        break;
    }
    alertPromise.catch(error => {
      console.error('Error showing alert:', error);
    }).finally(onClose);
  }, [message, type, onClose]);

  return null;
}
