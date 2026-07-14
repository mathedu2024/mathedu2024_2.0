/** 老師端課程整合頁路徑（授課管理內各分頁） */

export const TEACHER_COURSE_HUB_TABS = [
  'lessons',
  'announcements',
  'attendance',
  'exams',
  'surveys',
  'grades',
] as const;

export type TeacherCourseHubTab = (typeof TEACHER_COURSE_HUB_TABS)[number];

export function teacherCourseHubPath(
  courseCode: string,
  tab: TeacherCourseHubTab = 'lessons'
): string {
  const base = `/back-panel/teacher-courses/${encodeURIComponent(courseCode)}`;
  return tab === 'lessons' ? base : `${base}?tab=${tab}`;
}

/** 在路徑上附加 returnTo（僅允許後台相對路徑） */
export function withReturnTo(path: string, returnTo?: string | null): string {
  if (!returnTo || !isSafeBackPanelReturnTo(returnTo)) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}returnTo=${encodeURIComponent(returnTo)}`;
}

export function isSafeBackPanelReturnTo(value: string): boolean {
  return value.startsWith('/back-panel/');
}

export function resolveReturnTo(
  returnTo: string | null | undefined,
  fallback: string
): string {
  if (returnTo && isSafeBackPanelReturnTo(returnTo)) return returnTo;
  return fallback;
}
