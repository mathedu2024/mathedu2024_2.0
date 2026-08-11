'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ClipboardDocumentListIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { StudentExamAttemptSummary } from '@/utils/studentClientApi';
import {
  buildStudentExamReviewUrl,
  formatExamAttemptLabel,
  openStudentExamReviewInNewTab,
  sortExamAttempts,
} from '@/utils/examAttemptLabel';

interface StudentExamAttemptPickerModalProps {
  open: boolean;
  onClose: () => void;
  quizCode: string;
  examTitle: string;
  attempts: StudentExamAttemptSummary[];
  resultsPublished: boolean;
  /** 在檢視視窗內切換時改為同視窗導覽，預設仍於新分頁開啟 */
  openMode?: 'newTab' | 'sameWindow';
  currentSubmissionId?: string;
  /** 檢視結束後回程（通常為課程線上測驗分頁） */
  backHref?: string;
}

export default function StudentExamAttemptPickerModal({
  open,
  onClose,
  examTitle,
  quizCode,
  attempts,
  resultsPublished,
  openMode = 'newTab',
  currentSubmissionId,
  backHref,
}: StudentExamAttemptPickerModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const sortedAttempts = useMemo(() => sortExamAttempts(attempts), [attempts]);

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

  const handlePick = (submissionId: string) => {
    const fromOpt = backHref ? { from: backHref } : undefined;
    if (openMode === 'sameWindow') {
      if (submissionId !== currentSubmissionId) {
        router.push(buildStudentExamReviewUrl(quizCode, { submissionId, ...fromOpt }));
      }
    } else {
      openStudentExamReviewInNewTab(quizCode, { submissionId, ...fromOpt });
    }
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-attempt-picker-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="bg-gradient-to-r from-primary to-tertiary px-5 py-4 flex justify-between items-center text-white shrink-0">
          <h2 id="exam-attempt-picker-title" className="font-bold text-lg flex items-center gap-2 min-w-0">
            <ClipboardDocumentListIcon className="w-5 h-5 shrink-0" />
            <span className="truncate">查看作答紀錄</span>
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
          <h3 className="font-bold text-on-surface text-lg mb-1">{examTitle}</h3>
          <p className="text-sm text-on-surfaceVariant mb-4">
            {openMode === 'sameWindow'
              ? '選擇要檢視的作答紀錄。'
              : '選擇要檢視的作答紀錄，將於新分頁開啟。'}
          </p>

          {sortedAttempts.length === 0 ? (
            <p className="text-sm text-on-surfaceVariant text-center py-8">尚無作答紀錄</p>
          ) : (
            <ul className="space-y-2">
              {sortedAttempts.map((attempt) => {
                const isCurrent =
                  openMode === 'sameWindow' && attempt.id === currentSubmissionId;
                return (
                <li key={attempt.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(attempt.id)}
                    disabled={isCurrent}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      isCurrent
                        ? 'border-primary/40 bg-primary/20 cursor-default'
                        : 'border-outline-variant/40 hover:border-primary/40 hover:bg-primary/10'
                    }`}
                  >
                    <p className="font-medium text-on-surface">
                      {formatExamAttemptLabel(attempt.attemptIndex, attempt.submittedAt)}
                    </p>
                    {resultsPublished ? (
                      <p className="text-sm text-emerald-700 mt-0.5">
                        得分 {attempt.totalScore ?? '—'} 分
                        {attempt.status === 'grading' && '（含待批改簡答）'}
                      </p>
                    ) : (
                      <p className="text-sm text-on-surfaceVariant mt-0.5">成績尚未公布</p>
                    )}
                    {isCurrent && (
                      <p className="text-xs text-primary mt-1">目前檢視中</p>
                    )}
                  </button>
                </li>
              );
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-4 bg-surface border-t border-outline-variant/40 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-white border border-outline-variant/40 text-on-surface py-2.5 rounded-lg text-sm font-medium hover:bg-surface"
          >
            取消
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
