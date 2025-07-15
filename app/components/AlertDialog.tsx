import React from 'react';

interface AlertDialogProps {
  open: boolean;
  message: string;
  onClose: () => void;
  buttonText?: string;
}

export default function AlertDialog({ open, message, onClose, buttonText = '確定' }: AlertDialogProps) {
  if (!open) return null;
  return (
    <div className="dialog-overlay">
      <div className="dialog-content">
        <div className="dialog-title">{message}</div>
        <button
          onClick={onClose}
          className="dialog-button"
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
} 