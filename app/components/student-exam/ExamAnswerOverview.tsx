'use client';

import React, { useRef } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';
import type { QuestionOverviewItem } from '@/utils/examAnswerStatus';

const STATUS_CLASS: Record<QuestionOverviewItem['status'], string> = {
  answered: 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200',
  unanswered: 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200',
  skipped: 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200',
};

const ACTIVE_RING = 'ring-2 ring-indigo-500 ring-offset-1';

interface ExamAnswerOverviewProps {
  items: QuestionOverviewItem[];
  remainingMs: number | null;
  showTimer: boolean;
  formatRemaining: (ms: number) => string;
  readOnly?: boolean;
  currentQuestionId?: string;
  onJumpToQuestion: (questionId: string) => void;
  onToggleSkip: (questionId: string) => void;
}

export default function ExamAnswerOverview({
  items,
  remainingMs,
  showTimer,
  formatRemaining,
  readOnly = false,
  currentQuestionId,
  onJumpToQuestion,
  onToggleSkip,
}: ExamAnswerOverviewProps) {
  const urgent = remainingMs !== null && remainingMs < 5 * 60 * 1000;
  const lastClickRef = useRef<{ id: string; at: number } | null>(null);

  const handleQuestionClick = (item: QuestionOverviewItem) => {
    if (readOnly) {
      onJumpToQuestion(item.id);
      return;
    }
    const now = Date.now();
    if (
      lastClickRef.current?.id === item.id &&
      now - lastClickRef.current.at < 450
    ) {
      onToggleSkip(item.id);
      lastClickRef.current = null;
      return;
    }
    lastClickRef.current = { id: item.id, at: now };
    onJumpToQuestion(item.id);
  };

  return (
    <aside className="w-full lg:w-52 xl:w-56 shrink-0 lg:self-stretch order-1 lg:order-2">
      <div className="space-y-4 py-2 lg:py-0 lg:sticky lg:top-4 lg:z-20 lg:max-h-[calc(100dvh-2rem)] lg:flex lg:flex-col">
        {showTimer && remainingMs !== null && (
          <div
            className={`shrink-0 rounded-xl border px-4 py-3 text-center shadow-sm ${
              urgent ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide opacity-80 mb-1">
              <ClockIcon className="w-4 h-4" />
              剩餘時間
            </div>
            <div className="text-2xl font-mono font-bold tabular-nums">{formatRemaining(remainingMs)}</div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <h3 className="text-sm font-bold text-gray-800 mb-2">作答概況</h3>
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                title={
                  item.status === 'skipped'
                    ? `第 ${item.number} 題（已標記略過）`
                    : item.status === 'answered'
                      ? `第 ${item.number} 題（已作答）`
                      : `第 ${item.number} 題（未作答）`
                }
                onClick={() => handleQuestionClick(item)}
                onContextMenu={(e) => {
                  if (readOnly) return;
                  e.preventDefault();
                  onToggleSkip(item.id);
                }}
                className={`h-8 w-full min-w-0 rounded-lg border text-xs font-bold transition-colors flex items-center justify-center ${
                  STATUS_CLASS[item.status]
                } ${currentQuestionId === item.id ? ACTIVE_RING : ''}`}
              >
                {item.number}
              </button>
            ))}
          </div>
          <div className="space-y-1 text-[11px] text-gray-500 leading-relaxed">
            <p>
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-200 border border-emerald-400 mr-1 align-middle" />
              已作答
            </p>
            <p>
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gray-200 border border-gray-400 mr-1 align-middle" />
              未作答
            </p>
            <p>
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-200 border border-red-400 mr-1 align-middle" />
              標記略過
            </p>
            {!readOnly && (
              <p className="text-gray-400 pt-1 border-t border-gray-100 mt-2">
                點題號跳轉；連點兩下或右鍵可標記／取消略過
              </p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
