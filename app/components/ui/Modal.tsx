import React, { useEffect } from 'react';
import ReactDOM from 'react-dom'; // Import ReactDOM for createPortal

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

  // Find the portal root element once
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null; // Don't render portal content until mounted

  const portalRoot = document.getElementById('modal-root');

  if (!portalRoot) {
    console.error('Modal: Portal root element with id "modal-root" not found!');
    return null; // Or throw an error, depending on desired behavior
  }

  // Render the modal content into the portal root
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[51]"> {/* Primary container for both backdrop and modal content, above navbar */}
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* Modal Content */}
      <div className="fixed inset-0 z-[52] flex justify-center items-center p-4 overflow-y-auto" onClick={onClose}> {/* Modal content itself, above backdrop */}
        <div
          className={`bg-white rounded-lg shadow-xl flex flex-col w-full ${sizeClasses[size]} ${className}`}
          style={{ maxHeight: 'calc(100vh - 4rem)' }}
          onClick={(e) => e.stopPropagation()}
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
    </div>,
    portalRoot
  ); // End ReactDOM.createPortal
};

export default Modal;