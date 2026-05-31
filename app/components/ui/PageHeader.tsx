'use client';

import React from 'react';

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
      <div className="border-l-4 border-indigo-500 pl-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          {icon}
          {title}
        </h1>
        {description ? (
          <p className="text-gray-500 text-sm mt-1">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3 shrink-0">{actions}</div> : null}
    </div>
  );
}
