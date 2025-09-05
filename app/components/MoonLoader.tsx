import React from 'react';
import { MoonLoader } from 'react-spinners';

export interface MoonLoaderProps {
  size?: number;
  color?: string;
  className?: string;
  text?: string;
  fullScreen?: boolean;
}

export default function MoonLoaderComponent({
  size = 50,
  color = '#3B82F6', // 主視覺藍色
  className = '',
  text,
  fullScreen = false
}: MoonLoaderProps) {
  const content = (
    <div className={`flex items-center justify-center ${className}`}>
      <MoonLoader
        color={color}
        size={size}
        speedMultiplier={1}
      />
      {text && (
        <span className="ml-3 text-gray-600 font-medium">{text}</span>
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
