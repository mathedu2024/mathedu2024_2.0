'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from '@/utils/swalTheme';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import type {
  Survey,
  SurveyAnswerValue,
  SurveyAnswers,
  SurveyChoiceQuestion,
  SurveyMatrixQuestion,
  SurveyQuestion,
  SurveyScaleQuestion,
} from '@/services/surveyTypes';
import {
  SURVEY_OTHER_OPTION_ID,
  encodeOtherAnswer,
  parseOtherAnswer,
  formatSurveyResponseMode,
  formatSurveyAnswerWindow,
  ensureSurveySections,
} from '@/services/surveyTypes';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { getSession } from '@/utils/session';
import {
  clearSurveyDraft,
  loadSurveyDraft,
  saveSurveyDraft,
} from '@/utils/surveyDraftStorage';

const CONTROL_CLASS = 'size-4 accent-indigo-600 shrink-0';

interface SurveyTakeViewProps {
  surveyCode: string;
  backHref?: string;
  /** 查看自己已送出的填答 */
  reviewMode?: boolean;
  /** 老師端預覽：直接帶入問卷，不打學生 API、不真正送出 */
  previewSurvey?: Survey;
  onExitPreview?: () => void;
}

function hydrateAnswersFromSubmission(
  questions: SurveyQuestion[],
  rawAnswers: SurveyAnswers
): { answers: SurveyAnswers; otherTexts: Record<string, string> } {
  const answers: SurveyAnswers = { ...rawAnswers };
  const otherTexts: Record<string, string> = {};

  for (const q of questions) {
    if (q.type !== 'multiple' || !q.allowOther) continue;
    const selected = Array.isArray(answers[q.id]) ? ([...(answers[q.id] as string[])] as string[]) : [];
    const next: string[] = [];
    for (const item of selected) {
      const parsed = parseOtherAnswer(String(item));
      if (parsed.isOther) {
        next.push(SURVEY_OTHER_OPTION_ID);
        otherTexts[q.id] = parsed.text;
      } else {
        next.push(item);
      }
    }
    answers[q.id] = next;
  }

  return { answers, otherTexts };
}

