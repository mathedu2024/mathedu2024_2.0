'use client';

import { MoonLoader } from 'react-spinners';

export interface LoadingSpinnerProps {
  size?: number;
  text?: string;
  color?: 'blue' | 'white' | 'gray';
  className?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({ 
  className = '', 
  color = 'blue',
  fullScreen = false,
  size = 40,
  text = '',
}: LoadingSpinnerProps) {
  const colorMap = {
    blue: '#4f46e5', // Updated to Indigo-600
    white: '#FFFFFF',
    gray: '#6B7280'
  };

  const content = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <MoonLoader
        color={colorMap[color]}
        size={size}
        speedMultiplier={0.8}
      />
      {text && <span className={`mt-3 text-sm font-medium ${color === 'white' ? 'text-white' : 'text-gray-500'}`}>{text}</span>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
        {content}
      </div>
    );
  }

  return content;
}