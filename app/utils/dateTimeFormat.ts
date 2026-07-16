/**
 * 全站日期時間：設定器、儲存值與顯示一律採 24 小時制。
 * HTML time / datetime-local 的 value 本身即 HH:mm（24h）；
 * 以 lang="en-GB" 讓 Chromium / Edge / Firefox 的挑選器 UI 也顯示 24h。
 */
export const DATETIME_INPUT_LANG = 'en-GB';

export const ZH_TW_24H: Intl.DateTimeFormatOptions = {
  hour12: false,
};

/** 將 Date 轉成 datetime-local 用的本地字串（yyyy-MM-ddTHH:mm） */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 以 zh-TW + 24 小時制格式化日期時間 */
export function formatDateTimeZhTw(
  input: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-TW', { ...options, hour12: false });
}