export default function SurveyTakeView({
  surveyCode,
  backHref = '/student/courses',
  reviewMode = false,
  previewSurvey,
  onExitPreview,
}: SurveyTakeViewProps) {
  const router = useRouter();
  const isPreview = !!previewSurvey;
  const studentId = getSession()?.id ?? '';
  const [loading, setLoading] = useState(!isPreview);
  const [submitting, setSubmitting] = useState(false);
  const [survey, setSurvey] = useState<Survey | null>(() =>
    previewSurvey ? ensureSurveySections(previewSurvey) : null
  );
  const [canSubmit, setCanSubmit] = useState(isPreview && !reviewMode);
  const [readOnly, setReadOnly] = useState(reviewMode);
  const [accessReason, setAccessReason] = useState('');
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const answersRef = useRef(answers);
  const otherTextsRef = useRef(otherTexts);
  answersRef.current = answers;
  otherTextsRef.current = otherTexts;

  useEffect(() => {
    if (isPreview) {
      setSurvey(ensureSurveySections(previewSurvey));
      setCanSubmit(true);
      setReadOnly(false);
      setLoading(false);
      setDone(false);
      setAccessReason('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch('/api/student/surveys/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surveyCode, review: reviewMode }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '載入失敗');
        if (cancelled) return;
        const loaded = ensureSurveySections(data.survey as Survey);
        setSurvey(loaded);
        const qs = loaded.sections.flatMap((s) => s.questions);

        if (reviewMode || data.readOnly) {
          setReadOnly(true);
          setCanSubmit(false);
          setDone(true);
          const raw = (data.latestResponse?.answers ?? {}) as SurveyAnswers;
          const hydrated = hydrateAnswersFromSubmission(qs, raw);
          setAnswers(hydrated.answers);
          setOtherTexts(hydrated.otherTexts);
        } else {
          setReadOnly(false);
          setCanSubmit(!!data.canSubmit);
          setAccessReason(data.access?.reason ?? '');
          if (data.submissionCount > 0 && !data.canSubmit) {
            setDone(true);
          }
          if (data.canSubmit && studentId) {
            const draft = loadSurveyDraft(surveyCode, studentId);
            if (draft) {
              setAnswers(draft.answers);
              setOtherTexts(draft.otherTexts);
            }
          }
        }
      })
      .catch(async (err) => {
        if (cancelled) return;
        await Swal.fire({
          icon: 'error',
          title: err instanceof Error ? err.message : '載入失敗',
          confirmButtonColor: '#4f46e5',
        });
        router.push(backHref);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [surveyCode, router, backHref, isPreview, previewSurvey, reviewMode, studentId]);

  const persistDraft = useCallback(() => {
    if (isPreview || readOnly || !canSubmit || !studentId || !surveyCode) return;
    saveSurveyDraft(surveyCode, studentId, {
      answers: answersRef.current,
      otherTexts: otherTextsRef.current,
    });
  }, [isPreview, readOnly, canSubmit, studentId, surveyCode]);

  useEffect(() => {
    if (isPreview || readOnly || !canSubmit || !studentId) return;
    const timer = window.setTimeout(() => persistDraft(), 400);
    return () => window.clearTimeout(timer);
  }, [answers, otherTexts, persistDraft, isPreview, readOnly, canSubmit, studentId]);

  useEffect(() => {
    if (isPreview || readOnly || !canSubmit || !studentId) return;
    const onLeave = () => persistDraft();
    window.addEventListener('pagehide', onLeave);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      window.removeEventListener('beforeunload', onLeave);
      persistDraft();
    };
  }, [persistDraft, isPreview, readOnly, canSubmit, studentId]);

  const questions = useMemo(
    () => survey?.sections.flatMap((s) => s.questions) ?? [],
    [survey]
  );

  const setAnswer = (questionId: string, value: SurveyAnswerValue) => {
    if (readOnly) return;
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const buildSubmitAnswers = (): SurveyAnswers => {
    const result: SurveyAnswers = { ...answers };
    for (const q of questions) {
      if (q.type !== 'multiple' || !q.allowOther) continue;
      const selected = Array.isArray(result[q.id]) ? ([...(result[q.id] as string[])] as string[]) : [];
      const idx = selected.indexOf(SURVEY_OTHER_OPTION_ID);
      if (idx >= 0) {
        const text = (otherTexts[q.id] ?? '').trim();
        selected[idx] = encodeOtherAnswer(text);
        result[q.id] = selected;
      }
    }
    return result;
  };

  const handleSubmit = async () => {
    if (!survey || !canSubmit || readOnly) return;

    if (isPreview) {
      await Swal.fire({
        icon: 'info',
        title: '這是學生版預覽',
        text: '預覽模式不會真正送出問卷。',
        confirmButtonColor: '#4f46e5',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/student/surveys/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyCode: survey.surveyCode,
          answers: buildSubmitAnswers(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '提交失敗');
      if (studentId) clearSurveyDraft(surveyCode, studentId);
      setDone(true);
      setCanSubmit(false);
      setReadOnly(true);
      const result = await Swal.fire({
        icon: 'success',
        title: '已送出問卷',
        confirmButtonColor: '#4f46e5',
        confirmButtonText: '關閉視窗',
      });
      if (result.isConfirmed) {
        window.close();
        router.push(backHref);
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: error instanceof Error ? error.message : '提交失敗',
        confirmButtonColor: '#4f46e5',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExit = () => {
    if (isPreview) {
      onExitPreview?.();
      return;
    }
    persistDraft();
    window.close();
    router.push(backHref);
  };

  if (loading) {
    return (
      <div className="page-shell w-full min-w-0 py-4 sm:py-6 md:py-8">
        <div className="mx-auto max-w-3xl">
          <PageLoadingArea minHeight="min-h-[40vh]" />
        </div>
      </div>
    );
  }

  if (!survey) return null;

  const answeredCount = questions.filter((q) => {
    const v = answers[q.id];
    if (v === undefined || v === null || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }).length;

  const showCloseButton = isPreview || readOnly || done || !canSubmit;
  const showQuestions = (canSubmit || readOnly) && questions.length > 0;

  return (
    <div className="page-shell w-full min-w-0 py-4 sm:py-6 md:py-8">
      <div className="mx-auto max-w-3xl w-full">
        {isPreview && (
          <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
            <strong>學生版預覽</strong>
            ：畫面與學生填寫相同，但不會寫入或送出答案。
          </div>
        )}

        <div className="border-l-4 border-indigo-500 pl-4 mb-0">
          <h1 className="text-2xl font-bold text-gray-800">{survey.title}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isPreview
              ? `預覽填寫 ${answeredCount} / ${questions.length} 題`
              : readOnly || done
                ? '查看填寫內容'
                : canSubmit
                  ? `已填 ${answeredCount} / ${questions.length} 題`
                  : accessReason || '無法填寫'}
            {' · '}
            {formatSurveyResponseMode(survey.responseMode)}
            {' · '}
            {formatSurveyAnswerWindow(survey)}
          </p>
        </div>

        {showCloseButton && (
          <div className="mt-4 mb-2">
            <button
              type="button"
              onClick={handleExit}
              className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
            >
              {isPreview ? '關閉預覽' : '關閉視窗'}
            </button>
          </div>
        )}

        <div className="mt-6 space-y-6">
          {survey.description ? (
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap">
              {survey.description}
            </div>
          ) : null}

          {done && !readOnly && (
            <div className="bg-white rounded-2xl border border-emerald-200 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-2">已送出</h2>
              <p className="text-sm text-gray-600">感謝您完成本問卷。</p>
            </div>
          )}

          {readOnly && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm text-emerald-800">
              這是您已送出的填答內容（唯讀）。
            </div>
          )}

          {!canSubmit && !done && !readOnly && accessReason && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
              {accessReason}
            </div>
          )}

          {showQuestions &&
            questions.map((q, qi) => (
              <div
                key={q.id}
                id={`survey-q-${q.id}`}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6"
              >
                <QuestionField
                  question={q}
                  index={qi}
                  disabled={submitting || readOnly}
                  value={answers[q.id]}
                  otherText={otherTexts[q.id] ?? ''}
                  onChange={(v) => setAnswer(q.id, v)}
                  onOtherTextChange={(text) =>
                    setOtherTexts((prev) => ({ ...prev, [q.id]: text }))
                  }
                />
              </div>
            ))}

          {canSubmit && !readOnly && (
            <div className="flex justify-center pb-6">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmit()}
                className="inline-flex items-center px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-md"
              >
                <PaperAirplaneIcon className="w-5 h-5 mr-2" />
                {submitting ? '送出中…' : isPreview ? '模擬送出（不會送出）' : '送出問卷'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionField({
  question,
  index,
  disabled,
  value,
  otherText,
  onChange,
  onOtherTextChange,
}: {
  question: SurveyQuestion;
  index: number;
  disabled: boolean;
  value: SurveyAnswerValue | undefined;
  otherText: string;
  onChange: (v: SurveyAnswerValue) => void;
  onOtherTextChange: (text: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="font-medium text-gray-900 text-base leading-relaxed">
        <span className="text-indigo-600 mr-2 font-bold">Q{index + 1}</span>
        {question.content || '（未命名題目）'}
        {question.required !== false && <span className="text-red-500 ml-1">*</span>}
      </p>

      {question.type === 'single' && (
        <div className="space-y-2">
          {question.options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name={question.id}
                disabled={disabled}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className={CONTROL_CLASS}
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {question.type === 'multiple' && (
        <MultipleField
          question={question}
          disabled={disabled}
          value={Array.isArray(value) ? (value as string[]) : []}
          otherText={otherText}
          onChange={onChange}
          onOtherTextChange={onOtherTextChange}
        />
      )}

      {question.type === 'short_answer' && (
        <textarea
          disabled={disabled}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
          placeholder="請輸入回答"
        />
      )}

      {question.type === 'scale' && (
        <ScaleField
          question={question}
          disabled={disabled}
          value={typeof value === 'number' ? value : undefined}
          onChange={onChange}
        />
      )}

      {question.type === 'matrix' && (
        <MatrixField
          question={question}
          disabled={disabled}
          value={
            value && typeof value === 'object' && !Array.isArray(value)
              ? (value as Record<string, number>)
              : {}
          }
          onChange={onChange}
        />
      )}
    </div>
  );
}

function MultipleField({
  question,
  disabled,
  value,
  otherText,
  onChange,
  onOtherTextChange,
}: {
  question: SurveyChoiceQuestion;
  disabled: boolean;
  value: string[];
  otherText: string;
  onChange: (v: SurveyAnswerValue) => void;
  onOtherTextChange: (text: string) => void;
}) {
  const toggle = (opt: string) => {
    const set = new Set(value);
    if (set.has(opt)) set.delete(opt);
    else set.add(opt);
    onChange(Array.from(set));
  };

  const otherChecked = value.includes(SURVEY_OTHER_OPTION_ID);

  return (
    <div className="space-y-2">
      {question.options.map((opt) => (
        <label key={opt} className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            disabled={disabled}
            checked={value.includes(opt)}
            onChange={() => toggle(opt)}
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
              disabled={disabled}
              checked={otherChecked}
              onChange={() => toggle(SURVEY_OTHER_OPTION_ID)}
              className={`${CONTROL_CLASS} rounded`}
            />
            其他
          </label>
          {otherChecked && (
            <input
              type="text"
              disabled={disabled}
              value={otherText}
              onChange={(e) => onOtherTextChange(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
              placeholder="請說明"
            />
          )}
        </div>
      )}
    </div>
  );
}

function ScaleField({
  question,
  disabled,
  value,
  onChange,
}: {
  question: SurveyScaleQuestion;
  disabled: boolean;
  value?: number;
  onChange: (v: SurveyAnswerValue) => void;
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
              name={question.id}
              disabled={disabled}
              checked={value === score}
              onChange={() => onChange(score)}
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

function MatrixField({
  question,
  disabled,
  value,
  onChange,
}: {
  question: SurveyMatrixQuestion;
  disabled: boolean;
  value: Record<string, number>;
  onChange: (v: SurveyAnswerValue) => void;
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
                    name={`${question.id}-${row.id}`}
                    disabled={disabled}
                    checked={value[row.id] === score}
                    onChange={() => onChange({ ...value, [row.id]: score })}
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
