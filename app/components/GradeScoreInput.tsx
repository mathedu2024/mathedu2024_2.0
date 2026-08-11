'use client';

import React, { useState } from 'react';

type ScoreInputProps = {
  value: number | undefined | null;
  onCommit: (next: number | undefined) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  title?: string;
  'data-grade-col'?: string;
  'data-grade-row'?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

/**
 * 成績輸入：聚焦時用字串草稿，避免手機刪除「100」時因 controlled number
 * 立刻回填計算總分而刪不掉的問題。
 */
export default function GradeScoreInput({
  value,
  onCommit,
  disabled,
  className,
  placeholder = '-',
  title,
  onKeyDown,
  ...dataAttrs
}: ScoreInputProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');

  const display = focused ? draft : value == null || Number.isNaN(value) ? '' : String(value);

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      title={title}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      value={display}
      data-grade-col={dataAttrs['data-grade-col']}
      data-grade-row={dataAttrs['data-grade-row']}
      onFocus={() => {
        setFocused(true);
        setDraft(value == null || Number.isNaN(value) ? '' : String(value));
      }}
      onBlur={() => {
        setFocused(false);
        const trimmed = draft.trim();
        if (trimmed === '') {
          onCommit(undefined);
          return;
        }
        const num = parseInt(trimmed, 10);
        onCommit(Number.isNaN(num) ? undefined : num);
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, '');
        setDraft(raw);
        if (raw === '') {
          onCommit(undefined);
          return;
        }
        const num = parseInt(raw, 10);
        if (!Number.isNaN(num)) onCommit(num);
      }}
      onKeyDown={onKeyDown}
    />
  );
}
