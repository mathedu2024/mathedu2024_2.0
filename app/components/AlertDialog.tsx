'use client';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="text-green-500 text-4xl mb-4">✓</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">成功</h3>
          <p className="text-gray-600 mb-6">{message}</p>
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
