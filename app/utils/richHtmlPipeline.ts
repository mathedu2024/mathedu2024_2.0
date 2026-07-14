import { preprocessFillInQuestionHtml } from '@/utils/fillInContent';
import { renderLatexDelimitersInElement, renderLatexInElement } from '@/utils/quillFormula';
import { sanitizeHtml } from '@/utils/sanitizeHtml';

export interface RichHtmlDisplayOptions {
  fillInQuestionNumber?: number;
  /** 預設 true；編輯器即時裝飾可設 false */
  sanitize?: boolean;
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
 * 在 DOM 節點上渲染 $...$、ql-formula、選填格（編輯器即時預覽用）。
 */
export function renderRichHtmlInElement(
  element: HTMLElement,
  options?: RichHtmlDisplayOptions
): void {
  const fillInQuestionNumber = options?.fillInQuestionNumber;
  stripFormulaPreviewInElement(element);
  renderLatexDelimitersInElement(element, fillInQuestionNumber);
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
  renderLatexDelimitersInElement(root, fillInQuestionNumber);
  renderLatexInElement(root, fillInQuestionNumber);

  const rendered = root.innerHTML;
  return options?.sanitize !== false ? sanitizeHtml(rendered) : rendered;
}
