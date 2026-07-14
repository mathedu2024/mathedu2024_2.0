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
    if (openMode === 'sameWindow') {
      if (submissionId !== currentSubmissionId) {
        router.push(buildStudentExamReviewUrl(quizCode, { submissionId }));
      }
    } else {
      openStudentExamReviewInNewTab(quizCode, { submissionId });
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
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-4 flex justify-between items-center text-white shrink-0">
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
          <h3 className="font-bold text-gray-900 text-lg mb-1">{examTitle}</h3>
          <p className="text-sm text-gray-500 mb-4">
            {openMode === 'sameWindow'
              ? '選擇要檢視的作答紀錄。'
              : '選擇要檢視的作答紀錄，將於新分頁開啟。'}
          </p>

          {sortedAttempts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">尚無作答紀錄</p>
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
                        ? 'border-indigo-300 bg-indigo-50/70 cursor-default'
                        : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                    }`}
                  >
                    <p className="font-medium text-gray-900">
                      {formatExamAttemptLabel(attempt.attemptIndex, attempt.submittedAt)}
                    </p>
                    {resultsPublished ? (
                      <p className="text-sm text-emerald-700 mt-0.5">
                        得分 {attempt.totalScore ?? '—'} 分
                        {attempt.status === 'grading' && '（含待批改簡答）'}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 mt-0.5">成績尚未公布</p>
                    )}
                    {isCurrent && (
                      <p className="text-xs text-indigo-600 mt-1">目前檢視中</p>
                    )}
                  </button>
                </li>
              );
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-white border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            取消
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
