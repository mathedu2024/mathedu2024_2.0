'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  XMarkIcon,
  CalendarDaysIcon,
  ClockIcon,
  ArrowPathIcon,
  DocumentCheckIcon,
  Cog6ToothIcon,
  LockClosedIcon,
  ArrowsPointingOutIcon,
  HashtagIcon,
} from '@heroicons/react/24/outline';
import Dropdown from '../ui/Dropdown';
import {
  type Quiz,
  ATTEMPT_SCORE_POLICY_OPTIONS,
  MC_SCORING_OPTIONS,
  OPTION_LABEL_STYLE_OPTIONS,
  isQuizMultipleAttemptsAllowed,
  isContinuousQuestionNumbers,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
} from '@/services/quizTypes';
import { DATETIME_INPUT_LANG } from '@/utils/dateTimeFormat';

interface QuizSettingsModalProps {
  open: boolean;
  quiz: Quiz;
  onChange: (updater: (prev: Quiz) => Quiz) => void;
  onClose: () => void;
}

export default function QuizSettingsModal({ open, quiz, onChange, onClose }: QuizSettingsModalProps) {
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

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-settings-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-4 flex justify-between items-center text-white shrink-0">
          <h2 id="quiz-settings-title" className="font-bold text-lg flex items-center gap-2">
            <Cog6ToothIcon className="w-5 h-5" />
            測驗詳細設定
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white"
            aria-label="關閉"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto flex-1">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDaysIcon className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-gray-800">作答日期限制</h3>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={!!quiz.answerWindowEnabled}
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
              <span className="text-sm text-gray-700">限制作答期間（未勾選則不限日期）</span>
            </label>
            {quiz.answerWindowEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
                <div>
                  <label className="text-sm text-gray-600 mb-1.5 block">開始時間</label>
                  <input
                    type="datetime-local"
                    lang={DATETIME_INPUT_LANG}
                    value={toDatetimeLocalValue(quiz.answerStartAt)}
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
                    lang={DATETIME_INPUT_LANG}
                    value={toDatetimeLocalValue(quiz.answerEndAt)}
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
              {quiz.answerWindowEnabled
                ? '學生僅能在此期間內進入測驗作答。'
                : '未限制作答期間，開放後學生可隨時進入（仍受測驗開放／隱藏狀態影響）。'}
            </p>
          </section>

          <section className="border-t border-gray-100 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <ClockIcon className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-gray-800">考試時間限制</h3>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={!!quiz.timeLimitEnabled}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    timeLimitEnabled: e.target.checked,
                    timeLimitMinutes: e.target.checked ? (prev.timeLimitMinutes ?? 60) : undefined,
                  }))
                }
                className="w-4 h-4 text-indigo-600 rounded accent-indigo-600"
              />
              <span className="text-sm text-gray-700">啟用時間限制（未勾選則不限時）</span>
            </label>
            {quiz.timeLimitEnabled && (
              <div className="flex flex-wrap items-center gap-3 pl-6">
                <label className="text-sm text-gray-600">答題時間</label>
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={quiz.timeLimitMinutes ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      onChange((prev) => ({ ...prev, timeLimitMinutes: undefined }));
                      return;
                    }
                    const n = parseInt(raw, 10);
                    if (!Number.isNaN(n)) {
                      onChange((prev) => ({ ...prev, timeLimitMinutes: Math.min(600, n) }));
                    }
                  }}
                  onBlur={() => {
                    onChange((prev) => {
                      if (!prev.timeLimitEnabled) return prev;
                      const m = prev.timeLimitMinutes;
                      if (m === undefined || m < 1) return { ...prev, timeLimitMinutes: 60 };
                      if (m > 600) return { ...prev, timeLimitMinutes: 600 };
                      return prev;
                    });
                  }}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <span className="text-sm text-gray-500">分鐘</span>
              </div>
            )}
          </section>

          <section className="border-t border-gray-100 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <ArrowPathIcon className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-gray-800">作答次數限制</h3>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={!!quiz.attemptUnlimited}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    attemptUnlimited: e.target.checked,
                    attemptLimit: e.target.checked ? undefined : (prev.attemptLimit ?? 1),
                  }))
                }
                className="w-4 h-4 text-indigo-600 rounded accent-indigo-600"
              />
              <span className="text-sm text-gray-700">允許無限次作答</span>
            </label>
            {!quiz.attemptUnlimited && (
              <div className="flex flex-wrap items-center gap-3 pl-6">
                <label className="text-sm text-gray-600">每位學生最多</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={quiz.attemptLimit === undefined ? '' : String(quiz.attemptLimit)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    if (raw === '') {
                      onChange((prev) => ({ ...prev, attemptLimit: undefined }));
                      return;
                    }
                    const n = parseInt(raw, 10);
                    if (!Number.isNaN(n) && n > 0) {
                      onChange((prev) => ({ ...prev, attemptLimit: n }));
                    }
                  }}
                  onBlur={() => {
                    onChange((prev) => ({
                      ...prev,
                      attemptLimit: Math.max(1, prev.attemptLimit ?? 1),
                    }));
                  }}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <span className="text-sm text-gray-500">次</span>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2 pl-6">
              {quiz.attemptUnlimited
                ? '學生可重複進入測驗並多次提交，每次提交皆會保留紀錄。'
                : `學生最多可提交 ${Math.max(1, quiz.attemptLimit ?? 1)} 次，達上限後僅能檢視作答。`}
            </p>
            {isQuizMultipleAttemptsAllowed(quiz) && (
              <div className="mt-4 pl-6">
                <label className="text-sm text-gray-600 mb-1.5 block">成績採計方式</label>
                <Dropdown
                  value={quiz.attemptScorePolicy ?? 'latest'}
                  onChange={(v) =>
                    onChange((prev) => ({
                      ...prev,
                      attemptScorePolicy: v as Quiz['attemptScorePolicy'],
                    }))
                  }
                  options={ATTEMPT_SCORE_POLICY_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {
                    ATTEMPT_SCORE_POLICY_OPTIONS.find(
                      (o) => o.value === (quiz.attemptScorePolicy ?? 'latest')
                    )?.hint
                  }
                </p>
              </div>
            )}
          </section>

          <section className="border-t border-gray-100 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <LockClosedIcon className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-gray-800">作答環境</h3>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={!!quiz.examLockEnabled}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, examLockEnabled: e.target.checked }))
                }
                className="w-4 h-4 text-indigo-600 rounded accent-indigo-600"
              />
              <span className="text-sm text-gray-700">作答期間禁止離開測驗頁</span>
            </label>
            <p className="text-xs text-gray-400 pl-6 mb-3">
              啟用後學生無法返回列表或關閉分頁。未啟用全螢幕時，學生主動離開將不保留暫存並重算時間；重新載入仍可恢復進度。
            </p>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={!!quiz.requireFullscreen}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, requireFullscreen: e.target.checked }))
                }
                className="w-4 h-4 text-indigo-600 rounded accent-indigo-600"
              />
              <span className="text-sm text-gray-700 flex items-center gap-1">
                <ArrowsPointingOutIcon className="w-4 h-4" />
                要求全螢幕作答
              </span>
            </label>
            <p className="text-xs text-gray-400 pl-6">
              學生進入測驗後會自動進入瀏覽器全螢幕（等同 F11）；無法以 F11 或 Esc 退出全螢幕。
            </p>
          </section>

          <section className="border-t border-gray-100 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <DocumentCheckIcon className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-gray-800">成績公布</h3>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={quiz.resultsPublished === false}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    resultsPublished: !e.target.checked,
                  }))
                }
                className="w-4 h-4 text-indigo-600 rounded accent-indigo-600"
              />
              <span className="text-sm text-gray-700">暫不公布正確答案與逐題詳情</span>
            </label>
            <p className="text-xs text-gray-400 pl-6">
              勾選後學生仍可看到自己的總分，但不會看到正確答案、逐題得分與老師評語；取消勾選即可向學生完整公布。
            </p>
          </section>

          <section className="border-t border-gray-100 pt-6">
            <h3 className="text-sm font-bold text-gray-800 mb-3">測驗作答設定</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600 mb-1.5 block">新題預設選項標示</label>
                <Dropdown
                  value={quiz.optionLabelStyle ?? 'letter_paren'}
                  onChange={(v) => onChange((prev) => ({ ...prev, optionLabelStyle: v as Quiz['optionLabelStyle'] }))}
                  options={OPTION_LABEL_STYLE_OPTIONS}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1.5 block">多選題計分方式（整卷一致）</label>
                <Dropdown
                  value={quiz.mcScoringMethod ?? 'average'}
                  onChange={(v) => onChange((prev) => ({ ...prev, mcScoringMethod: v as Quiz['mcScoringMethod'] }))}
                  options={MC_SCORING_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {MC_SCORING_OPTIONS.find((o) => o.value === (quiz.mcScoringMethod ?? 'average'))?.hint}
                </p>
              </div>
              <div className="sm:col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <HashtagIcon className="w-4 h-4 text-indigo-600" />
                  <label className="text-sm text-gray-600 font-medium">大題題號編排</label>
                </div>
                <div className="space-y-2 pl-6">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="question-numbering"
                      checked={isContinuousQuestionNumbers(quiz)}
                      onChange={() =>
                        onChange((prev) => ({ ...prev, continuousQuestionNumbers: true }))
                      }
                      className="w-4 h-4 text-indigo-600 accent-indigo-600 mt-0.5"
                    />
                    <span className="text-sm text-gray-700">
                      大題間連續編號
                      <span className="block text-xs text-gray-400 mt-0.5">
                        第二大題接續第一大題題號（例：第一大題 1–5 題，第二大題從 6 題開始）
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="question-numbering"
                      checked={!isContinuousQuestionNumbers(quiz)}
                      onChange={() =>
                        onChange((prev) => ({ ...prev, continuousQuestionNumbers: false }))
                      }
                      className="w-4 h-4 text-indigo-600 accent-indigo-600 mt-0.5"
                    />
                    <span className="text-sm text-gray-700">
                      各大題重新編號
                      <span className="block text-xs text-gray-400 mt-0.5">
                        每個大題皆從 1 題開始（例：第一大題 1–5 題，第二大題亦為 1–3 題）
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-white border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm"
          >
            完成
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
