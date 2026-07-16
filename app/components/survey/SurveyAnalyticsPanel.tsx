'use client';

import React, { useEffect, useMemo, useState } from 'react';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import { TabNav } from '@/components/ui';
import type {
  Survey,
  SurveyAnswers,
  SurveyChoiceQuestion,
  SurveyMatrixQuestion,
  SurveyQuestion,
  SurveyScaleQuestion,
} from '@/services/surveyTypes';
import {
  SURVEY_OTHER_OPTION_ID,
  flattenSurveyQuestions,
  formatSurveyResponseMode,
  parseOtherAnswer,
} from '@/services/surveyTypes';
import type { SurveyAnalytics } from '@/services/surveyResponseService';

interface SurveyAnalyticsPanelProps {
  survey: Survey;
  teacherId: string;
}

type AnalyticsTab = 'stats' | 'individual';

export interface TeacherSurveyResponseRow {
  id: string;
  surveyId: string;
  responseMode: 'named' | 'anonymous';
  studentId?: string;
  studentName: string;
  studentNumber: string;
  attemptIndex: number;
  submittedAt: string;
  answers: SurveyAnswers;
  submitted: boolean;
}

const CONTROL_CLASS = 'size-4 accent-indigo-600 shrink-0';

function formatSubmittedAt(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function SurveyAnalyticsPanel({ survey, teacherId }: SurveyAnalyticsPanelProps) {
  const [tab, setTab] = useState<AnalyticsTab>('stats');
  const [statsLoading, setStatsLoading] = useState(true);
  const [responsesLoading, setResponsesLoading] = useState(true);
  const [analytics, setAnalytics] = useState<SurveyAnalytics | null>(null);
  const [responses, setResponses] = useState<TeacherSurveyResponseRow[]>([]);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [submittedStudentCount, setSubmittedStudentCount] = useState(0);
  const [notSubmittedStudentCount, setNotSubmittedStudentCount] = useState(0);
  const [totalResponses, setTotalResponses] = useState(0);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const questions = useMemo(
    () => flattenSurveyQuestions(survey.sections ?? []),
    [survey.sections]
  );

  const isAnonymous = survey.responseMode === 'anonymous';

  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    setError('');
    fetch('/api/surveys/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surveyId: survey.id, teacherId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '載入失敗');
        if (!cancelled) setAnalytics(data.analytics as SurveyAnalytics);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '載入失敗');
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [survey.id, teacherId]);

  useEffect(() => {
    let cancelled = false;
    setResponsesLoading(true);
    fetch('/api/surveys/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surveyId: survey.id, teacherId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '載入填答失敗');
        if (cancelled) return;
        const list = ((data.responses ?? []) as TeacherSurveyResponseRow[]).map((r) => ({
          ...r,
          submitted: r.submitted !== false && !!r.submittedAt,
        }));
        setResponses(list);
        setEnrolledCount(Number(data.enrolledCount) || 0);
        setSubmittedStudentCount(Number(data.submittedStudentCount) || 0);
        setNotSubmittedStudentCount(Number(data.notSubmittedStudentCount) || 0);
        setTotalResponses(Number(data.totalResponses) || list.filter((r) => r.submitted).length);
        setSelectedId((prev) => {
          if (prev && list.some((r) => r.id === prev)) return prev;
          const firstSubmitted = list.find((r) => r.submitted);
          return firstSubmitted?.id ?? list[0]?.id ?? null;
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '載入填答失敗');
      })
      .finally(() => {
        if (!cancelled) setResponsesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [survey.id, teacherId]);

  const selected = useMemo(
    () => responses.find((r) => r.id === selectedId) ?? responses[0] ?? null,
    [responses, selectedId]
  );

  const loading = statsLoading || responsesLoading;

  if (loading) {
    return (
      <div className="min-h-[280px] flex items-center justify-center">
        <PageLoadingArea />
      </div>
    );
  }

  if (error && !analytics) {
    return <p className="text-red-500 text-sm">{error}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2">
        <h3 className="text-lg font-bold text-gray-900">{survey.title}</h3>
        <p className="text-sm text-gray-500">
          {formatSurveyResponseMode(survey.responseMode)}
          {isAnonymous ? '（個別填答不顯示姓名與學號）' : ''}
        </p>
        <p className="text-sm text-gray-700">
          {enrolledCount > 0 ? (
            <>
              應填 <span className="font-semibold">{enrolledCount}</span> 人
              {' · '}
              已填 <span className="font-semibold text-emerald-700">{submittedStudentCount}</span> 人
              {' · '}
              未填 <span className="font-semibold text-amber-700">{notSubmittedStudentCount}</span> 人
              {totalResponses > submittedStudentCount ? (
                <span className="text-gray-400">（共 {totalResponses} 份回應）</span>
              ) : null}
            </>
          ) : (
            <>共 {totalResponses} 份回應</>
          )}
        </p>
      </div>

      <TabNav
        variant="segmented"
        size="compact"
        activeId={tab}
        onChange={(id) => setTab(id as AnalyticsTab)}
        items={[
          { id: 'stats', label: '統計分析' },
          { id: 'individual', label: '個別填答' },
        ]}
      />

      {tab === 'stats' && analytics && <StatsTab analytics={analytics} />}
      {tab === 'individual' && (
        <IndividualTab
          responses={responses}
          selected={selected}
          isAnonymous={isAnonymous}
          questions={questions}
          onSelect={setSelectedId}
        />
      )}
    </div>
  );
}

function StatsTab({ analytics }: { analytics: SurveyAnalytics }) {
  return (
    <div className="space-y-6">
      {analytics.questions.map((q, index) => (
        <div key={q.questionId} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <div>
            <p className="text-xs font-bold text-indigo-600">Q{index + 1}</p>
            <h4 className="font-semibold text-gray-900 mt-0.5 whitespace-pre-wrap">
              {q.content || '（未命名題目）'}
            </h4>
            <p className="text-xs text-gray-400 mt-1">有效回應 {q.responseCount}</p>
          </div>

          {q.optionStats && (
            <ul className="space-y-2">
              {q.optionStats.map((opt) => {
                const pct = q.responseCount
                  ? Math.round((opt.count / q.responseCount) * 100)
                  : 0;
                return (
                  <li key={opt.label} className="text-sm">
                    <div className="flex justify-between gap-2 mb-1">
                      <span className="text-gray-700 break-all">{opt.label}</span>
                      <span className="text-gray-500 shrink-0">
                        {opt.count}（{pct}%）
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {q.scaleAverage !== undefined && (
            <p className="text-sm text-gray-700">
              平均分：<span className="font-bold text-indigo-600">{q.scaleAverage}</span>
            </p>
          )}

          {q.scaleDistribution && (
            <div className="flex flex-wrap gap-2">
              {q.scaleDistribution.map((d) => (
                <span
                  key={d.label}
                  className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-50 text-sm text-gray-700 border border-gray-100"
                >
                  {d.label} 分：{d.count}
                </span>
              ))}
            </div>
          )}

          {q.matrixRows && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-3 font-medium">敘述</th>
                    <th className="py-2 pr-3 font-medium">平均</th>
                    <th className="py-2 font-medium">分布</th>
                  </tr>
                </thead>
                <tbody>
                  {q.matrixRows.map((row) => (
                    <tr key={row.rowId} className="border-b border-gray-50 align-top">
                      <td className="py-2 pr-3 text-gray-800">{row.label}</td>
                      <td className="py-2 pr-3 font-semibold text-indigo-600">{row.average}</td>
                      <td className="py-2 text-gray-500">
                        {row.distribution.map((d) => `${d.label}:${d.count}`).join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {q.textAnswers && q.textAnswers.length > 0 && (
            <ul className="space-y-2">
              {q.textAnswers.map((text, i) => (
                <li
                  key={i}
                  className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 whitespace-pre-wrap"
                >
                  {text}
                </li>
              ))}
            </ul>
          )}

          {q.textAnswers && q.textAnswers.length === 0 && q.type === 'short_answer' && (
            <p className="text-sm text-gray-400">尚無文字回應</p>
          )}
        </div>
      ))}

      {analytics.questions.length === 0 && (
        <p className="text-gray-500 text-center py-8">此問卷尚無題目</p>
      )}
    </div>
  );
}

function IndividualTab({
  responses,
  selected,
  isAnonymous,
  questions,
  onSelect,
}: {
  responses: TeacherSurveyResponseRow[];
  selected: TeacherSurveyResponseRow | null;
  isAnonymous: boolean;
  questions: SurveyQuestion[];
  onSelect: (id: string) => void;
}) {
  const submittedCount = responses.filter((r) => r.submitted).length;
  const pendingCount = responses.filter((r) => !r.submitted).length;

  if (responses.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
        <p className="text-gray-500">尚無學生名單或填答紀錄</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b text-sm font-semibold text-gray-700">
          {isAnonymous
            ? `填答清單（${submittedCount}）`
            : `填答清單（${responses.length} · 已填 ${submittedCount} · 未填 ${pendingCount}）`}
        </div>
        <ul className="divide-y divide-gray-100 max-h-[36rem] overflow-y-auto">
          {responses.map((row) => {
            const active = selected?.id === row.id;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onSelect(row.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors ${
                    active ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
                  } ${!row.submitted ? 'opacity-90' : ''}`}
                >
                  <p className="font-medium text-gray-800 text-sm">{row.studentName}</p>
                  {!isAnonymous && row.studentNumber && (
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">學號 {row.studentNumber}</p>
                  )}
                  {row.submitted ? (
                    <p className="text-xs text-gray-400 mt-0.5">{formatSubmittedAt(row.submittedAt)}</p>
                  ) : (
                    <p className="text-xs text-amber-700 mt-0.5 font-medium">未填寫</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {selected && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="font-bold text-gray-800">{selected.studentName}</h3>
            {!isAnonymous && selected.studentNumber && (
              <p className="text-sm text-gray-500 font-mono mt-0.5">學號 {selected.studentNumber}</p>
            )}
            {selected.submitted ? (
              <p className="text-sm text-gray-500 mt-1">
                送出時間 {formatSubmittedAt(selected.submittedAt)}
                {selected.attemptIndex > 1 ? ` · 第 ${selected.attemptIndex} 次` : ''}
              </p>
            ) : (
              <p className="text-sm text-amber-700 mt-1 font-medium">尚未填寫問卷</p>
            )}
          </div>

          {selected.submitted ? (
            <div className="space-y-3">
              {questions.map((q, index) => (
                <div
                  key={q.id}
                  className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3"
                >
                  <AnswerDisplay question={q} index={index} answers={selected.answers} />
                </div>
              ))}
              {questions.length === 0 && (
                <p className="text-gray-500 text-center py-8">此問卷尚無題目</p>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400 text-sm">
              此學生尚未送出問卷
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AnswerDisplay({
  question,
  index,
  answers,
}: {
  question: SurveyQuestion;
  index: number;
  answers: SurveyAnswers;
}) {
  const value = answers[question.id];

  return (
    <div className="space-y-3">
      <p className="font-medium text-gray-900 text-base leading-relaxed">
        <span className="text-indigo-600 mr-2 font-bold">Q{index + 1}</span>
        {question.content || '（未命名題目）'}
      </p>

      {question.type === 'single' && (
        <div className="space-y-2">
          {question.options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                disabled
                checked={value === opt}
                readOnly
                className={CONTROL_CLASS}
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {question.type === 'multiple' && (
        <MultipleAnswerDisplay
          question={question}
          value={Array.isArray(value) ? (value as string[]) : []}
        />
      )}

      {question.type === 'short_answer' && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap min-h-[3rem]">
          {typeof value === 'string' && value.trim() ? value : '—'}
        </div>
      )}

      {question.type === 'scale' && (
        <ScaleAnswerDisplay
          question={question}
          value={typeof value === 'number' ? value : undefined}
        />
      )}

      {question.type === 'matrix' && (
        <MatrixAnswerDisplay
          question={question}
          value={
            value && typeof value === 'object' && !Array.isArray(value)
              ? (value as Record<string, number>)
              : {}
          }
        />
      )}
    </div>
  );
}

function MultipleAnswerDisplay({
  question,
  value,
}: {
  question: SurveyChoiceQuestion;
  value: string[];
}) {
  const selected = new Set<string>();
  let otherText = '';
  for (const item of value) {
    const parsed = parseOtherAnswer(String(item));
    if (parsed.isOther) {
      selected.add(SURVEY_OTHER_OPTION_ID);
      otherText = parsed.text;
    } else {
      selected.add(item);
    }
  }

  return (
    <div className="space-y-2">
      {question.options.map((opt) => (
        <label key={opt} className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            disabled
            checked={selected.has(opt)}
            readOnly
            className={`${CONTROL_CLASS} rounded`}
          />
          {opt}
        </label>
      ))}
      {question.allowOther && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              disabled
              checked={selected.has(SURVEY_OTHER_OPTION_ID)}
              readOnly
              className={`${CONTROL_CLASS} rounded`}
            />
            其他
          </label>
          {selected.has(SURVEY_OTHER_OPTION_ID) && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800">
              {otherText.trim() || '—'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScaleAnswerDisplay({
  question,
  value,
}: {
  question: SurveyScaleQuestion;
  value?: number;
}) {
  const scores = Array.from({ length: question.maxScore }, (_, i) => i + 1);
  return (
    <div className="flex w-full items-center gap-2 sm:gap-3">
      <span className="shrink-0 text-xs text-gray-500 text-right min-w-[2rem]">
        {question.minLabel || '低'}
      </span>
      <div className="flex min-w-0 flex-1 items-end">
        {scores.map((score) => (
          <label
            key={score}
            className="flex flex-1 flex-col items-center gap-1 text-sm text-gray-700"
          >
            <span className="text-xs text-gray-500">{score}</span>
            <input
              type="radio"
              disabled
              checked={value === score}
              readOnly
              className={CONTROL_CLASS}
            />
          </label>
        ))}
      </div>
      <span className="shrink-0 text-xs text-gray-500 text-left min-w-[2rem]">
        {question.maxLabel || '高'}
      </span>
    </div>
  );
}

function MatrixAnswerDisplay({
  question,
  value,
}: {
  question: SurveyMatrixQuestion;
  value: Record<string, number>;
}) {
  const scores = Array.from({ length: question.maxScore }, (_, i) => i + 1);
  const rows = question.rows.filter((r) => r.label.trim());

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left py-2 pr-3 font-medium text-gray-500">問題</th>
            {scores.map((s) => (
              <th key={s} className="px-1 py-2 text-center font-medium text-gray-500 w-10">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-gray-100">
              <td className="py-2.5 pr-3 text-gray-800">{row.label}</td>
              {scores.map((score) => (
                <td key={score} className="px-1 py-2 text-center">
                  <input
                    type="radio"
                    disabled
                    checked={value[row.id] === score}
                    readOnly
                    className={CONTROL_CLASS}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
