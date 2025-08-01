import React from 'react';

export interface LoadingSpinnerProps {
  size?: number;
  border?: number;
  color?: 'blue' | 'white' | 'gray';
  className?: string;
  text?: string;
  fullScreen?: boolean;
}

// 統一使用主視覺藍色 blue-600
export default function LoadingSpinner({ 
  className = '', 
  size = 8, 
  border = 4,
  color = 'blue',
  text,
  fullScreen = false
}: LoadingSpinnerProps) {
  const colorClasses = {
    blue: 'border-blue-600 border-t-transparent',
    white: 'border-white border-t-transparent',
    gray: 'border-gray-600 border-t-transparent'
  };

  const spinnerClasses = `animate-spin rounded-full h-${size} w-${size} border-${border} ${colorClasses[color]} ${className}`;

  const content = (
    <div className="flex items-center justify-center">
      <div className={spinnerClasses} style={{ borderStyle: 'solid' }} />
      {text && (
        <span className="ml-2 text-gray-600">{text}</span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return content;
} 