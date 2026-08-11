/** 老師端課程整合頁路徑（授課管理內各分頁） */

/** 與 CourseHubTabNav 老師端順序一致 */
export const TEACHER_COURSE_HUB_TABS = [
  'lessons',
  'grades',
  'announcements',
  'exams',
  'surveys',
  'attendance',
] as const;

export type TeacherCourseHubTab = (typeof TEACHER_COURSE_HUB_TABS)[number];

export function parseTeacherCourseTab(value: string | null | undefined): TeacherCourseHubTab {
  if (value && (TEACHER_COURSE_HUB_TABS as readonly string[]).includes(value)) {
    return value as TeacherCourseHubTab;
  }
  return 'lessons';
}

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

/** 從 returnTo（如 /back-panel/teacher-courses/CODE?tab=exams）解析課程代碼 */
export function parseCourseCodeFromReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo || !isSafeBackPanelReturnTo(returnTo)) return '';
  try {
    const url = new URL(returnTo, 'https://local.invalid');
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('teacher-courses');
    if (idx < 0 || !parts[idx + 1]) return '';
    const code = decodeURIComponent(parts[idx + 1]);
    if (code === 'preview' || code === 'interact') return '';
    return code;
  } catch {
    return '';
  }
}
