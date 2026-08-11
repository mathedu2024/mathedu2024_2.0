'use client';

import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  breadcrumbs?: string[];
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  actions?: ReactNode;
};

/** 後台頂部列：麵包屑／標題／搜尋／快捷 */
export default function TopAppBar({
  title,
  subtitle,
  breadcrumbs,
  searchPlaceholder = '搜尋…',
  searchValue,
  onSearchChange,
  actions,
}: Props) {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 h-auto min-h-14 py-3 bg-surface/80 backdrop-blur-md border-b border-outline-variant">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <p className="text-[11px] font-mono uppercase tracking-wider text-on-surfaceVariant mb-0.5 truncate">
            {breadcrumbs.join(' › ')}
          </p>
        ) : null}
        <h1 className="font-display text-lg md:text-xl font-extrabold text-on-surface truncate tracking-tight">
          {title}
        </h1>
        {subtitle ? <p className="text-xs text-on-surfaceVariant mt-0.5 truncate">{subtitle}</p> : null}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 ml-auto">
        {onSearchChange ? (
          <div className="hidden md:flex items-center relative w-56 bg-surface-containerLow rounded-lg focus-within:ring-2 focus-within:ring-primary">
            <i className="fas fa-search absolute left-3 text-on-surfaceVariant text-sm pointer-events-none" aria-hidden />
            <input
              type="search"
              value={searchValue ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent border-none pl-9 pr-3 py-2 text-sm focus:ring-0 rounded-lg text-on-surface placeholder:text-on-surfaceVariant"
            />
          </div>
        ) : null}
        <button
          type="button"
          className="text-on-surfaceVariant hover:text-primary p-2 rounded-full hover:bg-surface-variant transition-colors"
          title="通知（即將開放）"
          disabled
        >
          <i className="fas fa-bell" aria-hidden />
        </button>
        {actions}
      </div>
    </header>
  );
}
