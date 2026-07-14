import { withReturnTo } from './teacherCourseHub';

export const SURVEY_LIST_PATH = '/back-panel/teacher-surveys';

export function surveyDetailPath(
  surveyCode: string,
  sub?: 'analytics',
  returnTo?: string | null
): string {
  const base = `${SURVEY_LIST_PATH}/${encodeURIComponent(surveyCode)}`;
  const path = sub ? `${base}/${sub}` : base;
  return withReturnTo(path, returnTo);
}

export function surveyCreatePath(courseId?: string, returnTo?: string | null): string {
  let path = `${SURVEY_LIST_PATH}/new`;
  if (courseId) {
    path += `?courseId=${encodeURIComponent(courseId)}`;
  }
  return withReturnTo(path, returnTo);
}
