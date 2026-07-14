import { stripHtml } from '@/utils/richText';

function normalizeStoredHtml(html: string): string {
  return html.trim().replace(/>\s+</g, '><');
}

/**
 * 比對單選／多選選項是否為同一內容（不以顯示序號／陣列 index）。
 * 作答與批改皆應依選項 HTML／文字內容，避免打亂選項順序後誤判。
 */
export function isChoiceOptionEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.trim() === b.trim()) return true;
  if (normalizeStoredHtml(a) === normalizeStoredHtml(b)) return true;
  const textA = stripHtml(a);
  const textB = stripHtml(b);
  return textA.length > 0 && textA === textB;
}

export function choiceListIncludes(list: string[], option: string): boolean {
  return list.some((item) => isChoiceOptionEqual(item, option));
}
