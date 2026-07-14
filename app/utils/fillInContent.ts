import katex from 'katex';
import { buildGridCellLabel } from '@/services/quizTypes';

/** 題目內容中的選填格占位符，例如 [[-1]]、[[-2]]（相容舊版 [[.-1]]） */
export const FILL_IN_BLANK_TOKEN_REGEX = /\[\[(?:\.-|-)?(\d+)\]\]/g;

/** KaTeX 方框：維持精簡，避免在分母內撐得過高 */
function boxedFillInLabel(label: string): string {
  return `\\boxed{\\text{${label}}}`;
}

function promoteFracWithBoxes(latex: string): string {
  if (!/\\boxed/.test(latex)) return latex;
  return latex.replace(/\\(?:d|t)?frac\b/g, '\\dfrac');
}

function addThinSpaceBetweenAdjacentBoxes(latex: string): string {
  return latex.replace(
    /(\\boxed\{(?:[^{}]|\{[^{}]*\})*\})(?=\\boxed)/g,
    '$1\\,'
  );
}

/** 將 LaTeX 中的 [[-N]] 轉為 KaTeX 可渲染的方框（用於公式內選填格） */
export function latexFillInBlankToKatex(latex: string, questionNumber?: number): string {
  const withBoxes = latex.replace(FILL_IN_BLANK_TOKEN_REGEX, (_, raw) => {
    const subNumber = parseInt(raw, 10);
    const cellIndex = Number.isNaN(subNumber) || subNumber < 1 ? 0 : subNumber - 1;
    if (questionNumber !== undefined) {
      const label = buildGridCellLabel(questionNumber, cellIndex);
      return boxedFillInLabel(label);
    }
    return '\\boxed{\\phantom{00}}';
  });
  return promoteFracWithBoxes(addThinSpaceBetweenAdjacentBoxes(withBoxes));
}

const LATEX_ATTR_SLOT_PREFIX = '__FILLIN_LATEX_SLOT_';
const FILL_IN_EMBED_CLASS = 'fill-in-blank-embed';

function protectLatexAttributes(html: string): { html: string; values: string[] } {
  const values: string[] = [];
  const protectedHtml = html.replace(/data-latex="([^"]*)"/g, (_, latex: string) => {
    values.push(latex);
    return `data-latex="${LATEX_ATTR_SLOT_PREFIX}${values.length - 1}__"`;
  });
  return { html: protectedHtml, values };
}

function restoreLatexAttributes(html: string, values: string[]): string {
  return html.replace(
    new RegExp(`data-latex="${LATEX_ATTR_SLOT_PREFIX}(\\d+)__"`, 'g'),
    (_, idx) => `data-latex="${values[parseInt(idx, 10)]}"`
  );
}

/** 編輯器顯示：將題幹 [[-N]] 轉為 KaTeX 方框（不影響 data-latex 內容） */
export function editorHtmlFromStorage(html: string, questionNumber: number): string {
  if (!html) return html;
  const { html: protectedHtml, values } = protectLatexAttributes(html);
  const withEmbeds = protectedHtml.replace(FILL_IN_BLANK_TOKEN_REGEX, (match, raw) => {
    const subNumber = parseInt(raw, 10);
    const cellIndex = Number.isNaN(subNumber) || subNumber < 1 ? 0 : subNumber - 1;
    const label = buildGridCellLabel(questionNumber, cellIndex);
    const katexHtml = katex.renderToString(boxedFillInLabel(label), {
      throwOnError: false,
      strict: false,
      displayMode: false,
    });
    return (
      `<span class="${FILL_IN_EMBED_CLASS}" data-fill-token="${match}" contenteditable="false" ` +
      `style="display:inline-block;vertical-align:middle;margin:0 1px;">${katexHtml}</span>`
    );
  });
  return restoreLatexAttributes(withEmbeds, values);
}

/** 編輯器儲存：將方框 embed 還原為 [[-N]] 占位符 */
export function storageHtmlFromEditor(html: string): string {
  if (!html) return html;
  return html.replace(
    new RegExp(
      `<span[^>]*class="[^"]*${FILL_IN_EMBED_CLASS}[^"]*"[^>]*data-fill-token="(\\[\\[(?:\\.-|-)?\\d+\\]\\])"[^>]*>[\\s\\S]*?</span>`,
      'g'
    ),
    (_, token: string) => token
  );
}

