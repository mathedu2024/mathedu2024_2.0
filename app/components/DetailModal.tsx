import React from 'react';

interface DetailModalProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

export default function DetailModal({ open, title, children, onClose }: DetailModalProps) {
  if (!open) return null;
  return (
    <div className="dialog-overlay">
      <div className="dialog-content">
        <div className="dialog-title">{title}</div>
        <div className="mb-4 md:mb-6 text-base md:text-lg">{children}</div>
        <button
          onClick={onClose}
          className="dialog-button"
        >
          關閉
        </button>
      </div>
    </div>
  );
} 