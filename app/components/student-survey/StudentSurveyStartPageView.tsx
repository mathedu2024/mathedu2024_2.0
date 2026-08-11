'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import type { StudentSurveyListItem } from '@/utils/studentClientApi';
import {
  buildStudentSurveyReviewUrl,
  buildStudentSurveyTakeUrl,
  formatSurveyAttemptDateTime,
  sortSurveyAttempts,
} from '@/utils/surveyAttemptLabel';

function statusLabel(survey: StudentSurveyListItem): { text: string; className: string } {
  if (survey.submitted) {
    return {
      text: survey.canRetake ? '已完成 · 可再次填寫' : '已完成填寫',
      className: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    };
  }
  if (survey.windowEnded || survey.windowPhase === 'ended') {
    return { text: '填答期間已截止', className: 'bg-surface-container text-on-surfaceVariant border-outline-variant/40' };
  }
  if (survey.windowPhase === 'upcoming') {
    return { text: '填答期間尚未開始', className: 'bg-amber-50 text-amber-800 border-amber-100' };
  }
  if (survey.accessible) {
    return { text: '可開始填寫', className: 'bg-primary/10 text-primary border-primary/20' };
  }
  return {
    text: survey.inaccessibleReason || '目前無法填寫',
    className: 'bg-amber-50 text-amber-800 border-amber-100',
  };
}

export interface StudentSurveyStartPageViewProps {
  survey: StudentSurveyListItem;
  mode?: 'start' | 'retake';
  backHref?: string;
}

export default function StudentSurveyStartPageView({
  survey,
  mode = 'start',
  backHref,
}: StudentSurveyStartPageViewProps) {
  const router = useRouter();
  const attempts = useMemo(
    () => sortSurveyAttempts(survey.attempts ?? []),
    [survey.attempts]
  );
  const badge = statusLabel(survey);
  const canTake = survey.accessible && (!survey.submitted || survey.canRetake);
  const actionLabel = mode === 'retake' ? '再次填寫' : '開始填寫';
  const attemptLimitLabel =
    survey.maxAttempts <= 1 ? '限填一次' : `最多 ${survey.maxAttempts} 次`;
  const courseNames =
    survey.assignedCourses?.map((c) => c.courseName).filter(Boolean).join('、') || '—';

  const infoItems = [
    { label: '填答模式', value: survey.responseModeLabel, icon: UserIcon },
    { label: '填答期間', value: survey.answerWindowLabel, icon: CalendarDaysIcon },
    { label: '填寫次數', value: attemptLimitLabel, icon: ClipboardDocumentListIcon },
  ];

  if ((survey.submissionCount ?? 0) > 0) {
    infoItems.push({
      label: '已填寫',
      value: `${survey.submissionCount} / ${survey.maxAttempts} 次`,
      icon: InformationCircleIcon,
    });
  }

  const fromOpt = backHref ? { from: backHref } : undefined;

  const handleStart = () => {
    if (!canTake) return;
    router.push(buildStudentSurveyTakeUrl(survey.surveyCode, fromOpt));
  };

  const openAttempt = () => {
    if (!survey.canViewResponse) return;
    router.push(buildStudentSurveyReviewUrl(survey.surveyCode, fromOpt));
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <section className="bg-white border border-outline-variant/40 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-5 sm:py-6 border-b border-outline-variant/40 bg-gradient-to-br from-surface via-white to-primary/5">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${badge.className}`}>
              {badge.text}
            </span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-on-surface leading-snug">
            {survey.title}
          </h2>
          <p className="text-sm text-on-surfaceVariant mt-2">適用課程：{courseNames}</p>
          {survey.description ? (
            <p className="text-sm text-on-surfaceVariant mt-3 whitespace-pre-wrap">{survey.description}</p>
          ) : null}
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

          {!survey.accessible && survey.inaccessibleReason && (
            <div className="mt-4 flex gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <ExclamationTriangleIcon className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{survey.inaccessibleReason}</p>
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

      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h3 className="text-lg font-bold text-on-surface">填寫紀錄</h3>
            <p className="text-sm text-on-surfaceVariant mt-0.5">
              {attempts.length > 0
                ? `共 ${attempts.length} 次提交（上限 ${survey.maxAttempts} 次）`
                : '尚未有提交紀錄'}
            </p>
          </div>
        </div>

        <div className="bg-white border border-outline-variant/40 rounded-2xl shadow-sm overflow-hidden">
          {attempts.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-on-surfaceVariant">
              尚無填寫紀錄
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-surface border-b border-outline-variant/40 text-left text-xs font-semibold text-on-surfaceVariant uppercase tracking-wide">
                    <th className="px-4 sm:px-5 py-3 whitespace-nowrap">次數</th>
                    <th className="px-4 sm:px-5 py-3 whitespace-nowrap">提交時間</th>
                    <th className="px-4 sm:px-5 py-3 whitespace-nowrap">狀態</th>
                    <th className="px-4 sm:px-5 py-3 whitespace-nowrap text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {attempts.map((attempt) => (
                    <tr key={attempt.id} className="hover:bg-primary/5 transition-colors">
                      <td className="px-4 sm:px-5 py-3.5 font-medium text-on-surface whitespace-nowrap">
                        第 {attempt.attemptIndex} 次
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-on-surfaceVariant whitespace-nowrap">
                        {formatSurveyAttemptDateTime(attempt.submittedAt)}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-100">
                          已提交
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-right whitespace-nowrap">
                        {survey.canViewResponse ? (
                          <button
                            type="button"
                            onClick={openAttempt}
                            className="text-primary hover:text-primary font-medium"
                          >
                            查看
                          </button>
                        ) : (
                          <span className="text-on-surfaceVariant">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {attempts.length > 0 && !survey.canViewResponse && (
          <p className="text-xs text-on-surfaceVariant mt-2">教師尚未開放學生查看填寫內容。</p>
        )}
      </section>
    </div>
  );
}
