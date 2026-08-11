'use client';

import React from 'react';
import clsx from 'clsx';

export interface TabNavItem {
  id: string;
  label: React.ReactNode;
}

export interface TabNavProps {
  items: TabNavItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  navClassName?: string;
  /** 右側附加內容（如日期篩選） */
  trailing?: React.ReactNode;
  /** default：輔導預約基準；compact：成績查詢等較窄版面 */
  size?: 'default' | 'compact';
  /** underline：底線分頁；segmented：分段按鈕（次層分頁） */
  variant?: 'underline' | 'segmented';
  /** 是否保留底部外距（預設 true） */
  withMargin?: boolean;
}

const underlineTabBase = 'text-sm font-bold transition-all border-b-2';
const underlineTabActive = 'border-indigo-600 text-indigo-600';
const underlineTabInactive = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200';

const underlineSizeClasses = {
  default: 'px-4 py-3',
  compact: 'px-3 sm:px-4 py-2.5 sm:py-3',
} as const;

const segmentedSizeClasses = {
  default: 'px-4 py-2',
  compact: 'px-3 sm:px-3.5 py-1.5 sm:py-2',
} as const;

/**
 * 功能頁左右切換分頁（如輔導預約、成績查詢、測驗列表）
 */
export default function TabNav({
  items,
  activeId,
  onChange,
  className,
  navClassName,
  trailing,
  size = 'default',
  variant = 'underline',
  withMargin = true,
}: TabNavProps) {
  if (variant === 'segmented') {
    return (
      <div
        className={clsx(
          'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3',
          withMargin && 'mb-5',
          className,
        )}
      >
        <nav
          className={clsx(
            'inline-flex w-full sm:w-auto p-1 bg-gray-100 rounded-xl gap-0.5 overflow-x-auto shrink-0',
            navClassName,
          )}
        >
          {items.map((item) => {
            const active = activeId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={clsx(
                  'flex-1 sm:flex-none text-sm font-bold rounded-lg transition-all whitespace-nowrap',
                  segmentedSizeClasses[size],
                  active
                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
        {trailing && <div className="w-full sm:w-auto sm:ml-auto min-w-0">{trailing}</div>}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4',
        withMargin && 'mb-6',
        className,
      )}
    >
      <nav className={clsx('flex space-x-1', navClassName)}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={clsx(
              underlineTabBase,
              underlineSizeClasses[size],
              activeId === item.id ? underlineTabActive : underlineTabInactive,
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {trailing}
    </div>
  );
}
