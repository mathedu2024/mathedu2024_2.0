'use client';
import React, { useEffect } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  showCloseButton?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-full mx-4',
};

const Modal: React.FC<ModalProps> = ({ open, onClose, title, showCloseButton = true, size = 'lg', className = '', children, footer }) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div 
      className="bg-black bg-opacity-50 z-50 flex justify-center overflow-y-auto p-4"
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-lg shadow-xl flex flex-col w-full ${sizeClasses[size]} ${className} self-start mt-16 mb-8`}
        style={{ maxHeight: 'calc(100vh - 4rem)' }}
        onClick={e => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 flex-shrink-0 border-b">
            {title && (
              <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="關閉"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">{children}</div>
        {footer && (
          <div className="flex justify-end p-6 border-t">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;