import type { StudentExamAttemptSummary } from '@/utils/studentClientApi';

export function formatExamAttemptDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function formatExamAttemptLabel(attemptIndex: number, submittedAt: string): string {
  return `第 ${attemptIndex} 次 · ${formatExamAttemptDateTime(submittedAt)}`;
}

export function sortExamAttempts(
  attempts: StudentExamAttemptSummary[]
): StudentExamAttemptSummary[] {
  return [...attempts].sort((a, b) => a.attemptIndex - b.attemptIndex);
}

export function buildStudentExamReviewUrl(
  quizCode: string,
  options?: { submissionId?: string; review?: boolean }
): string {
  const path = `/student/exam/${encodeURIComponent(quizCode)}`;
  const params = new URLSearchParams();
  if (options?.submissionId) {
    params.set('submission', options.submissionId);
  } else if (options?.review) {
    params.set('review', '1');
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function openStudentExamReviewInNewTab(
  quizCode: string,
  options?: { submissionId?: string; review?: boolean }
): void {
  const url = buildStudentExamReviewUrl(quizCode, options);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function buildStudentExamTakeUrl(quizCode: string): string {
  const path = `/student/exam/${encodeURIComponent(quizCode)}`;
  return `${path}?take=1`;
}

export function openStudentExamTakeInNewTab(quizCode: string): void {
  const url = buildStudentExamTakeUrl(quizCode);
  window.open(url, '_blank', 'noopener,noreferrer');
}
