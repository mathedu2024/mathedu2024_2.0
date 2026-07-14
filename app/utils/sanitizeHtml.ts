import DOMPurify from 'dompurify';

const PRESERVE_EMPTY_ATTRS = ['data-latex', 'data-fill-label', 'data-fill-token'] as const;

let sanitizeHookRegistered = false;

function ensureSanitizeHooks(): void {
  if (sanitizeHookRegistered || typeof window === 'undefined') return;
  DOMPurify.addHook('uponSanitizeElement', (node) => {
    if (!(node instanceof Element)) return;
    for (const attr of PRESERVE_EMPTY_ATTRS) {
      if (node.hasAttribute(attr)) {
        node.setAttribute(attr, node.getAttribute(attr) ?? '');
      }
    }
  });
  sanitizeHookRegistered = true;
}

const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'sub', 'sup',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'img', 'blockquote', 'pre', 'code',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'span', 'div',
    /** KaTeX：根號、括號延伸等使用 SVG */
    'svg', 'path', 'line', 'g', 'defs',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'style',
    'colspan', 'rowspan', 'width', 'height',
    /** Quill 公式 embed：預覽時需保留以重新渲染 KaTeX */
    'data-latex',
    'data-fill-token',
    'data-fill-label',
    'contenteditable',
    /** KaTeX 輸出常用屬性 */
    'aria-hidden',
    /** KaTeX SVG（根號 \\sqrt、大括號等） */
    'xmlns',
    'viewBox',
    'preserveAspectRatio',
    'd',
    'fill',
    'stroke',
    'stroke-width',
    'x1', 'y1', 'x2', 'y2',
  ],
  ALLOW_DATA_ATTR: false,
};

/** 消毒使用者輸入的 HTML，防止 XSS（僅在瀏覽器端執行） */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined') return html;
  ensureSanitizeHooks();
  return DOMPurify.sanitize(html, SANITIZE_OPTIONS);
}
