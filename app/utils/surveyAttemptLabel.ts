import { sanitizeStudentReturnHref } from '@/utils/examAttemptLabel';
import { formatDateTimeZhTw } from '@/utils/dateTimeFormat';
import type { StudentSurveyAttemptSummary } from '@/utils/studentClientApi';

export function formatSurveyAttemptDateTime(iso: string): string {
  const formatted = formatDateTimeZhTw(iso, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return formatted || iso;
}

export function sortSurveyAttempts(
  attempts: StudentSurveyAttemptSummary[]
): StudentSurveyAttemptSummary[] {
  return [...attempts].sort((a, b) => a.attemptIndex - b.attemptIndex);
}

export function buildStudentCourseSurveysUrl(courseCodeOrId: string): string {
  return `/student/courses/${encodeURIComponent(courseCodeOrId)}?tab=surveys`;
}

export function resolveStudentSurveyExitHref(
  from: string | null | undefined,
  survey?: { assignedCourses?: { courseId: string; courseName: string }[] } | null
): string {
  const courseFallback = survey?.assignedCourses?.[0]?.courseId
    ? buildStudentCourseSurveysUrl(survey.assignedCourses[0].courseId)
    : '/student/courses';
  return sanitizeStudentReturnHref(from, courseFallback);
}

function appendFromParam(params: URLSearchParams, from?: string) {
  if (from) params.set('from', from);
}

export function buildStudentSurveyStartUrl(
  surveyCode: string,
  options?: { from?: string; mode?: 'start' | 'retake' }
): string {
  const path = `/student/survey/${encodeURIComponent(surveyCode)}/start`;
  const params = new URLSearchParams();
  if (options?.mode === 'retake') params.set('mode', 'retake');
  appendFromParam(params, options?.from);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function buildStudentSurveyTakeUrl(
  surveyCode: string,
  options?: { from?: string }
): string {
  const path = `/student/survey/${encodeURIComponent(surveyCode)}`;
  const params = new URLSearchParams();
  params.set('take', '1');
  appendFromParam(params, options?.from);
  return `${path}?${params.toString()}`;
}

export function buildStudentSurveyReviewUrl(
  surveyCode: string,
  options?: { from?: string }
): string {
  const path = `/student/survey/${encodeURIComponent(surveyCode)}`;
  const params = new URLSearchParams();
  params.set('review', '1');
  appendFromParam(params, options?.from);
  return `${path}?${params.toString()}`;
}

export function openStudentSurveyTakeInNewTab(
  surveyCode: string,
  options?: { from?: string }
): void {
  const url = buildStudentSurveyTakeUrl(surveyCode, options);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function openStudentSurveyReviewInNewTab(
  surveyCode: string,
  options?: { from?: string }
): void {
  const url = buildStudentSurveyReviewUrl(surveyCode, options);
  window.open(url, '_blank', 'noopener,noreferrer');
}
