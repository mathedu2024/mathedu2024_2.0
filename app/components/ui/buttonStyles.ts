/**
 * 全站按鈕樣式規範
 *
 * 基準：TeacherCourseManager 課程列表「操作」欄（Type 3）
 * - 表格操作：px-4 py-2、text-sm font-medium、rounded-lg，剛好包住文字
 * - 頁面級按鈕（Type 1/2）：px-4 py-2，其餘與上相同
 */

const transition = 'transition-colors shadow-sm whitespace-nowrap';
const text = 'text-sm font-medium';

const tableBtn = 'px-4 py-2 inline-flex items-center justify-center';

/** Type 3 — 表格操作欄按鈕 */
export const tableActionStyles = {
  primary: `${tableBtn} bg-indigo-600 text-white ${text} rounded-lg hover:bg-indigo-700 ${transition}`,
  success: `${tableBtn} bg-emerald-500 text-white ${text} rounded-lg hover:bg-emerald-600 ${transition}`,
  secondary: `${tableBtn} bg-white text-indigo-600 border border-indigo-200 ${text} rounded-lg hover:bg-indigo-50 ${transition}`,
  danger: `${tableBtn} bg-red-500 text-white ${text} rounded-lg hover:bg-red-600 ${transition} disabled:opacity-40 disabled:cursor-not-allowed`,
  dangerSolid: `${tableBtn} bg-red-500 text-white ${text} rounded-lg hover:bg-red-600 ${transition}`,
  dangerOutline: `${tableBtn} bg-white text-red-600 border border-red-200 ${text} rounded-lg hover:bg-red-50 ${transition} disabled:opacity-40 disabled:cursor-not-allowed`,
  warning: `${tableBtn} bg-white text-amber-600 border border-amber-200 ${text} rounded-lg hover:bg-amber-50 ${transition}`,
  disabled: `${tableBtn} bg-gray-100 text-gray-400 ${text} rounded-lg border border-gray-200 cursor-not-allowed`,
} as const;

/** 表格操作欄容器（與課程列表操作欄 gap-2 一致） */
export const tableActionRow = 'flex justify-end gap-2 flex-nowrap shrink-0';
export const tableActionRowWrap = 'flex justify-end gap-2 flex-wrap';
export const tableActionRowNowrap = tableActionRow;

/** Type 1 — 頁面級普通按鈕（無 icon） */
export const btnStyles = {
  primary: `px-4 py-2 bg-indigo-600 text-white ${text} rounded-lg hover:bg-indigo-700 ${transition}`,
  secondary: `px-4 py-2 bg-white text-indigo-600 border border-indigo-200 ${text} rounded-lg hover:bg-indigo-50 ${transition}`,
  ghost: `px-4 py-2 text-gray-500 ${text} rounded-lg hover:text-gray-700 hover:bg-gray-50 ${transition}`,
  danger: `px-4 py-2 bg-white text-red-600 border border-red-200 ${text} rounded-lg hover:bg-red-50 ${transition}`,
  dangerSolid: `px-4 py-2 bg-red-500 text-white ${text} rounded-lg hover:bg-red-600 ${transition}`,
  success: `px-4 py-2 bg-emerald-500 text-white ${text} rounded-lg hover:bg-emerald-600 ${transition}`,
  muted: `px-4 py-2 bg-gray-100 text-gray-700 ${text} rounded-lg hover:bg-gray-200 ${transition}`,
} as const;

/** Type 2 — 帶 icon 的頁面級按鈕 */
export const btnWithIcon = 'inline-flex items-center';
export const btnIcon = 'w-4 h-4 shrink-0';
export const btnIconGap = 'mr-1.5';

export function btnWithIconStyle(style: string) {
  return `${btnWithIcon} ${style}`;
}

/** 小型文字按鈕（篩選重設等） */
export const btnSmall = {
  ghost: `text-xs font-medium text-gray-500 hover:text-indigo-600 px-3 py-1.5 hover:bg-white rounded-lg transition-colors`,
} as const;

/** 返回按鈕（Type 2 導覽，尺寸與表格操作 secondary 一致） */
export const backButtonClass = `${btnWithIcon} w-fit self-start items-center gap-1.5 ${tableActionStyles.secondary} group`;
export const backButtonIconClass = `${btnIcon} group-hover:-translate-x-0.5 transition-transform`;
