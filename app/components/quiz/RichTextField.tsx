'use client';

import React from 'react';
import RichTextEditor from '@/components/RichTextEditor';
import { toEditorHtml } from '@/utils/richText';

interface RichTextFieldProps {
  label: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  compact?: boolean;
  minHeight?: string;
  hint?: string;
  fillInCellLabels?: string[];
  fillInQuestionNumber?: number;
}

export default function RichTextField({
  label,
  value,
  onChange,
  placeholder,
  compact = false,
  minHeight,
  hint,
  fillInCellLabels,
  fillInQuestionNumber,
}: RichTextFieldProps) {
  return (
    <div>
      <label className="text-gray-700 text-sm font-bold mb-2 block">{label}</label>
      <RichTextEditor
        value={toEditorHtml(value)}
        onChange={onChange}
        placeholder={placeholder}
        compact={compact}
        minHeight={minHeight}
        enableLatex
        enableFontSize={false}
        fillInCellLabels={fillInCellLabels}
        fillInQuestionNumber={fillInQuestionNumber}
      />
      {hint && <p className="text-xs text-gray-400 mt-1.5">{hint}</p>}
    </div>
  );
}
