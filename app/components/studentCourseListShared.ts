/** 學生端選課清單表格共用樣式與工具（課程、成績等頁面一致） */

import { tableActionStyles } from './ui/buttonStyles';
import { isCourseArchived, type ArchivableCourse } from '@/services/courseArchive';

export type CourseListFilterMode = 'teacher' | 'student';

export interface CourseListFilterFields extends ArchivableCourse {
  name: string;
  code: string;
  status?: string;
  gradeTags?: string[];
  subjectTag?: string;
  courseNature?: string;
}

export interface CourseListFilterState {
  searchTerm: string;
  selectedGrade: string;
  selectedSubject: string;
  selectedNature: string;
  selectedStatus: string;
}

export const defaultCourseListFilterState: CourseListFilterState = {
  searchTerm: '',
  selectedGrade: 'all',
  selectedSubject: 'all',
  selectedNature: 'all',
  selectedStatus: 'all',
};

export function getCourseDisplayStatus(course: CourseListFilterFields): string {
  if (isCourseArchived(course)) return '已封存';
  return course.status || '—';
}

/** 教師端卡片／篩選：已發布、草稿、已封存 */
export type TeacherCourseBucket = '已發布' | '草稿' | '已封存';

export function isTeacherCourseDraft(course: CourseListFilterFields): boolean {
  if (isCourseArchived(course)) return false;
  const s = course.status || '';
  return s === '未開課' || s === '資料建置中...' || s === '草稿';
}

export function getTeacherCourseBucket(course: CourseListFilterFields): TeacherCourseBucket {
  if (isCourseArchived(course) || course.status === '已封存') return '已封存';
  if (isTeacherCourseDraft(course)) return '草稿';
  return '已發布';
}

export function getTeacherCourseBucketBadgeClass(bucket: TeacherCourseBucket): string {
  switch (bucket) {
    case '已發布':
      return 'bg-secondary-container/40 text-secondary border border-secondary/20';
    case '草稿':
      return 'bg-surface-containerHigh text-on-surfaceVariant border border-outline-variant';
    case '已封存':
      return 'bg-error/10 text-error border border-error/20';
    default:
      return 'bg-surface-container text-on-surfaceVariant';
  }
}

function parseEnrolledCourseKey(key: string): { name: string; code: string } | null {
  const trimmed = key.trim();
  const half = trimmed.match(/^(.+)\(([^()]+)\)$/);
  if (half) return { name: half[1], code: half[2] };
  const full = trimmed.match(/^(.+)[（]([^（）]+)[）]$/);
  if (full) return { name: full[1].trim(), code: full[2].trim() };
  return null;
}

export function courseMatchesEnrolledKey(
  course: CourseListFilterFields & { id?: string },
  enrolledKey: string
): boolean {
  if (course.id && course.id === enrolledKey) return true;
  const displayKey = `${course.name}(${course.code})`;
  if (displayKey === enrolledKey) return true;
  const parsed = parseEnrolledCourseKey(enrolledKey);
  return Boolean(parsed && parsed.name === course.name && parsed.code === course.code);
}

/** 將 student_data.enrolledCourses 中尚未出現在 API 的課程補入（多為已封存） */
export function mergeCoursesFromEnrolledKeys<T extends CourseListFilterFields & { id?: string }>(
  courses: T[],
  enrolledKeys: string[] = []
): T[] {
  const merged = [...courses];
  for (const enrolledKey of enrolledKeys) {
    if (!enrolledKey?.trim()) continue;
    if (merged.some((course) => courseMatchesEnrolledKey(course, enrolledKey))) continue;

    const parsed = parseEnrolledCourseKey(enrolledKey);
    merged.push({
      id: enrolledKey,
      name: parsed?.name ?? enrolledKey,
      code: parsed?.code ?? '',
      status: '已封存',
      archived: true,
    } as T);
  }
  return merged;
}

export function matchesCourseListFilters(
  course: CourseListFilterFields,
  filters: CourseListFilterState,
  mode: CourseListFilterMode = 'teacher'
): boolean {
  const { searchTerm, selectedGrade, selectedSubject, selectedNature, selectedStatus } = filters;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const archived = isCourseArchived(course);

  let statusMatch = true;
  if (selectedStatus === 'all') {
    statusMatch = !archived;
  } else if (selectedStatus === '已封存') {
    statusMatch = archived;
  } else if (selectedStatus === '已發布') {
    statusMatch = !archived && !isTeacherCourseDraft(course);
  } else if (selectedStatus === '草稿' || selectedStatus === '草稿箱') {
    statusMatch = !archived && isTeacherCourseDraft(course);
  } else {
    statusMatch = course.status === selectedStatus && !archived;
  }

  const natureMatch =
    mode === 'student' || selectedNature === 'all' || course.courseNature === selectedNature;

  return (
    (!normalizedSearch ||
      course.name.toLowerCase().includes(normalizedSearch) ||
      course.code.toLowerCase().includes(normalizedSearch)) &&
    (mode === 'student' ||
      selectedGrade === 'all' ||
      (course.gradeTags && course.gradeTags.includes(selectedGrade))) &&
    (selectedSubject === 'all' || course.subjectTag === selectedSubject) &&
    natureMatch &&
    statusMatch
  );
}

