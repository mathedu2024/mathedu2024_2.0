'use client';

import React from 'react';
import { dashboardSectionTitle } from './dashboardChrome';

export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/** 後台／學生端共用的頁面標題區塊 */
export default function PageHeader({
  title,
  description,
  icon,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-8 ${className}`}
    >
      <div className={`${dashboardSectionTitle} mb-0`}>
        <h1 className="font-display text-2xl font-extrabold text-on-surface flex items-center gap-3 tracking-tight">
          {icon}
          {title}
        </h1>
        {description ? (
          <p className="text-on-surfaceVariant text-sm mt-1 font-normal">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3 shrink-0">{actions}</div> : null}
    </div>
  );
}
