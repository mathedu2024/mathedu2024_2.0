import katex from 'katex';
import { buildGridCellLabel } from '@/services/quizTypes';
import {
  katexFillInBlankBox,
  latexFillInBlankToKatex,
  parseFillInTokenSubNumber,
} from '@/utils/fillInContent';

const FILL_IN_TOKEN_IN_TEXT = /\[\[(?:\.-|-)?(\d+)\]\]/g;

function decodeHtmlEntities(value: string): string {
  if (typeof document === 'undefined') {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

let registered = false;

/** 大型運算符：行內模式也將上下界顯示在符號上下方 */
const LIMIT_OPERATORS = [
  'sum',
  'prod',
  'coprod',
  'int',
  'iint',
  'iiint',
  'iiiint',
  'oint',
  'oiint',
  'oiiint',
  'bigcup',
  'bigcap',
  'bigvee',
  'bigwedge',
  'bigoplus',
  'bigotimes',
  'bigodot',
];

export function normalizeLatexLimits(latex: string): string {
  let result = latex;
  for (const op of LIMIT_OPERATORS) {
    result = result.replace(
      new RegExp(`\\\\${op}(?!\\\\limits)(?=[_^])`, 'g'),
      `\\${op}\\limits`
    );
  }
  return result;
}

function prepareLatexForRender(latex: string, fillInQuestionNumber?: number): string {
  const withBlanks = latexFillInBlankToKatex(latex, fillInQuestionNumber);
  return normalizeLatexLimits(withBlanks);
}

/** 關閉 strict，避免題目公式內全形標點（如 ：）觸發 unicodeTextInMathMode 警告 */
const KATEX_BASE_OPTIONS = {
  throwOnError: false,
  strict: false,
} as const;

function katexRender(
  node: HTMLElement,
  latex: string,
  displayMode: boolean,
  fillInQuestionNumber?: number
): void {
  katex.render(prepareLatexForRender(latex, fillInQuestionNumber), node, {
    ...KATEX_BASE_OPTIONS,
    displayMode,
  });
}

export function katexRenderToString(
  latex: string,
  displayMode: boolean,
  options?: { throwOnError?: boolean; fillInQuestionNumber?: number }
): string {
  return katex.renderToString(
    prepareLatexForRender(latex.trim(), options?.fillInQuestionNumber),
    {
      ...KATEX_BASE_OPTIONS,
      throwOnError: options?.throwOnError ?? KATEX_BASE_OPTIONS.throwOnError,
      displayMode,
    }
  );
}

/** 在 Quill 編輯器中定位公式 embed 的 index（含 Quill.find 失敗時的 fallback） */
export function resolveFormulaEmbedIndex(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quill: any,
  formulaEl: HTMLElement
): number | null {
  try {
    const scrollBlot = quill.scroll?.find?.(formulaEl);
    if (scrollBlot) return quill.getIndex(scrollBlot);
  } catch {
    /* fallback below */
  }

  const Quill = quill.constructor;
  const found = Quill.find(formulaEl) ?? Quill.find(formulaEl, true);
  if (found) {
    try {
      return quill.getIndex(found);
    } catch {
      /* fallback below */
    }
  }

  const root = quill.root as HTMLElement;
  const formulas = Array.from(root.querySelectorAll<HTMLElement>('.ql-formula, .ql-formula-block'));
  const targetOrdinal = formulas.indexOf(formulaEl);
  if (targetOrdinal < 0) return null;

  const contents = quill.getContents();
  let index = 0;
  let ordinal = 0;
  for (const op of contents.ops ?? []) {
    const insert = op.insert;
    if (insert && typeof insert === 'object') {
      if ('formula' in insert || 'formula-block' in insert) {
        if (ordinal === targetOrdinal) return index;
        ordinal += 1;
      }
      index += 1;
    } else if (typeof insert === 'string') {
      index += insert.length;
    }
  }
  return null;
}

export function renderFormulaIntoElement(
  node: HTMLElement,
  latex: string,
  displayMode: boolean,
  fillInQuestionNumber?: number
): void {
  katexRender(node, latex, displayMode, fillInQuestionNumber);
}

export async function registerQuillFormula(): Promise<void> {
  if (registered || typeof window === 'undefined') return;

  const { default: Quill } = await import('quill');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Embed = Quill.import('blots/embed') as any;

  class FormulaBlot extends Embed {
    static blotName = 'formula';
    static tagName = 'span';
    static className = 'ql-formula';

    static create(value: string) {
      const node = super.create() as HTMLElement;
      node.setAttribute('data-latex', value);
      node.setAttribute('contenteditable', 'false');
      try {
        katexRender(node, value, false);
      } catch {
        node.textContent = value;
      }
      return node;
    }

    static value(node: HTMLElement) {
      return node.getAttribute('data-latex') || '';
    }
  }

  Quill.register(FormulaBlot, true);

  class FormulaBlockBlot extends Embed {
    static blotName = 'formula-block';
    static tagName = 'div';
    static className = 'ql-formula-block';

    static create(value: string) {
      const node = super.create() as HTMLElement;
      node.setAttribute('data-latex', value);
      node.setAttribute('contenteditable', 'false');
      try {
        katexRender(node, value, true);
      } catch {
        node.textContent = value;
      }
      return node;
    }

    static value(node: HTMLElement) {
      return node.getAttribute('data-latex') || '';
    }
  }

  Quill.register(FormulaBlockBlot, true);

  class FillInBlankBlot extends Embed {
    static blotName = 'fill-in-blank';
    static tagName = 'span';
    static className = 'fill-in-blank-embed';

    static create(value: string) {
      const node = super.create() as HTMLElement;
      node.setAttribute('data-fill-token', value);
      node.setAttribute('contenteditable', 'false');
      return node;
    }

    static value(node: HTMLElement) {
      return node.getAttribute('data-fill-token') || '';
    }
  }

  Quill.register(FillInBlankBlot, true);
  registered = true;
}

function renderFillInBlankBox(node: HTMLElement, label: string): void {
  node.style.display = 'inline-block';
  node.style.verticalAlign = '-0.15em';
  node.style.margin = '0 2px';
  try {
    katex.render(katexFillInBlankBox(label), node, {
      ...KATEX_BASE_OPTIONS,
      displayMode: false,
    });
  } catch {
    node.textContent = label;
  }
}

function renderRemainingFillInTokensInElement(
  root: HTMLElement,
  fillInQuestionNumber?: number
): void {
  if (fillInQuestionNumber === undefined) return;

  const skipSelector = '.katex, .ql-formula, .ql-formula-block, .fill-in-blank-katex, .fill-in-blank-embed';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? '';
    FILL_IN_TOKEN_IN_TEXT.lastIndex = 0;
    if (!FILL_IN_TOKEN_IN_TEXT.test(text)) continue;
    if ((node.parentElement)?.closest(skipSelector)) continue;
    targets.push(node as Text);
  }

  for (const textNode of targets) {
    const text = textNode.textContent ?? '';
    FILL_IN_TOKEN_IN_TEXT.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    let matched: RegExpExecArray | null;
    while ((matched = FILL_IN_TOKEN_IN_TEXT.exec(text))) {
      if (matched.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, matched.index)));
      }
      const subNumber = parseInt(matched[1], 10);
      const cellIndex = Number.isNaN(subNumber) || subNumber < 1 ? 0 : subNumber - 1;
      const label = buildGridCellLabel(fillInQuestionNumber, cellIndex);
      const span = document.createElement('span');
      span.className = 'fill-in-blank-katex';
      span.setAttribute('data-fill-label', label);
      span.setAttribute('contenteditable', 'false');
      span.appendChild(document.createTextNode('\u200b'));
      renderFillInBlankBox(span, label);
      frag.appendChild(span);
      last = matched.index + matched[0].length;
    }
    if (last < text.length) {
      frag.appendChild(document.createTextNode(text.slice(last)));
    }
    textNode.parentNode?.replaceChild(frag, textNode);
  }
}

