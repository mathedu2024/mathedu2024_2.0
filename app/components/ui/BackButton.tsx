'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { backButtonClass, backButtonIconClass } from './buttonStyles';

export type BackButtonVariant = 'link' | 'primary';

export interface BackButtonProps {
  /** 按鈕文字，預設「返回」 */
  label?: string;
  onClick?: () => void;
  href?: string;
  /** default：標題下方導覽；primary：錯誤／空狀態（同樣式，置中對齊） */
  variant?: BackButtonVariant;
  className?: string;
  /** 是否加上上下間距（link 預設 true：標題下方 mt-4 mb-6） */
  withSpacing?: boolean;
}

/** 全站統一的返回按鈕：置於功能標題之後 */
export default function BackButton({
  label = '返回',
  onClick,
  href,
  variant = 'link',
  className = '',
  withSpacing,
}: BackButtonProps) {
  const spacing =
    withSpacing !== undefined
      ? withSpacing
        ? 'mt-4 mb-6'
        : ''
      : variant === 'link'
        ? 'mt-4 mb-6'
        : '';

  const combinedClass = `${backButtonClass} ${spacing} ${className}`.trim();

  const content = (
    <>
      <ArrowLeftIcon className={backButtonIconClass} aria-hidden />
      <span>{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={combinedClass}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={combinedClass}>
      {content}
    </button>
  );
}
