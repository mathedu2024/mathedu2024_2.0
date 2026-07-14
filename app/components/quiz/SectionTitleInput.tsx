'use client';

import React from 'react';

interface SectionTitleInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** 大題名稱輸入：本地狀態 + IME 組字保護，避免注音輸入被打斷 */
export default function SectionTitleInput({
  value,
  onChange,
  placeholder,
  className = '',
}: SectionTitleInputProps) {
  const [local, setLocal] = React.useState(value);
  const focusedRef = React.useRef(false);

  React.useEffect(() => {
    if (!focusedRef.current) {
      setLocal(value);
    }
  }, [value]);

  const commit = React.useCallback(
    (next: string) => {
      setLocal(next);
      if (next !== value) onChange(next);
    },
    [onChange, value]
  );

  return (
    <input
      type="text"
      value={local}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        commit(local);
      }}
      onCompositionEnd={(e) => {
        const next = e.currentTarget.value;
        setLocal(next);
        if (next !== value) onChange(next);
      }}
      onChange={(e) => {
        setLocal(e.target.value);
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      placeholder={placeholder}
      className={className}
    />
  );
}
