/** 移除 HTML 標籤，取得純文字摘要 */
export function stripHtml(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

/** 僅有公式／圖片等 embed、沒有可見文字時仍視為有內容 */
const MEANINGFUL_EMBED_RE =
  /data-latex\s*=|data-fill-token\s*=|data-fill-label\s*=|<img\b|<video\b|class\s*=\s*["'][^"']*\bql-formula\b/i;

/** 判斷 HTML 內容是否為空（含 Quill 空段落） */
export function isHtmlEmpty(html: string | undefined | null): boolean {
  if (!html) return true;
  if (MEANINGFUL_EMBED_RE.test(html)) return false;
  const stripped = stripHtml(html);
  if (stripped) return false;
  return html.replace(/<[^>]*>/g, '').trim().length === 0;
}

/** 判斷字串是否含可渲染的 HTML 內容 */
export function looksLikeHtml(value: string | undefined | null): boolean {
  if (!value) return false;
  return /<[a-z][\s\S]*>/i.test(value) && !isHtmlEmpty(value);
}

/** 將純文字轉為 Quill 可用的 HTML（向下相容舊資料） */
export function toEditorHtml(value: string | undefined | null): string {
  if (!value) return '';
  if (/<[a-z][\s\S]*>/i.test(value)) return value;
  const escaped = value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<p>${escaped.replace(/\n/g, '<br>')}</p>`;
}
