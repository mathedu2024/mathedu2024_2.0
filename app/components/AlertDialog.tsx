'use client';

import { useEffect } from 'react';
import alerts from '../utils/alerts';

interface AlertDialogProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning' | null;
  onClose: () => void;
}

export default function AlertDialog({ message, type, onClose }: AlertDialogProps) {
  useEffect(() => {
    if (message && type) {
      let alertPromise;
      switch (type) {
        case 'success':
          alertPromise = alerts.showSuccess(message);
          break;
        case 'error':
          alertPromise = alerts.showError(message);
          break;
        case 'warning':
          alertPromise = alerts.showWarning(message);
          break;
        default:
          alertPromise = Promise.resolve();
          break;
      }
      alertPromise.catch(error => {
        console.error('Error showing alert:', error);
      }).finally(onClose);
    }
  }, [message, type, onClose]);

  return null;
}