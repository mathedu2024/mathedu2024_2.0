'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardDocumentListIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { StudentSurveyListItem } from '@/utils/studentClientApi';
import { openStudentSurveyTakeInNewTab } from '@/utils/surveyAttemptLabel';

interface StudentSurveyStartModalProps {
  open: boolean;
  onClose: () => void;
  survey: StudentSurveyListItem;
  mode?: 'start' | 'retake';
}

export default function StudentSurveyStartModal({
  open,
  onClose,
  survey,
  mode = 'start',
}: StudentSurveyStartModalProps) {
  const [mounted, setMounted] = useState(false);

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

  const canTake = survey.accessible && (!survey.submitted || survey.canRetake);
  const actionLabel = mode === 'retake' ? '再次填寫' : '開始填寫';

  const handleStart = () => {
    if (!canTake) return;
    openStudentSurveyTakeInNewTab(survey.surveyCode);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="survey-start-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="bg-gradient-to-r from-primary to-tertiary px-5 py-4 flex justify-between items-center text-white shrink-0">
          <h2 id="survey-start-title" className="font-bold text-lg flex items-center gap-2 min-w-0">
            <ClipboardDocumentListIcon className="w-5 h-5 shrink-0" />
            <span className="truncate">{mode === 'retake' ? '再次填寫' : '開始填寫'}</span>
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
          <h3 className="font-bold text-on-surface text-lg mb-4">{survey.title}</h3>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-on-surfaceVariant">填答模式</dt>
              <dd className="font-medium text-on-surface">{survey.responseModeLabel}</dd>
            </div>
            <div>
              <dt className="text-on-surfaceVariant">填答期間</dt>
              <dd className="font-medium text-on-surface">{survey.answerWindowLabel}</dd>
            </div>
            <div>
              <dt className="text-on-surfaceVariant">填寫次數</dt>
              <dd className="font-medium text-on-surface">
                {survey.maxAttempts <= 1 ? '限填一次' : `最多 ${survey.maxAttempts} 次`}
              </dd>
            </div>
            {(survey.submissionCount ?? 0) > 0 && (
              <div>
                <dt className="text-on-surfaceVariant">已填寫</dt>
                <dd className="font-medium text-on-surface">
                  {survey.submissionCount} / {survey.maxAttempts} 次
                </dd>
              </div>
            )}
          </dl>

          {survey.submitted && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-800">
              您已完成此問卷
              {survey.canRetake ? '，可再次填寫。' : '。'}
            </div>
          )}

          {!survey.accessible && survey.inaccessibleReason && (
            <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
              {survey.inaccessibleReason}
            </p>
          )}
        </div>

        <div className="px-5 py-4 bg-surface border-t border-outline-variant/40 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-white border border-outline-variant/40 text-on-surface py-2.5 rounded-lg text-sm font-medium hover:bg-surface"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={!canTake}
            className="flex-1 bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
