import type { StudentAnswers } from '@/services/quizSubmissionTypes';

export type QuestionAnswerStatus = 'answered' | 'unanswered' | 'skipped';

export interface QuestionOverviewItem {
  id: string;
  number: number;
  status: QuestionAnswerStatus;
}

export function isQuestionAnswered(value: StudentAnswers[string] | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return false;
}

export function getQuestionAnswerStatus(
  questionId: string,
  answers: StudentAnswers,
  skippedIds: string[]
): QuestionAnswerStatus {
  if (skippedIds.includes(questionId)) return 'skipped';
  if (isQuestionAnswered(answers[questionId])) return 'answered';
  return 'unanswered';
}

export function buildQuestionOverview(
  numbered: { id: string; number: number }[],
  answers: StudentAnswers,
  skippedIds: string[]
): QuestionOverviewItem[] {
  return numbered.map((entry) => ({
    id: entry.id,
    number: entry.number,
    status: getQuestionAnswerStatus(entry.id, answers, skippedIds),
  }));
}

export function countOverviewStats(items: QuestionOverviewItem[]) {
  return items.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { answered: 0, unanswered: 0, skipped: 0 }
  );
}

const STATUS_CELL_STYLE: Record<QuestionAnswerStatus, { bg: string; color: string; border: string }> = {
  answered: { bg: '#d1fae5', color: '#047857', border: '#6ee7b7' },
  unanswered: { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' },
  skipped: { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
};

export function buildSubmitSummaryHtml(items: QuestionOverviewItem[]): string {
  const stats = countOverviewStats(items);
  const cells = items
    .map((item) => {
      const s = STATUS_CELL_STYLE[item.status];
      return `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:2rem;border-radius:0.5rem;font-size:0.75rem;font-weight:700;background:${s.bg};color:${s.color};border:1px solid ${s.border};">${item.number}</span>`;
    })
    .join('');

  return `
    <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;max-height:200px;overflow-y:auto;padding:4px 0;margin:8px 0 12px;">
      ${cells}
    </div>
    <p style="font-size:14px;color:#374151;text-align:center;line-height:1.6;margin:0;">
      <span style="color:#047857;font-weight:600;">■ 已答 ${stats.answered}</span>
      <span style="margin-left:14px;color:#6b7280;font-weight:600;">■ 未答 ${stats.unanswered}</span>
      <span style="margin-left:14px;color:#b91c1c;font-weight:600;">■ 略過 ${stats.skipped}</span>
    </p>
  `;
}
