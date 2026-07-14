import { withReturnTo } from './teacherCourseHub';

export const EXAM_LIST_PATH = '/back-panel/teacher-exams';

export type ExamSubView = 'builder' | 'grading' | 'analytics';

export function examDetailPath(
  quizCode: string,
  sub?: 'grading' | 'analytics',
  returnTo?: string | null
): string {
  const base = `${EXAM_LIST_PATH}/${encodeURIComponent(quizCode)}`;
  const path = sub ? `${base}/${sub}` : base;
  return withReturnTo(path, returnTo);
}

/** 建立新測驗；可帶 courseId 預先指定適用班級，並可帶 returnTo 返回課程整合頁 */
export function examCreatePath(
  courseId?: string,
  returnTo?: string | null
): string {
  let path = `${EXAM_LIST_PATH}/new`;
  if (courseId) {
    path += `?courseId=${encodeURIComponent(courseId)}`;
  }
  return withReturnTo(path, returnTo);
}