export function sortCoursesForList<T extends CourseListFilterFields>(courses: T[]): T[] {
  const statuses = ['報名中', '開課中', '未開課', '已額滿', '已結束', '已封存', '資料建置中...'];

  return [...courses].sort((a, b) => {
    const statusA = statuses.indexOf(a.status || '');
    const statusB = statuses.indexOf(b.status || '');
    const priorityA = statusA !== -1 ? statusA : 999;
    const priorityB = statusB !== -1 ? statusB : 999;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    const codeCompare = (a.code || '').localeCompare(b.code || '', undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    if (codeCompare !== 0) return codeCompare;

    return (a.name || '').localeCompare(b.name || '', undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

export function filterAndSortCoursesForList<T extends CourseListFilterFields>(
  courses: T[],
  filters: CourseListFilterState,
  mode: CourseListFilterMode = 'teacher'
): T[] {
  return sortCoursesForList(courses.filter((course) => matchesCourseListFilters(course, filters, mode)));
}

/** 學生端清單：保留所有選修課程（含封存），僅排序 */
export function sortStudentCoursesForList<T extends CourseListFilterFields>(courses: T[]): T[] {
  return sortCoursesForList(courses);
}

export function getCourseStatusColor(status: string) {
  switch (status) {
    case '報名中':
      return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    case '開課中':
      return 'bg-primary/10 text-primary border border-primary/30';
    case '已額滿':
      return 'bg-rose-100 text-rose-800 border border-rose-200';
    case '未開課':
      return 'bg-amber-100 text-amber-800 border border-amber-200';
    case '已結束':
      return 'bg-gray-100 text-gray-600 border border-gray-200';
    case '已封存':
      return 'bg-red-50 text-red-700 border border-red-200';
    default:
      return 'bg-gray-50 text-gray-600 border border-gray-200';
  }
}

/**
 * 授課／選課清單表格 typography。
 * 與 TeacherCourseManager 原始表格樣式一致，學生端與教師端共用。
 */
export const courseListTableStyles = {
  desktop: {
    wrapper: 'bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto hidden md:block',
    table: 'w-full text-sm text-left text-gray-500',
    thead: 'text-xs text-gray-700 uppercase bg-gray-50',
    th: 'px-6 py-4 font-bold',
    row: 'hover:bg-primary/5 transition-colors',
    courseName: 'font-bold text-gray-900 text-base',
    courseCode: 'text-sm font-mono text-gray-500 mt-1',
    teacherAvatar:
      'w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-3 text-sm font-bold shrink-0',
    teacherName: 'truncate min-w-0 flex-1 text-sm',
    studentCount:
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-800',
    classTimesCell: 'px-6 py-4 text-gray-600',
    classTimes: 'line-clamp-2 text-sm leading-relaxed',
    meetingLink:
      'inline-flex items-center text-primary hover:text-primary transition-colors bg-primary/10 hover:bg-primary/10 p-2 rounded-lg text-sm font-bold',
    meetingEmpty: 'text-gray-400 text-sm',
    statusBadge: 'px-3 py-1 rounded-full text-sm font-bold',
    actionPrimary: tableActionStyles.primary,
    actionDisabled: tableActionStyles.disabled,
    actionSecondary: tableActionStyles.secondary,
    actionSuccess: tableActionStyles.success,
    actionDanger: tableActionStyles.danger,
    actionWarning: tableActionStyles.warning,
    actionRow: 'flex justify-end gap-2 flex-nowrap shrink-0',
  },
  mobile: {
    wrapper: 'md:hidden space-y-4',
    card: 'bg-white border border-gray-100 rounded-xl shadow-sm p-5',
    courseName: 'font-bold text-gray-900 text-lg',
    courseCode: 'text-sm font-mono text-gray-500 mb-2',
    statusBadge: 'inline-block px-3 py-1 rounded-full text-xs font-bold',
    meetingLink:
      'inline-flex items-center justify-center w-full py-2 bg-primary/10 text-primary hover:bg-primary/10 rounded-lg text-sm font-bold transition-colors',
    actionPrimary:
      'flex-1 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors shadow-sm',
    actionDisabled:
      'flex-1 py-2 bg-gray-100 text-gray-400 text-sm font-medium rounded-lg border border-gray-200 cursor-not-allowed',
    actionSuccess:
      'flex-1 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors shadow-sm flex justify-center items-center',
    actionSecondary:
      'flex-1 py-2 bg-white text-primary border border-primary/30 text-sm font-medium rounded-lg hover:bg-primary/10 transition-colors shadow-sm',
  },
} as const;
