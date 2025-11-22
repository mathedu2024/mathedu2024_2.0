import React from 'react';
import Modal from './ui/Modal';

interface DetailModalProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

export default function DetailModal({ open, title, children, onClose }: DetailModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      showCloseButton={false}
    >
      <div className="mb-4 md:mb-6 text-base md:text-lg">{children}</div>
      <button
        onClick={onClose}
        className="dialog-button"
      >
        關閉
      </button>
    </Modal>
  );
} 