/**
 * 儲存前清空公式／選填格內的 KaTeX DOM，只保留 data-*。
 * 避免 Quill clipboard 重套 HTML 時把公式拆壞（切換選項編輯時常見）。
 */
export function stripRenderedEmbedsForStorage(html: string): string {
  if (!html || typeof document === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.body
    .querySelectorAll<HTMLElement>(
      '.ql-formula[data-latex], .ql-formula-block[data-latex], .fill-in-blank-embed[data-fill-token], .fill-in-blank-katex[data-fill-label]'
    )
    .forEach((el) => {
      // Quill embed 需要不可見字元，否則重載時可能丟失 blot
      el.innerHTML = '\uFEFF';
    });
  return doc.body.innerHTML;
}

/** 先保護 data-latex 屬性，再對題幹文字插入選填格標示 */
export function preprocessFillInQuestionHtml(html: string, questionNumber: number): string {
  const { html: protectedHtml, values } = protectLatexAttributes(html);
  const withMarkers = injectFillInBlankMarkers(protectedHtml, questionNumber);
  return restoreLatexAttributes(withMarkers, values);
}

/** 選填格占位 span（僅 data 標記，由 RichHtmlContent 在消毒後渲染 KaTeX） */
export function renderFillInBlankMarkerHtml(label: string): string {
  return (
    `<span class="fill-in-blank-katex" data-fill-label="${label}" contenteditable="false" ` +
    `style="display:inline-block;vertical-align:-0.15em;margin:0 2px;">\u200b</span>`
  );
}

/** 解析選填格 token 的格子序號（1-based），無效時回傳 null */
export function parseFillInTokenSubNumber(token: string): number | null {
  const matched = /^\[\[(?:\.-|-)?(\d+)\]\]$/.exec(token.trim());
  if (!matched) return null;
  const subNumber = parseInt(matched[1], 10);
  return Number.isNaN(subNumber) || subNumber < 1 ? null : subNumber;
}

/** 移除公式 embed 內殘留 KaTeX，避免消毒時剝除後連同外層一起消失 */
export function stripFormulaPreviewHtml(html: string): string {
  if (!html || typeof window === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll<HTMLElement>('.ql-formula[data-latex], .ql-formula-block[data-latex]').forEach((el) => {
    el.innerHTML = '';
  });
  doc.querySelectorAll<HTMLElement>('.fill-in-blank-katex[data-fill-label], .fill-in-blank-embed[data-fill-token]').forEach((el) => {
    el.innerHTML = '\u200b';
  });
  return doc.body.innerHTML;
}

export function katexFillInBlankBox(label: string): string {
  return boxedFillInLabel(label);
}

export function makeFillInBlankToken(subNumber: number): string {
  return `[[-${subNumber}]]`;
}

/** 將題目 HTML 中的 [[-N]] 替換為 KaTeX 方框標示 */
export function injectFillInBlankMarkers(html: string, questionNumber: number): string {
  if (!html) return html;
  return html.replace(FILL_IN_BLANK_TOKEN_REGEX, (_, raw) => {
    const subNumber = parseInt(raw, 10);
    const cellIndex = Number.isNaN(subNumber) || subNumber < 1 ? 0 : subNumber - 1;
    const label = buildGridCellLabel(questionNumber, cellIndex);
    return renderFillInBlankMarkerHtml(label);
  });
}

export function countFillInBlankTokens(html: string): number {
  return (html.match(FILL_IN_BLANK_TOKEN_REGEX) ?? []).length;
}

/** 刪除某一格時，同步移除題目內對應占位符並重新編號 */
export function removeFillInBlankTokenByCellIndex(html: string, cellIndex: number): string {
  const removedNum = cellIndex + 1;
  return html.replace(FILL_IN_BLANK_TOKEN_REGEX, (_, raw) => {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return _;
    if (n === removedNum) return '';
    if (n > removedNum) return makeFillInBlankToken(n - 1);
    return makeFillInBlankToken(n);
  });
}