export function renderLatexInElement(
  element: HTMLElement,
  fillInQuestionNumber?: number
): void {
  element.querySelectorAll<HTMLElement>('.fill-in-blank-katex[data-fill-label]').forEach((node) => {
    const label = node.getAttribute('data-fill-label');
    if (!label) return;
    renderFillInBlankBox(node, label);
  });

  element.querySelectorAll<HTMLElement>('.fill-in-blank-embed[data-fill-token]').forEach((node) => {
    const token = node.getAttribute('data-fill-token');
    if (!token || fillInQuestionNumber === undefined) return;
    const subNumber = parseFillInTokenSubNumber(token);
    if (subNumber === null) return;
    renderFillInBlankBox(node, buildGridCellLabel(fillInQuestionNumber, subNumber - 1));
  });

  element.querySelectorAll<HTMLElement>('.ql-formula-block[data-latex]').forEach((node) => {
    const latex = node.getAttribute('data-latex');
    if (!latex) return;
    try {
      katexRender(node, decodeHtmlEntities(latex), true, fillInQuestionNumber);
    } catch {
      node.textContent = latex;
    }
  });

  element.querySelectorAll<HTMLElement>('.ql-formula[data-latex]:not(.ql-formula-block)').forEach((node) => {
    const latex = node.getAttribute('data-latex');
    if (!latex) return;
    try {
      katexRender(node, decodeHtmlEntities(latex), false, fillInQuestionNumber);
    } catch {
      node.textContent = latex;
    }
  });

  renderRemainingFillInTokensInElement(element, fillInQuestionNumber);
}

const LATEX_SKIP_SELECTOR =
  '.katex, .ql-formula, .ql-formula-block, .fill-in-blank-katex, .fill-in-blank-embed';

/** 僅在純文字節點渲染 $...$ / $$...$$，避免破壞已渲染的 KaTeX 結構 */
export function renderLatexDelimitersInElement(
  root: HTMLElement,
  fillInQuestionNumber?: number
): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? '';
    if (!/\$/.test(text)) continue;
    if (node.parentElement?.closest(LATEX_SKIP_SELECTOR)) continue;
    targets.push(node as Text);
  }

  for (const textNode of targets) {
    const text = textNode.textContent ?? '';
    const replaced = renderLatexDelimiters(text, fillInQuestionNumber);
    if (replaced === text) continue;
    const template = document.createElement('template');
    template.innerHTML = replaced;
    textNode.parentNode?.replaceChild(template.content, textNode);
  }
}

/** 將 $...$ 與 $$...$$ 語法轉為 KaTeX 渲染（用於顯示） */
export function renderLatexDelimiters(text: string, fillInQuestionNumber?: number): string {
  let result = text;

  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) => {
    try {
      return katexRenderToString(latex, true, { fillInQuestionNumber });
    } catch {
      return `$$${latex}$$`;
    }
  });

  result = result.replace(/\$([^$\n]+?)\$/g, (_, latex) => {
    try {
      return katexRenderToString(latex, false, { fillInQuestionNumber });
    } catch {
      return `$${latex}$`;
    }
  });

  return result;
}
