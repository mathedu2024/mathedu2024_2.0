'use client';

import LoadingSpinner from '../LoadingSpinner';

/** 全站統一的載入提示文字 */
export const LOADING_MESSAGE = '載入中...';

export interface PageLoadingAreaProps {
  className?: string;
  minHeight?: string;
}

/** 頁面內容區載入狀態（保留上方標題，僅內容區顯示動畫） */
export default function PageLoadingArea({
  className = '',
  minHeight = 'min-h-[280px]',
}: PageLoadingAreaProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center ${minHeight} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={LOADING_MESSAGE}
    >
      <LoadingSpinner size="lg" text={LOADING_MESSAGE} />
    </div>
  );
}
