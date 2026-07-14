'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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

interface StudentExamStartModalProps {
  open: boolean;
  onClose: () => void;
  exam: StudentExamListItem;
  studentId: string;
  mode?: 'start' | 'retake';
  resolveExamTitle?: (quizCode: string) => string | undefined;
}

export default function StudentExamStartModal({
  open,
  onClose,
  exam,
  studentId,
  mode = 'start',
}: StudentExamStartModalProps) {
  const [mounted, setMounted] = useState(false);

  const startCheck = useMemo(
    () => (open ? canStartExamTake(studentId, exam.quizCode) : { allowed: true }),
    [open, studentId, exam.quizCode]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

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
    openStudentExamTakeInNewTab(exam.quizCode);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-start-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-4 flex justify-between items-center text-white shrink-0">
          <h2 id="exam-start-title" className="font-bold text-lg flex items-center gap-2 min-w-0">
            <PencilSquareIcon className="w-5 h-5 shrink-0" />
            <span className="truncate">{mode === 'retake' ? '再次作答' : '開始作答'}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white shrink-0"
            aria-label="關閉"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <h3 className="font-bold text-gray-900 text-lg mb-4">{exam.title}</h3>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-500">總分</dt>
              <dd className="font-medium text-gray-900">{exam.totalPoints} 分</dd>
            </div>
            <div>
              <dt className="text-gray-500">限時</dt>
              <dd className="font-medium text-gray-900">{exam.timeLimitLabel}</dd>
            </div>
            <div>
              <dt className="text-gray-500">作答期間</dt>
              <dd className="font-medium text-gray-900">{exam.answerWindowLabel}</dd>
            </div>
            <div>
              <dt className="text-gray-500">作答次數</dt>
              <dd className="font-medium text-gray-900">{exam.attemptLimitLabel}</dd>
            </div>
            {exam.multipleAttempts && (exam.submissionCount ?? 0) > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-gray-500">成績採計</dt>
                <dd className="font-medium text-gray-900">
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
            <p className="mt-4 text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
              偵測到您有尚未提交的作答進度，將於新分頁接續作答。
            </p>
          )}
        </div>

        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-white border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={!canTake}
            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
