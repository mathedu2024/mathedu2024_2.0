'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import type { Quiz } from '@/services/quizTypes';
import { QUESTION_TYPE_LABELS } from '@/services/quizTypes';
import type { QuizAnalytics } from '@/services/quizSubmissionTypes';
import { FIVE_MARK_LABELS } from '@/services/fiveMarkStats';
import { fetchQuizAnalytics } from '@/utils/teacherClientApi';
import QuizCourseScopeBar from './QuizCourseScopeBar';

interface QuizAnalyticsPanelProps {
  quiz: Quiz;
  teacherId: string;
  onBack?: () => void;
}

export default function QuizAnalyticsPanel({ quiz, teacherId }: QuizAnalyticsPanelProps) {
  const [analytics, setAnalytics] = useState<QuizAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [courseScope, setCourseScope] = useState('all');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchQuizAnalytics(quiz.id, teacherId, courseScope);
      setAnalytics(data);
      if (data?.activeCourseScope && data.activeCourseScope !== courseScope) {
        setCourseScope(data.activeCourseScope);
      }
    } finally {
      setLoading(false);
    }
  }, [quiz.id, teacherId, courseScope]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const maxBucket = Math.max(...(analytics?.scoreDistribution.map((b) => b.count) ?? [1]), 1);
  const hasSubmissions = (analytics?.submissionCount ?? 0) > 0;
  const hasRoster = (analytics?.enrolledCount ?? 0) > 0;

  return (
    <div className="space-y-4">
      {loading ? (
        <PageLoadingArea />
      ) : !analytics ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <p className="text-gray-500">無法載入分析資料</p>
        </div>
      ) : !hasRoster ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <p className="text-gray-500 mb-1">尚無課程學生名單</p>
          <p className="text-sm text-gray-400">請在測驗設定中指定適用班級，並確認課程已有學生。</p>
        </div>
      ) : (
        <>
          {analytics.courseScopes && analytics.courseScopes.length > 1 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <QuizCourseScopeBar
                scopes={analytics.courseScopes}
                value={courseScope}
                onChange={setCourseScope}
              />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">繳交狀況</p>
              <p className="text-lg font-bold text-gray-800">
                應繳 {analytics.enrolledCount} 人 / 已繳 {analytics.submittedStudentCount} 人 / 未繳{' '}
                {analytics.notSubmittedStudentCount} 人
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500">繳交次數</p>
                <p className="text-xl font-bold text-gray-800 mt-1">
                  {analytics.submissionCount}
                  <span className="text-sm font-normal text-gray-500">次</span>
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500">繳交率</p>
                <p className="text-xl font-bold text-gray-800 mt-1">
                  {analytics.enrolledCount > 0
                    ? Math.round((analytics.submittedStudentCount / analytics.enrolledCount) * 100)
                    : 0}
                  <span className="text-sm font-normal text-gray-500">%</span>
                </p>
              </div>
            </div>
          </div>

          {!hasSubmissions ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
              <p className="text-gray-500">尚無學生繳交，成績分布與各題分析將在有人作答後顯示。</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                {[
                  { label: '平均成績', value: analytics.averageScore, suffix: ` / ${analytics.maxScore}` },
                  { label: '及格率 (60%)', value: analytics.passRate, suffix: '%' },
                  { label: '最高分', value: analytics.highestScore, suffix: '' },
                  { label: '最低分', value: analytics.lowestScore, suffix: '' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-2.5 sm:p-4 min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-500 leading-tight">{stat.label}</p>
                    <p className="text-base sm:text-xl font-bold text-gray-800 mt-1 tabular-nums">
                      {stat.value}
                      <span className="text-[10px] sm:text-sm font-normal text-gray-500">{stat.suffix}</span>
                    </p>
                  </div>
                ))}
              </div>

              {analytics.fiveMarkStats && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center">
                    <ChartBarIcon className="w-5 h-5 mr-2 text-primary" />
                    五標與平均
                  </h3>
                  <div className="overflow-hidden rounded-xl border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                      <tbody className="divide-y divide-gray-50">
                        {FIVE_MARK_LABELS.map((label) => (
                          <tr key={label}>
                            <td className="px-4 py-2.5 text-gray-700">{label}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-gray-900">
                              {analytics.fiveMarkStats?.[label as keyof typeof analytics.fiveMarkStats] ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-4">成績分布</h3>
                <div className="flex items-end gap-3 h-40">
                  {analytics.scoreDistribution.map((bucket) => (
                    <div key={bucket.range} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-600 font-medium">{bucket.count}</span>
                      <div
                        className="w-full bg-primary rounded-t-md transition-all min-h-[4px]"
                        style={{ height: `${(bucket.count / maxBucket) * 100}%` }}
                      />
                      <span className="text-[10px] text-gray-500 text-center">{bucket.range}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b bg-gray-50">
                  <h3 className="text-sm font-bold text-gray-800">各題作答分析</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="px-4 py-3 font-semibold">題號</th>
                        <th className="px-4 py-3 font-semibold">題型</th>
                        <th className="px-4 py-3 font-semibold">配分</th>
                        <th className="px-4 py-3 font-semibold">平均得分</th>
                        <th className="px-4 py-3 font-semibold">答對率</th>
                        <th className="px-4 py-3 font-semibold">作答人數</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.questionStats.map((q) => (
                        <tr key={q.questionId} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-medium text-gray-800">第 {q.questionNumber} 題</td>
                          <td className="px-4 py-3 text-gray-600">
                            {QUESTION_TYPE_LABELS[q.questionType as keyof typeof QUESTION_TYPE_LABELS] ?? q.questionType}
                          </td>
                          <td className="px-4 py-3">{q.maxScore}</td>
                          <td className="px-4 py-3">{q.averageScore}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full max-w-[6rem]">
                                <div
                                  className="h-2 bg-emerald-500 rounded-full"
                                  style={{ width: `${q.correctRate}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600">{q.correctRate}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{q.attemptCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
