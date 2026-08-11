/**
 * 儀表板／共用區塊外觀（Academic Precision）
 * DashboardTodoSummary、LiveAttendanceBanner、CourseActivityFeed、PageHeader、後台 managers 共用
 */

export const dashboardSectionTitle =
  'font-display text-xl font-bold text-on-surface border-l-4 border-primary pl-4 mb-6';

/** 後台 manager 頁首標題（外層另加 border-l-4 border-primary pl-4） */
export const dashboardPageTitle =
  'font-display text-2xl font-bold text-on-surface flex items-center gap-3';

export const dashboardPageSubtitle = 'text-on-surfaceVariant text-sm mt-1';

/** 篩選列／表格外殼 */
export const dashboardFilterPanel =
  'bg-surface-containerLowest p-4 rounded-xl shadow-sm border border-outline-variant/40';

export const dashboardPanel =
  'bg-surface-containerLowest rounded-2xl border border-outline-variant/40 shadow-sm overflow-hidden';

export const dashboardPanelDivide = 'divide-y divide-outline-variant/40';

export const dashboardRowHover =
  'hover:bg-primary/5 transition-colors';

export const dashboardEmpty =
  'px-5 py-10 text-center text-on-surfaceVariant text-sm font-medium';

export const dashboardError =
  'px-5 py-8 text-center text-error text-sm';

export const dashboardIconShell = 'mt-0.5 p-2 rounded-xl shrink-0';

/** Modal 漸層標題列 */
export const dashboardModalHeader =
  'bg-gradient-to-r from-primary to-tertiary p-4 flex justify-between items-center text-white flex-shrink-0';
