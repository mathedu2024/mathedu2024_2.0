/**
 * 首頁（app/page.tsx）下拉選單樣式規範 — 圓潤版 Listbox 下拉選單
 * 全站 Dropdown / MultiSelectDropdown 應使用此處定義的 class
 */
export const DROPDOWN_BUTTON_CLASS =
  'select-unified flex items-center justify-between w-full px-4 py-2.5 text-left border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm cursor-pointer shadow-sm';

export const DROPDOWN_MENU_CLASS =
  'fixed z-[100000] bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-auto focus:outline-none py-1';

export const DROPDOWN_OPTION_BASE_CLASS =
  'cursor-pointer select-none relative py-2.5 pl-4 pr-10 transition-colors mx-1 rounded-lg';

export const DROPDOWN_OPTION_ACTIVE_CLASS = 'bg-indigo-50 text-indigo-900';

export const DROPDOWN_OPTION_INACTIVE_CLASS = 'text-gray-900';

export const MULTISELECT_BUTTON_CLASS =
  'w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm outline-none text-sm text-gray-700 cursor-pointer flex items-center justify-between text-left';

export const MULTISELECT_MENU_CLASS =
  'z-[100000] max-h-60 overflow-auto rounded-xl bg-white py-1 text-sm shadow-xl border border-gray-200 focus:outline-none';

export const MULTISELECT_OPTION_BASE_CLASS =
  'relative cursor-pointer select-none py-2.5 pl-10 pr-4 transition-colors mx-1 rounded-lg';
