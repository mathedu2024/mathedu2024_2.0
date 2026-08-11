'use client';

import React, { useMemo } from 'react';
import { PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { StudentExamListItem } from '@/utils/studentClientApi';
import { ATTEMPT_SCORE_POLICY_OPTIONS } from '@/services/quizTypes';
import { canStartExamTake, clearExamDraft } from '@/utils/examDraftStorage';
import { openStudentExamTakeInNewTab } from '@/utils/examAttemptLabel';
import { invalidateStudentExamGet } from '@/utils/studentClientApi';

function formatScorePolicyLabel(policy?: string): string {
  const opt = ATTEMPT_SCORE_POLICY_OPTIONS.find((o) => o.value === policy);
  return opt?.label ?? '以最後一次';
}

export interface StudentExamStartPanelProps {
  exam: StudentExamListItem;
  studentId: string;
  mode?: 'start' | 'retake';
  /** 作答結束後回程（通常為課程線上測驗分頁） */
  backHref?: string;
  onCancel?: () => void;
  /** page：獨立頁面；modal：預覽等情境的彈窗 */
  variant?: 'page' | 'modal';
}

export default function StudentExamStartPanel({
  exam,
  studentId,
  mode = 'start',
  backHref,
  onCancel,
  variant = 'page',
}: StudentExamStartPanelProps) {
  const startCheck = useMemo(
    () => canStartExamTake(studentId, exam.quizCode),
    [studentId, exam.quizCode]
  );

  const canTake = exam.accessible && startCheck.allowed;
  const actionLabel =
    mode === 'retake'
      ? startCheck.hasOwnDraft
        ? '繼續作答'
        : '再次作答'
      : startCheck.hasOwnDraft
        ? '繼續作答'
        : '開始作答';

  const handleStart = () => {
    if (!canTake) return;
    if (mode === 'retake' && !startCheck.hasOwnDraft) {
      clearExamDraft(exam.quizCode, studentId);
    }
    invalidateStudentExamGet(exam.quizCode);
    openStudentExamTakeInNewTab(exam.quizCode, backHref ? { from: backHref } : undefined);
    onCancel?.();
  };

  const isPage = variant === 'page';

  return (
    <div
      className={
        isPage
          ? 'bg-white rounded-2xl border border-outline-variant/40 shadow-sm overflow-hidden'
          : 'bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col'
      }
    >
      <div className="bg-gradient-to-r from-primary to-tertiary px-5 py-4 flex justify-between items-center text-white shrink-0">
        <h2 className="font-bold text-lg flex items-center gap-2 min-w-0">
          <PencilSquareIcon className="w-5 h-5 shrink-0" />
          <span className="truncate">{mode === 'retake' ? '再次作答' : '開始作答'}</span>
        </h2>
        {!isPage && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-white/80 hover:text-white shrink-0"
            aria-label="關閉"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className={`p-5 sm:p-6 ${isPage ? '' : 'overflow-y-auto flex-1'}`}>
        <h3 className="font-bold text-on-surface text-xl mb-4">{exam.title}</h3>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-on-surfaceVariant">總分</dt>
            <dd className="font-medium text-on-surface">{exam.totalPoints} 分</dd>
          </div>
          <div>
            <dt className="text-on-surfaceVariant">限時</dt>
            <dd className="font-medium text-on-surface">{exam.timeLimitLabel}</dd>
          </div>
          <div>
            <dt className="text-on-surfaceVariant">作答期間</dt>
            <dd className="font-medium text-on-surface">{exam.answerWindowLabel}</dd>
          </div>
          <div>
            <dt className="text-on-surfaceVariant">作答次數</dt>
            <dd className="font-medium text-on-surface">{exam.attemptLimitLabel}</dd>
          </div>
          {exam.multipleAttempts && (exam.submissionCount ?? 0) > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-on-surfaceVariant">成績採計</dt>
              <dd className="font-medium text-on-surface">
                {formatScorePolicyLabel(exam.scorePolicy)}
              </dd>
            </div>
          )}
        </dl>

        {exam.submitted && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-800">
            {exam.multipleAttempts && (exam.submissionCount ?? 0) > 1 ? '已採計成績' : '最近提交'}
            {exam.resultsPublished ? (
              <>
                {' '}
                · 得分 {exam.submissionScore ?? '—'} 分
                {exam.submissionStatus === 'grading' && '（含待批改簡答）'}
              </>
            ) : (
              ' · 成績尚未公布'
            )}
            {!exam.attemptUnlimited && exam.maxAttempts != null && exam.maxAttempts > 1 && (
              <span className="text-emerald-700/80">
                {' '}
                （已作答 {exam.submissionCount ?? 0} / {exam.maxAttempts} 次）
              </span>
            )}
          </div>
        )}

        {!exam.accessible && exam.inaccessibleReason && (
          <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
            {exam.inaccessibleReason}
          </p>
        )}

        {!startCheck.allowed && startCheck.reason && (
          <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
            {startCheck.reason}
          </p>
        )}

        {startCheck.hasOwnDraft && startCheck.allowed && (
          <p className="mt-4 text-sm text-primary bg-primary/10 border border-primary/20 rounded-xl p-3">
            偵測到您有尚未提交的作答進度，將於新分頁接續作答。
          </p>
        )}
      </div>

      <div
        className={`px-5 py-4 bg-surface border-t border-outline-variant/40 flex flex-col-reverse sm:flex-row gap-2 shrink-0 ${
          isPage ? 'sm:justify-end' : ''
        }`}
      >
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={`bg-white border border-outline-variant/40 text-on-surface py-2.5 px-5 rounded-lg text-sm font-medium hover:bg-surface ${
              isPage ? '' : 'flex-1'
            }`}
          >
            {isPage ? '返回' : '取消'}
          </button>
        )}
        <button
          type="button"
          onClick={handleStart}
          disabled={!canTake}
          className={`bg-primary text-white py-2.5 px-5 rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${
            isPage ? 'sm:min-w-[8rem]' : 'flex-1'
          }`}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
