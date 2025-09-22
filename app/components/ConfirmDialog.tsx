'use client';

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
  confirmColor = 'blue'
}: ConfirmDialogProps) {
  if (!open) return null;

  const getConfirmButtonClass = () => {
    switch (confirmColor) {
      case 'red':
        return 'bg-red-600 hover:bg-red-700';
      case 'green':
        return 'bg-green-600 hover:bg-green-700';
      case 'blue':
      default:
        return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="text-yellow-500 text-4xl mb-4">⚠</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">確認操作</h3>
          <p className="text-gray-600 mb-6">{message}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-white rounded-lg transition-colors ${getConfirmButtonClass()}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
