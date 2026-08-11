'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  AcademicCapIcon,
  ClockIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import type { StudentExamListItem } from '@/utils/studentClientApi';
import { ATTEMPT_SCORE_POLICY_OPTIONS } from '@/services/quizTypes';
import { canStartExamTake, clearExamDraft } from '@/utils/examDraftStorage';
import {
  buildStudentExamReviewUrl,
  buildStudentExamTakeUrl,
  formatExamAttemptDateTime,
  sortExamAttempts,
} from '@/utils/examAttemptLabel';
import { invalidateStudentExamGet } from '@/utils/studentClientApi';

function formatScorePolicyLabel(policy?: string): string {
  const opt = ATTEMPT_SCORE_POLICY_OPTIONS.find((o) => o.value === policy);
  return opt?.label ?? '以最後一次';
}

function statusLabel(exam: StudentExamListItem): { text: string; className: string } {
  if (exam.submitted && exam.resultsPublished) {
    return {
      text: `已完成 · ${exam.submissionScore ?? '—'} 分`,
      className: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    };
  }
  if (exam.submitted) {
    return {
      text: '已完成 · 成績尚未公布',
      className: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    };
  }
  if (exam.windowEnded || exam.windowPhase === 'ended') {
    return { text: '作答期間已截止', className: 'bg-surface-container text-on-surfaceVariant border-outline-variant/40' };
  }
  if (exam.windowPhase === 'upcoming') {
    return { text: '作答期間尚未開始', className: 'bg-amber-50 text-amber-800 border-amber-100' };
  }
  if (exam.accessible) {
    return { text: '可開始作答', className: 'bg-primary/10 text-primary border-primary/20' };
  }
  return {
    text: exam.inaccessibleReason || '目前無法作答',
    className: 'bg-amber-50 text-amber-800 border-amber-100',
  };
}

export interface StudentExamStartPageViewProps {
  exam: StudentExamListItem;
  studentId: string;
  mode?: 'start' | 'retake';
  backHref?: string;
}

