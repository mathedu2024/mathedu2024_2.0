import React from 'react';

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
  confirmColor = 'red'
}: ConfirmDialogProps) {
  if (!open) return null;

  const getConfirmButtonClass = () => {
    switch (confirmColor) {
      case 'red':
        return 'btn-danger';
      case 'blue':
        return 'btn-primary';
      case 'green':
        return 'btn-success';
      default:
        return 'btn-danger';
    }
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-content">
        <div className="dialog-title">{message}</div>
        <div className="flex gap-4 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 btn-secondary min-h-[44px]"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 min-h-[44px] ${getConfirmButtonClass()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
} 