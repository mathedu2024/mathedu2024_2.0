import React from 'react';
import { Modal } from './ui'; // Assuming Modal is exported from ui/index.tsx based on project patterns

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
    >
      <div className="mb-6 text-base text-gray-600 leading-relaxed break-words">
        {children}
      </div>
      <div className="flex justify-end pt-2">
        <button
          onClick={onClose}
          className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          關閉
        </button>
      </div>
    </Modal>
  );
}