export default function StudentExamStartPageView({
  exam,
  studentId,
  mode = 'start',
  backHref,
}: StudentExamStartPageViewProps) {
  const router = useRouter();
  const startCheck = useMemo(
    () => canStartExamTake(studentId, exam.quizCode),
    [studentId, exam.quizCode]
  );
  const attempts = useMemo(
    () => sortExamAttempts(exam.attempts ?? []),
    [exam.attempts]
  );
  const badge = statusLabel(exam);
  const canTake = exam.accessible && startCheck.allowed;
  const actionLabel =
    mode === 'retake'
      ? startCheck.hasOwnDraft
        ? '繼續作答'
        : '再次作答'
      : startCheck.hasOwnDraft
        ? '繼續作答'
        : '開始作答';

  const courseNames =
    exam.assignedCourses?.map((c) => c.courseName).filter(Boolean).join('、') || '—';

  const infoItems = [
    { label: '總分', value: `${exam.totalPoints} 分`, icon: AcademicCapIcon },
    { label: '限時', value: exam.timeLimitLabel, icon: ClockIcon },
    { label: '作答期間', value: exam.answerWindowLabel, icon: CalendarDaysIcon },
    { label: '作答次數', value: exam.attemptLimitLabel, icon: ClipboardDocumentCheckIcon },
  ];

  if (exam.multipleAttempts) {
    infoItems.push({
      label: '成績採計',
      value: formatScorePolicyLabel(exam.scorePolicy),
      icon: InformationCircleIcon,
    });
  }

  const fromOpt = backHref ? { from: backHref } : undefined;

  const handleStart = () => {
    if (!canTake) return;
    if (mode === 'retake' && !startCheck.hasOwnDraft) {
      clearExamDraft(exam.quizCode, studentId);
    }
    invalidateStudentExamGet(exam.quizCode);
    router.push(buildStudentExamTakeUrl(exam.quizCode, fromOpt));
  };

  const openAttempt = (submissionId: string) => {
    router.push(buildStudentExamReviewUrl(exam.quizCode, { submissionId, ...fromOpt }));
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 測驗資訊 */}
      <section className="bg-white border border-outline-variant/40 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-5 sm:py-6 border-b border-outline-variant/40 bg-gradient-to-br from-surface via-white to-primary/5">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${badge.className}`}>
              {badge.text}
            </span>
            {exam.examLockEnabled && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-outline-variant/40 text-on-surfaceVariant">
                啟用作答鎖定
              </span>
            )}
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-on-surface leading-snug">
            {exam.title}
          </h2>
          <p className="text-sm text-on-surfaceVariant mt-2">適用課程：{courseNames}</p>
        </div>

        <div className="px-5 sm:px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {infoItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-outline-variant/40 bg-surface/80 px-4 py-3"
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium text-on-surfaceVariant mb-1">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {item.label}
                  </div>
                  <p className="text-sm font-semibold text-on-surface leading-snug">{item.value}</p>
                </div>
              );
            })}
          </div>

          {!exam.accessible && exam.inaccessibleReason && (
            <div className="mt-4 flex gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <ExclamationTriangleIcon className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{exam.inaccessibleReason}</p>
            </div>
          )}

          {!startCheck.allowed && startCheck.reason && (
            <div className="mt-4 flex gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
              <ExclamationTriangleIcon className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{startCheck.reason}</p>
            </div>
          )}

          {startCheck.hasOwnDraft && startCheck.allowed && (
            <div className="mt-4 flex gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
              <InformationCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
              <p>偵測到尚未提交的作答進度，開始後將接續作答。</p>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleStart}
              disabled={!canTake}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {actionLabel}
            </button>
          </div>
        </div>
      </section>

      {/* 作答紀錄表格 */}
      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h3 className="text-lg font-bold text-on-surface">作答紀錄</h3>
            <p className="text-sm text-on-surfaceVariant mt-0.5">
              {attempts.length > 0
                ? `共 ${attempts.length} 次提交${
                    !exam.attemptUnlimited && exam.maxAttempts != null
                      ? `（上限 ${exam.maxAttempts} 次）`
                      : ''
                  }`
                : '尚未有提交紀錄'}
            </p>
          </div>
        </div>

        <div className="bg-white border border-outline-variant/40 rounded-2xl shadow-sm overflow-hidden">
          {attempts.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-on-surfaceVariant">
              尚無作答紀錄
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-surface border-b border-outline-variant/40 text-left text-xs font-semibold text-on-surfaceVariant uppercase tracking-wide">
                    <th className="px-4 sm:px-5 py-3 whitespace-nowrap">次數</th>
                    <th className="px-4 sm:px-5 py-3 whitespace-nowrap">提交時間</th>
                    <th className="px-4 sm:px-5 py-3 whitespace-nowrap">成績</th>
                    <th className="px-4 sm:px-5 py-3 whitespace-nowrap">狀態</th>
                    <th className="px-4 sm:px-5 py-3 whitespace-nowrap text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {attempts.map((attempt) => {
                    const isGrading = attempt.status === 'grading';
                    return (
                      <tr key={attempt.id} className="hover:bg-primary/5 transition-colors">
                        <td className="px-4 sm:px-5 py-3.5 font-medium text-on-surface whitespace-nowrap">
                          第 {attempt.attemptIndex} 次
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 text-on-surfaceVariant whitespace-nowrap">
                          {formatExamAttemptDateTime(attempt.submittedAt)}
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                          {exam.resultsPublished ? (
                            <span className="font-semibold text-emerald-700">
                              {attempt.totalScore ?? '—'} 分
                            </span>
                          ) : (
                            <span className="text-on-surfaceVariant">尚未公布</span>
                          )}
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                          {isGrading ? (
                            <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-100">
                              待批改
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-100">
                              已提交
                            </span>
                          )}
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openAttempt(attempt.id)}
                            className="text-primary hover:text-primary font-medium"
                          >
                            查看
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
