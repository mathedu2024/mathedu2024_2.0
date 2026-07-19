import type { StudentExamAttemptSummary } from '@/utils/studentClientApi';
import type { Quiz } from '@/services/quizTypes';
import { normalizeAssignedCourses } from '@/services/quizTypes';
import { formatDateTimeZhTw } from '@/utils/dateTimeFormat';

export function formatExamAttemptDateTime(iso: string): string {
  const formatted = formatDateTimeZhTw(iso, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return formatted || iso;
}

export function formatExamAttemptLabel(attemptIndex: number, submittedAt: string): string {
  return `第 ${attemptIndex} 次 · ${formatExamAttemptDateTime(submittedAt)}`;
}

export function sortExamAttempts(
  attempts: StudentExamAttemptSummary[]
): StudentExamAttemptSummary[] {
  return [...attempts].sort((a, b) => a.attemptIndex - b.attemptIndex);
}

/** 僅允許站內相對路徑，避免 open redirect */
export function sanitizeStudentReturnHref(
  from: string | null | undefined,
  fallback: string
): string {
  if (!from || !from.startsWith('/') || from.startsWith('//')) return fallback;
  return from;
}

export function buildStudentCourseExamsUrl(courseCodeOrId: string): string {
  return `/student/courses/${encodeURIComponent(courseCodeOrId)}?tab=exams`;
}

/** 離開作答／檢視時的預設回程：優先課程線上測驗分頁 */
export function resolveStudentExamExitHref(
  from: string | null | undefined,
  quiz?: Pick<Quiz, 'assignedCourses' | 'courseId' | 'courseName'> | null
): string {
  const courseFallback = (() => {
    if (!quiz) return '/student/courses';
    const courses = normalizeAssignedCourses(quiz);
    if (courses[0]?.courseId) {
      return buildStudentCourseExamsUrl(courses[0].courseId);
    }
    return '/student/courses';
  })();
  return sanitizeStudentReturnHref(from, courseFallback);
}

function appendFromParam(params: URLSearchParams, from?: string) {
  if (from) params.set('from', from);
}

export function buildStudentExamReviewUrl(
  quizCode: string,
  options?: { submissionId?: string; review?: boolean; from?: string }
): string {
  const path = `/student/exam/${encodeURIComponent(quizCode)}`;
  const params = new URLSearchParams();
  if (options?.submissionId) {
    params.set('submission', options.submissionId);
  } else if (options?.review) {
    params.set('review', '1');
  }
  appendFromParam(params, options?.from);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function openStudentExamReviewInNewTab(
  quizCode: string,
  options?: { submissionId?: string; review?: boolean; from?: string }
): void {
  const url = buildStudentExamReviewUrl(quizCode, options);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function buildStudentExamTakeUrl(
  quizCode: string,
  options?: { from?: string }
): string {
  const path = `/student/exam/${encodeURIComponent(quizCode)}`;
  const params = new URLSearchParams();
  params.set('take', '1');
  appendFromParam(params, options?.from);
  return `${path}?${params.toString()}`;
}

export function openStudentExamTakeInNewTab(
  quizCode: string,
  options?: { from?: string }
): void {
  const url = buildStudentExamTakeUrl(quizCode, options);
  window.open(url, '_blank', 'noopener,noreferrer');
}
