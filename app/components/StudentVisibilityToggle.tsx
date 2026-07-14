'use client';

import React from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

/** 各功能統一：開放＝學生端可見；隱藏＝學生端不顯示 */
export function isStudentVisible(value: boolean | undefined | null): boolean {
  return value !== false;
}

interface StudentVisibilityToggleProps {
  open: boolean;
  disabled?: boolean;
  onToggle: () => void;
  className?: string;
}

export default function StudentVisibilityToggle({
  open,
  disabled,
  onToggle,
  className = '',
}: StudentVisibilityToggleProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onToggle();
      }}
      disabled={disabled}
      title={open ? '目前開放學生查看，點擊改為隱藏' : '目前對學生隱藏，點擊改為開放'}
      className={`px-2.5 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1 ${
        open
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-gray-100 text-gray-600 border-gray-200'
      } ${disabled ? 'cursor-default opacity-80' : 'hover:opacity-90'} ${className}`}
    >
      {open ? <EyeIcon className="w-3.5 h-3.5" /> : <EyeSlashIcon className="w-3.5 h-3.5" />}
      {open ? '開放' : '隱藏'}
    </button>
  );
}
