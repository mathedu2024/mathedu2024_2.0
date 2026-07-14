'use client';

import React from 'react';
import RichHtmlContent from '@/components/RichHtmlContent';

interface FillInQuestionContentProps {
  html: string;
  questionNumber: number;
  className?: string;
  lineClamp?: number;
  textAlign?: 'left' | 'center';
}

/** 渲染含 [[.-N]] 占位符的選填題題目內容（含 LaTeX 方框） */
export default function FillInQuestionContent({
  html,
  questionNumber,
  className,
  lineClamp,
  textAlign,
}: FillInQuestionContentProps) {
  return (
    <RichHtmlContent
      html={html}
      className={className}
      lineClamp={lineClamp}
      fillInQuestionNumber={questionNumber}
      textAlign={textAlign}
    />
  );
}
