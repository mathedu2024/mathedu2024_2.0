import React from 'react';

// 統一使用主視覺藍色 blue-600
export default function LoadingSpinner({ className = '', size = 8, border = 4 }) {
  return (
    <div
      className={`animate-spin rounded-full h-${size} w-${size} border-${border} border-blue-600 border-t-transparent ${className}`}
      style={{ borderStyle: 'solid' }}
    />
  );
} 