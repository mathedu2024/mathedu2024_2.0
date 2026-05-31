'use client';

import { MoonLoader } from 'react-spinners';

const SIZE_MAP = { sm: 16, md: 24, lg: 40 } as const;

export type LoadingSpinnerSize = number | keyof typeof SIZE_MAP;

function resolveSize(size: LoadingSpinnerSize): number {
  if (typeof size === 'number') return size;
  return SIZE_MAP[size] ?? SIZE_MAP.lg;
}

export interface LoadingSpinnerProps {
  size?: LoadingSpinnerSize;
  text?: string;
  color?: 'blue' | 'white' | 'gray';
  className?: string;
  /** 全螢幕遮罩（僅用於登入、初次驗證等無頁面標題的場景） */
  fullScreen?: boolean;
}

export default function LoadingSpinner({
  className = '',
  color = 'blue',
  fullScreen = false,
  size = 'lg',
  text = '',
}: LoadingSpinnerProps) {
  const colorMap = {
    blue: '#4f46e5',
    white: '#FFFFFF',
    gray: '#6B7280',
  };

  const pixelSize = resolveSize(size);

  const content = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <MoonLoader color={colorMap[color]} size={pixelSize} speedMultiplier={0.8} />
      {text ? (
        <span
          className={`mt-3 text-sm font-medium ${
            color === 'white' ? 'text-white' : 'text-gray-500'
          }`}
        >
          {text}
        </span>
      ) : null}
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
