'use client';

import React, { useMemo } from 'react';
import { prepareRichHtmlForDisplay } from '@/utils/richHtmlPipeline';
import { useHydrated } from '@/utils/useHydrated';

interface RichHtmlContentProps {
  html: string;
  className?: string;
  /** 列表摘要模式：限制行數 */
  lineClamp?: number;
  /** 選填題題號：公式內 [[-N]] 會顯示為帶編號方框 */
  fillInQuestionNumber?: number;
  /** 文字水平置中 */
  textAlign?: 'left' | 'center';
}

export default function RichHtmlContent({
  html,
  className = '',
  lineClamp,
  fillInQuestionNumber,
  textAlign = 'left',
}: RichHtmlContentProps) {
  const hydrated = useHydrated();

  const processed = useMemo(() => {
    if (!hydrated || !html) return '';
    return prepareRichHtmlForDisplay(html, { fillInQuestionNumber });
  }, [html, fillInQuestionNumber, hydrated]);

  if (!html) return null;

  if (!hydrated) {
    return (
      <div
        className={`rich-html-content ql-snow ${lineClamp ? 'line-clamp' : ''} ${className}`}
        style={lineClamp ? { WebkitLineClamp: lineClamp } : undefined}
        aria-hidden
      />
    );
  }

  return (
    <>
      <style>{`
        .rich-html-content .ql-formula,
        .rich-html-content .ql-formula-block {
          display: inline-flex;
          align-items: center;
          vertical-align: middle;
          margin: 0 2px;
          line-height: 1;
          padding: 0;
          background: transparent;
          border-radius: 0;
          overflow: visible;
        }
        .rich-html-content .ql-formula .katex,
        .rich-html-content .ql-formula-block .katex {
          vertical-align: middle !important;
          line-height: 1;
        }
        .rich-html-content.choice-option-content {
          line-height: 1.5;
        }
        .rich-html-content.choice-option-content p {
          margin: 0;
          line-height: inherit;
        }
        .rich-html-content.choice-option-content .ql-formula,
        .rich-html-content.choice-option-content .ql-formula-block {
          vertical-align: middle;
        }
        .rich-html-content.choice-option-content .ql-formula .katex,
        .rich-html-content.choice-option-content .ql-formula-block .katex,
        .rich-html-content.choice-option-content .katex {
          vertical-align: middle !important;
          line-height: 1;
        }
        .rich-html-content.choice-option-content .ql-formula-block {
          display: inline-flex;
          margin: 0;
          text-align: left;
        }
        .rich-html-content.correct-answer-content {
          display: block;
          width: 100%;
        }
        .rich-html-content .ql-formula-block {
          display: flex;
          justify-content: center;
          text-align: center;
          margin: 0.5rem 0;
          padding: 0;
        }
        .rich-html-content .ql-editor,
        .rich-html-content {
          line-height: 1.7;
        }
        .rich-html-content p {
          line-height: inherit;
        }
        .rich-html-content ol,
        .rich-html-content ul {
          padding-left: 1.5em;
        }
        .rich-html-content.line-clamp {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          overflow: hidden;
          word-break: break-word;
        }
        .rich-html-content.question-row-preview {
          line-height: 1.5;
        }
        .rich-html-content.question-row-preview p {
          margin: 0;
          display: inline;
        }
        .rich-html-content.question-row-preview .ql-formula-block {
          display: inline-flex;
          margin: 0;
        }
        .rich-html-content .fill-in-blank-katex,
        .rich-html-content .fill-in-blank-embed {
          display: inline-flex;
          align-items: center;
          vertical-align: middle;
          margin: 0 2px;
          line-height: 1;
        }
        .rich-html-content .fill-in-blank-katex .katex,
        .rich-html-content .fill-in-blank-embed .katex {
          font-size: 1em;
          vertical-align: middle !important;
        }
        .rich-html-content .ql-formula .katex .boxed {
          margin: 0 1px;
        }
        .rich-html-content .katex {
          overflow: visible;
        }
        .rich-html-content .katex svg {
          overflow: visible;
        }
        .rich-html-content--text-center {
          text-align: center;
        }
        .rich-html-content--text-center p,
        .rich-html-content--text-center .ql-align-left,
        .rich-html-content--text-center .ql-align-right,
        .rich-html-content--text-center .ql-align-center,
        .rich-html-content--text-center .ql-align-justify {
          text-align: center;
        }
        .rich-html-content--text-center .ql-formula-block {
          text-align: center;
          justify-content: center;
        }
        .rich-html-content--text-center ol,
        .rich-html-content--text-center ul {
          list-style-position: inside;
          padding-left: 0;
        }
        .rich-html-content.exam-mobile-stem {
          font-size: 1rem;
          line-height: 1.75;
        }
        .rich-html-content img {
          max-width: 100%;
          height: auto;
          display: inline-block;
          margin: 0.35rem 0;
          border-radius: 0.5rem;
          vertical-align: middle;
        }
        .rich-html-content.choice-option-content img {
          max-height: 12rem;
        }
      `}</style>
      <div
        className={`rich-html-content ql-snow ${lineClamp ? 'line-clamp' : ''} ${
          textAlign === 'center' ? 'rich-html-content--text-center' : ''
        } ${className}`}
        style={lineClamp ? { WebkitLineClamp: lineClamp } : undefined}
        dangerouslySetInnerHTML={{ __html: processed }}
      />
    </>
  );
}
