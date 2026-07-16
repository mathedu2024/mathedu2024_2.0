'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  XMarkIcon,
  Cog6ToothIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import type { Survey, SurveyResponseMode } from '@/services/surveyTypes';
import {
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  isSurveyResponsesVisibleToStudents,
} from '@/services/surveyTypes';

interface SurveySettingsModalProps {
  open: boolean;
  survey: Survey;
  onChange: (updater: (prev: Survey) => Survey) => void;
  onClose: () => void;
}

export default function SurveySettingsModal({
  open,
  survey,
  onChange,
  onClose,
}: SurveySettingsModalProps) {
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

  const setMode = (responseMode: SurveyResponseMode) => {
    onChange((prev) => ({ ...prev, responseMode }));
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="survey-settings-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-4 flex justify-between items-center text-white shrink-0">
          <h2 id="survey-settings-title" className="font-bold text-lg flex items-center gap-2">
            <Cog6ToothIcon className="w-5 h-5" />
            問卷詳細設定
          </h2>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white" aria-label="關閉">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <UserGroupIcon className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-gray-800">填答模式</h3>
            </div>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 has-[:checked]:border-indigo-300 has-[:checked]:bg-indigo-50/50">
                <input
                  type="radio"
                  name="survey-response-mode"
                  checked={survey.responseMode === 'named'}
                  onChange={() => setMode('named')}
                  className="mt-0.5 size-4 accent-indigo-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-800">記名</span>
                  <span className="block text-xs text-gray-500 mt-0.5">教師可看到填寫者姓名</span>
                </span>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 has-[:checked]:border-indigo-300 has-[:checked]:bg-indigo-50/50">
                <input
                  type="radio"
                  name="survey-response-mode"
                  checked={survey.responseMode === 'anonymous'}
                  onChange={() => setMode('anonymous')}
                  className="mt-0.5 size-4 accent-indigo-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-800">不記名</span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    仍需登入、每人限填一次；教師端只看統計，不顯示姓名
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section className="border-t border-gray-100 pt-5">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDaysIcon className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-gray-800">填答日期限制</h3>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={!!survey.answerWindowEnabled}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    answerWindowEnabled: e.target.checked,
                    answerStartAt: e.target.checked ? prev.answerStartAt : undefined,
                    answerEndAt: e.target.checked ? prev.answerEndAt : undefined,
                  }))
                }
                className="w-4 h-4 text-indigo-600 rounded accent-indigo-600"
              />
              <span className="text-sm text-gray-700">限制填答期間（未勾選則不限日期）</span>
            </label>
            {survey.answerWindowEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
                <div>
                  <label className="text-sm text-gray-600 mb-1.5 block">開始時間</label>
                  <input
                    type="datetime-local"
                    lang="en-GB"
                    value={toDatetimeLocalValue(survey.answerStartAt)}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        answerStartAt: fromDatetimeLocalValue(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 mb-1.5 block">截止時間</label>
                  <input
                    type="datetime-local"
                    lang="en-GB"
                    value={toDatetimeLocalValue(survey.answerEndAt)}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        answerEndAt: fromDatetimeLocalValue(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">
              {survey.answerWindowEnabled
                ? '問卷開放後，學生僅能在此期間內填寫。'
                : '未限制填答期間，開放後學生可隨時填寫（仍受問卷開放／隱藏狀態影響）。'}
            </p>
          </section>

          <section className="border-t border-gray-100 pt-5">
            <div className="flex items-center gap-2 mb-3">
              <EyeIcon className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-gray-800">學生查看填答</h3>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isSurveyResponsesVisibleToStudents(survey)}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    responsesVisibleToStudents: e.target.checked,
                  }))
                }
                className="mt-0.5 size-4 rounded accent-indigo-600"
              />
              <span>
                <span className="block text-sm text-gray-800">允許學生查看自己的填答內容</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  送出後學生可在課程問卷列表開啟「查看填寫」複習自己的答案
                </span>
              </span>
            </label>
          </section>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
          >
            完成
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
