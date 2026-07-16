import { preprocessFillInQuestionHtml } from '@/utils/fillInContent';
import { renderLatexDelimitersInElement, renderLatexInElement } from '@/utils/quillFormula';
import { sanitizeHtml } from '@/utils/sanitizeHtml';

export interface RichHtmlDisplayOptions {
  fillInQuestionNumber?: number;
  /** 預設 true；編輯器即時裝飾可設 false */
  sanitize?: boolean;
  /**
   * 是否把純文字中的 $...$／$$...$$ 轉成 KaTeX。
   * 預覽預設 true；編輯器內必須 false，否則按方程式按鈕失焦時會整段改寫。
   */
  convertDelimiters?: boolean;
}

function stripFormulaPreviewInElement(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.ql-formula[data-latex], .ql-formula-block[data-latex]').forEach((el) => {
    el.innerHTML = '';
  });
  root.querySelectorAll<HTMLElement>(
    '.fill-in-blank-katex[data-fill-label], .fill-in-blank-embed[data-fill-token]'
  ).forEach((el) => {
    el.innerHTML = '\u200b';
  });
}

/**
 * 在 DOM 節點上渲染公式 embed、選填格（編輯器即時裝飾用）。
 * 預設不轉換 $...$／$$...$$ 純文字，避免編輯中內容被整段改寫。
 */
export function renderRichHtmlInElement(
  element: HTMLElement,
  options?: RichHtmlDisplayOptions
): void {
  const fillInQuestionNumber = options?.fillInQuestionNumber;
  stripFormulaPreviewInElement(element);
  if (options?.convertDelimiters) {
    renderLatexDelimitersInElement(element, fillInQuestionNumber);
  }
  renderLatexInElement(element, fillInQuestionNumber);
}

/**
 * 將儲存格式 HTML 一次轉成含 KaTeX 的最終 HTML（僅瀏覽器端）。
 * 顯示元件應只用此函式產出 innerHTML，避免 useEffect 補渲染被 React 重設。
 */
export function prepareRichHtmlForDisplay(
  html: string,
  options?: RichHtmlDisplayOptions
): string {
  if (!html) return '';
  if (typeof document === 'undefined') return html;

  const fillInQuestionNumber = options?.fillInQuestionNumber;
  let source = html;
  if (fillInQuestionNumber !== undefined) {
    source = preprocessFillInQuestionHtml(source, fillInQuestionNumber);
  }

  const doc = new DOMParser().parseFromString(source, 'text/html');
  const root = doc.body;
  stripFormulaPreviewInElement(root);
  // 預覽才轉換 $...$／$$...$$；編輯器內保留原文
  renderLatexDelimitersInElement(root, fillInQuestionNumber);
  renderLatexInElement(root, fillInQuestionNumber);

  const rendered = root.innerHTML;
  return options?.sanitize !== false ? sanitizeHtml(rendered) : rendered;
}
