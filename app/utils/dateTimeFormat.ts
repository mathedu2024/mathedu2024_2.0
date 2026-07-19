/**
 * 全站日期時間：儲存值與顯示一律採 24 小時制，顯示時區固定為台灣（UTC+8）。
 * HTML datetime-local 的 value 本身即 HH:mm（24h）；
 * 以 lang="en-GB" 讓 Chromium / Edge / Firefox 的挑選器盡量顯示 24h
 *（實際 UI 仍可能受作業系統區域設定影響）。
 */
export const DATETIME_INPUT_LANG = 'en-GB';

/** 全站顯示用時區（台灣） */
export const DISPLAY_TIME_ZONE = 'Asia/Taipei';

export const ZH_TW_24H: Intl.DateTimeFormatOptions = {
  hour12: false,
  timeZone: DISPLAY_TIME_ZONE,
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 將 Date 轉成 datetime-local 用的本地字串（yyyy-MM-ddTHH:mm） */
export function toDatetimeLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** 以 zh-TW + 台灣時區 + 24 小時制格式化日期時間 */
export function formatDateTimeZhTw(
  input: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-TW', {
    ...options,
    hour12: false,
    timeZone: options?.timeZone ?? DISPLAY_TIME_ZONE,
  });
}
