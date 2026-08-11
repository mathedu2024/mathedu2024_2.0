'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import Swal from '@/utils/swalTheme';
import RichHtmlContent from '@/components/RichHtmlContent';
import FillInQuestionContent from '@/components/quiz/FillInQuestionContent';
import type { OptionLabelStyle, Question, Quiz, SubQuestion } from '@/services/quizTypes';
import {
  QUESTION_TYPE_LABELS,
  GRID_CELL_ANSWER_LABELS,
  buildQuizQuestionNumberList,
  formatOptionLabel,
  isChoiceQuestion,
  isContinuousQuestionNumbers,
  isFillInQuestion,
  isShortAnswerQuestion,
  isTrueFalseQuestion,
} from '@/services/quizTypes';
import type { QuestionAnswerRecord } from '@/services/quizSubmissionTypes';
import { readFillInCellAnswer } from '@/services/quizSubmissionTypes';
import type { QuizGradingOverview } from '@/services/quizSubmissionService';
import { buildGradingStudentRows, type GradingStudentRow } from '@/utils/gradingStudentRows';
import { formatDateTimeZhTw } from '@/utils/dateTimeFormat';
import { choiceListIncludes, isChoiceOptionEqual } from '@/utils/quizChoiceMatch';
import { fetchQuizGradingOverview } from '@/utils/teacherClientApi';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import QuizCourseScopeBar from './QuizCourseScopeBar';

interface QuizGradingPanelProps {
  quiz: Quiz;
  teacherId: string;
  viewerRole?: '管理員' | '老師' | '學生';
  onBack?: () => void;
}

export default function QuizGradingPanel({
  quiz,
  teacherId,
  viewerRole,
}: QuizGradingPanelProps) {
  const [overview, setOverview] = useState<QuizGradingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [courseScope, setCourseScope] = useState('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [draftGrades, setDraftGrades] = useState<Record<string, { score: number; comment: string }>>({});
  const [saving, setSaving] = useState(false);

  const numbered = React.useMemo(
    () => buildQuizQuestionNumberList(quiz.sections, isContinuousQuestionNumbers(quiz)),
    [quiz]
  );

  const studentRows = useMemo(
    () =>
      overview
        ? buildGradingStudentRows(overview.roster, overview.submissions, quiz)
        : [],
    [overview, quiz]
  );

  const selectedRow =
    studentRows.find((row) => row.studentId === selectedStudentId) ?? studentRows[0] ?? null;

  const selectedSubmission = useMemo(() => {
    if (!selectedRow?.submitted) return null;
    if (selectedSubmissionId) {
      return (
        selectedRow.allSubmissions.find((sub) => sub.id === selectedSubmissionId) ??
        selectedRow.primarySubmission
      );
    }
    return selectedRow.primarySubmission;
  }, [selectedRow, selectedSubmissionId]);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const nextOverview = await fetchQuizGradingOverview(quiz.id, teacherId, courseScope);
      setOverview(nextOverview);
      if (nextOverview?.activeCourseScope && nextOverview.activeCourseScope !== courseScope) {
        setCourseScope(nextOverview.activeCourseScope);
      }
      const rows = nextOverview
        ? buildGradingStudentRows(nextOverview.roster, nextOverview.submissions, quiz)
        : [];
      const firstSubmitted = rows.find((row) => row.submitted) ?? rows[0] ?? null;
      setSelectedStudentId((prevStudentId) => {
        const studentId =
          prevStudentId && rows.some((row) => row.studentId === prevStudentId)
            ? prevStudentId
            : firstSubmitted?.studentId ?? null;

        setSelectedSubmissionId((prevSubmissionId) => {
          const row = rows.find((item) => item.studentId === studentId);
          if (!row?.submitted) return null;
          if (
            prevSubmissionId &&
            row.allSubmissions.some((sub) => sub.id === prevSubmissionId)
          ) {
            return prevSubmissionId;
          }
          return row.primarySubmission?.id ?? null;
        });

        return studentId;
      });
    } finally {
      setLoading(false);
    }
  }, [quiz, teacherId, courseScope]);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (!selectedSubmission) {
      setDraftGrades({});
      return;
    }
    const draft: Record<string, { score: number; comment: string }> = {};
    for (const a of selectedSubmission.answers) {
      if (a.gradingStatus === 'pending' || a.questionType === 'short_answer') {
        draft[a.questionId] = { score: a.score, comment: a.teacherComment ?? '' };
      }
    }
    setDraftGrades(draft);
  }, [selectedSubmission]);

  const handleSelectStudent = (row: GradingStudentRow) => {
    setSelectedStudentId(row.studentId);
    setSelectedSubmissionId(row.primarySubmission?.id ?? null);
  };

  const saveGrades = async () => {
    if (!selectedSubmission) return;
    const updates = Object.entries(draftGrades).map(([questionId, g]) => ({
      questionId,
      score: g.score,
      teacherComment: g.comment,
    }));
    if (updates.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch('/api/quiz-submissions/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: selectedSubmission.id, teacherId, updates }),
      });
      if (!res.ok) throw new Error('儲存失敗');
      const data = await res.json();
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              submissions: prev.submissions.map((sub) =>
                sub.id === data.submission.id ? data.submission : sub
              ),
            }
          : prev
      );
      Swal.fire({ icon: 'success', title: '批改已儲存', confirmButtonColor: '#4f46e5' });
    } catch {
      Swal.fire({ icon: 'error', title: '儲存失敗', confirmButtonColor: '#4f46e5' });
    } finally {
      setSaving(false);
    }
  };

  const renderAnswer = (answer: QuestionAnswerRecord) => {
    const qMeta = numbered.find((n) => n.id === answer.questionId);
    const isShort = answer.questionType === 'short_answer';
    const needsGrade = answer.gradingStatus === 'pending' || isShort;

    return (
      <div
        key={answer.questionId}
        className={`rounded-xl border p-4 ${
          needsGrade ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <span className="text-sm font-bold text-gray-800">第 {answer.questionNumber} 題</span>
            <span className="ml-2 text-xs text-gray-500">
              {QUESTION_TYPE_LABELS[answer.questionType as keyof typeof QUESTION_TYPE_LABELS]}
            </span>
          </div>
          <div className="text-sm">
            <span className={answer.isCorrect ? 'text-emerald-600 font-semibold' : 'text-gray-600'}>
              {answer.score} / {answer.maxScore} 分
            </span>
            {answer.gradingStatus === 'auto' && (
              <span className="ml-2 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">自動批改</span>
            )}
            {answer.gradingStatus === 'manual' && (
              <span className="ml-2 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">手動批改</span>
            )}
            {answer.gradingStatus === 'pending' && (
              <span className="ml-2 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">待批改</span>
            )}
          </div>
        </div>

        {qMeta && !isHtmlEmpty(qMeta.question.content) && (
          <div className="text-sm text-gray-600 mb-3 pb-3 border-b border-gray-100">
            {isFillInQuestion(qMeta.question) ? (
              <FillInQuestionContent
                html={qMeta.question.content}
                questionNumber={answer.questionNumber}
              />
            ) : (
              <RichHtmlContent html={qMeta.question.content} />
            )}
          </div>
        )}

        {isShort &&
          qMeta &&
          isShortAnswerQuestion(qMeta.question) &&
          qMeta.question.referenceAnswer?.trim() && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-emerald-700 mb-1">參考答案</p>
              <div className="bg-emerald-50 rounded-lg border border-emerald-100 p-3 text-sm text-gray-800 whitespace-pre-wrap">
                {qMeta.question.referenceAnswer}
              </div>
            </div>
          )}

        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 mb-1">學生作答</p>
          <StudentAnswerDisplay
            answer={answer}
            question={qMeta?.question}
            optionLabelStyle={quiz.optionLabelStyle}
          />
        </div>

        {needsGrade && (
          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3 pt-3 border-t border-amber-200">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">給分</label>
              <input
                type="number"
                min={0}
                max={answer.maxScore}
                value={draftGrades[answer.questionId]?.score ?? answer.score}
                onChange={(e) =>
                  setDraftGrades((prev) => ({
                    ...prev,
                    [answer.questionId]: {
                      score: Math.min(answer.maxScore, Math.max(0, Number(e.target.value) || 0)),
                      comment: prev[answer.questionId]?.comment ?? '',
                    },
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">評語（選填）</label>
              <input
                type="text"
                value={draftGrades[answer.questionId]?.comment ?? ''}
                onChange={(e) =>
                  setDraftGrades((prev) => ({
                    ...prev,
                    [answer.questionId]: {
                      score: prev[answer.questionId]?.score ?? answer.score,
                      comment: e.target.value,
                    },
                  }))
                }
                placeholder="寫下批改建議..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
        )}

        {answer.teacherComment && !needsGrade && (
          <p className="text-xs text-gray-500 mt-2">評語：{answer.teacherComment}</p>
        )}
      </div>
    );
  };

  const studentCount = overview?.enrolledCount ?? studentRows.length;
  const submittedCount = overview?.submittedStudentCount ?? studentRows.filter((row) => row.submitted).length;
  const notSubmittedCount =
    overview?.notSubmittedStudentCount ?? studentRows.filter((row) => !row.submitted).length;

  const showCreatorMeta =
    !!overview?.quizCreatorName &&
    (viewerRole === '管理員' || overview.isCreator === false);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <h2 className="text-lg font-bold text-gray-800">{quiz.title} — 測驗批改</h2>
        {showCreatorMeta && (
          <p className="text-sm text-gray-600">
            測驗建立者：<span className="font-medium text-gray-800">{overview?.quizCreatorName}</span>
          </p>
        )}
        <p className="text-sm text-gray-500">
          客觀題以綠色／紅色與右側勾叉標示對錯；簡答題與待批改題目以黃色標示，可手動給分與評語。
          {overview && overview.enrolledCount > 0 && (
            <span className="ml-2">
              應繳 {overview.enrolledCount} 人 · 已繳 {overview.submittedStudentCount} 人 · 未繳{' '}
              {overview.notSubmittedStudentCount} 人
            </span>
          )}
        </p>
        {overview?.courseScopes && overview.courseScopes.length > 1 && (
          <QuizCourseScopeBar
            scopes={overview.courseScopes}
            value={courseScope}
            onChange={setCourseScope}
            label="檢視範圍"
          />
        )}
      </div>

      {loading ? (
        <PageLoadingArea />
      ) : studentRows.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <p className="text-gray-500">尚無學生名單或繳交紀錄</p>
          <p className="text-sm text-gray-400 mt-1">請確認測驗已指定適用班級，或等待學生繳交。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b text-sm font-semibold text-gray-700">
              繳交清單（{studentCount} 人 · 已繳 {submittedCount} · 未繳 {notSubmittedCount}）
            </div>
            <ul className="divide-y divide-gray-100 max-h-[32rem] overflow-y-auto">
              {studentRows.map((row) => (
                <li key={row.studentId}>
                  <button
                    type="button"
                    onClick={() => handleSelectStudent(row)}
                    className={`w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors ${
                      selectedRow?.studentId === row.studentId
                        ? 'bg-indigo-50 border-l-4 border-indigo-500'
                        : ''
                    } ${!row.submitted ? 'opacity-90' : ''}`}
                  >
                    <p className="font-medium text-gray-800 text-sm">{row.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 font-mono"> {row.studentNumber}</p>
                    {row.submitted && row.primarySubmission ? (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {row.primarySubmission.totalScore} / {row.primarySubmission.maxScore} 分 ·{' '}
                        {row.primarySubmission.status === 'graded'
                          ? '已批改'
                          : row.primarySubmission.status === 'grading'
                            ? '批改中'
                            : '已繳交'}
                        {row.allSubmissions.length > 1 ? ` · ${row.allSubmissions.length} 次作答` : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700 mt-0.5 font-medium">未繳交</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {selectedRow && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-800">{selectedRow.name}</h3>
                  <p className="text-sm text-gray-500 font-mono">學號 {selectedRow.studentNumber}</p>
                  {selectedSubmission ? (
                    <>
                      <p className="text-sm text-gray-500 mt-1">
                        總分 {selectedSubmission.totalScore} / {selectedSubmission.maxScore}
                      </p>
                      {selectedSubmission.gradedByTeacherName && (
                        <p className="text-sm text-indigo-600 mt-1">
                          批改老師：{selectedSubmission.gradedByTeacherName}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-amber-700 mt-1 font-medium">尚未繳交測驗</p>
                  )}
                </div>
                {selectedSubmission && (
                  <button
                    onClick={() => void saveGrades()}
                    disabled={saving || Object.keys(draftGrades).length === 0}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <CheckCircleIcon className="w-4 h-4 mr-1.5" />
                    儲存批改
                  </button>
                )}
              </div>

              {selectedRow.submitted && selectedRow.allSubmissions.length > 1 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">作答紀錄</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedRow.allSubmissions.map((sub) => {
                      const attemptLabel = sub.attemptIndex
                        ? `第 ${sub.attemptIndex} 次`
                        : formatDateTimeZhTw(sub.submittedAt, {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          });
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setSelectedSubmissionId(sub.id)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                            selectedSubmission?.id === sub.id
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {attemptLabel}（{sub.totalScore} 分）
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedSubmission ? (
                <div className="space-y-3">
                  {selectedSubmission.answers
                    .sort((a, b) => a.questionNumber - b.questionNumber)
                    .map(renderAnswer)}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 text-sm text-amber-800">
                  此學生尚未繳交測驗，無法檢視作答內容。
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function isHtmlEmpty(html: string): boolean {
  return !html || html.replace(/<[^>]*>/g, '').trim() === '';
}

function AnswerVerdictMark({ correct }: { correct: boolean }) {
  return (
    <span
      className={`shrink-0 text-lg font-bold leading-none select-none ${
        correct ? 'text-emerald-600' : 'text-red-600'
      }`}
      title={correct ? '正確' : '錯誤'}
      aria-label={correct ? '正確' : '錯誤'}
    >
      {correct ? '✓' : '✗'}
    </span>
  );
}

function AnswerResultRow({
  correct,
  children,
}: {
  correct: boolean | null;
  children: React.ReactNode;
}) {
  const tone =
    correct === true
      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
      : correct === false
        ? 'bg-red-50 border-red-200 text-red-900'
        : 'bg-gray-50 border-gray-200 text-gray-800';

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${tone}`}>
      <div className="min-w-0 flex-1">{children}</div>
      {correct !== null && <AnswerVerdictMark correct={correct} />}
    </div>
  );
}

function StudentAnswerDisplay({
  answer,
  question,
  optionLabelStyle = 'letter_paren',
}: {
  answer: QuestionAnswerRecord;
  question?: Question | SubQuestion;
  optionLabelStyle?: OptionLabelStyle;
}) {
  const r = answer.response;

  if (r === null || r === undefined) {
    return (
      <AnswerResultRow correct={answer.gradingStatus === 'pending' ? null : false}>
        <span className="text-gray-400">（未作答）</span>
      </AnswerResultRow>
    );
  }

  if (answer.questionType === 'short_answer') {
    const text = String(r).trim();
    const correct =
      answer.gradingStatus === 'pending'
        ? null
        : answer.isCorrect === true
          ? true
          : answer.isCorrect === false
            ? false
            : null;
    return (
      <AnswerResultRow correct={correct}>
        <div className="whitespace-pre-wrap min-h-[2.5rem]">{text || '（未作答）'}</div>
      </AnswerResultRow>
    );
  }

  if (answer.questionType === 'tf') {
    const label = r === true ? '是' : r === false ? '否' : String(r);
    const correct =
      question && isTrueFalseQuestion(question)
        ? r === question.correctAnswer
        : answer.isCorrect ?? null;
    return (
      <AnswerResultRow correct={correct}>
        <span className="font-medium">{label}</span>
      </AnswerResultRow>
    );
  }

  if (answer.questionType === 'fill_in' && question && isFillInQuestion(question)) {
    return (
      <div className="space-y-2">
        {question.cells.map((cell, i) => {
          const val = readFillInCellAnswer(r, cell, i);
          const filled = val !== undefined && val !== null && val in GRID_CELL_ANSWER_LABELS;
          const correct = filled ? val === cell.correctAnswer : false;
          return (
            <AnswerResultRow key={cell.id} correct={correct}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold shrink-0">{cell.label}</span>
                <span className="font-mono">
                  {filled ? (
                    GRID_CELL_ANSWER_LABELS[val]
                  ) : (
                    <span className="text-gray-400">（未填）</span>
                  )}
                </span>
                {!correct && filled && (
                  <span className="text-xs text-gray-500">
                    正解 {GRID_CELL_ANSWER_LABELS[cell.correctAnswer]}
                  </span>
                )}
              </div>
            </AnswerResultRow>
          );
        })}
      </div>
    );
  }

  if (answer.questionType === 'multiple' && Array.isArray(r)) {
    if (r.length === 0) {
      return (
        <AnswerResultRow correct={false}>
          <span className="text-gray-400">（未作答）</span>
        </AnswerResultRow>
      );
    }
    return (
      <div className="space-y-2">
        {r.map((optHtml, i) => (
          <ChoiceAnswerItem
            key={`${i}-${String(optHtml).slice(0, 24)}`}
            optHtml={String(optHtml)}
            question={question}
            optionLabelStyle={optionLabelStyle}
          />
        ))}
      </div>
    );
  }

  if (answer.questionType === 'single' || typeof r === 'string') {
    const html = String(r);
    if (isHtmlEmpty(html)) {
      return (
        <AnswerResultRow correct={false}>
          <span className="text-gray-400">（未作答）</span>
        </AnswerResultRow>
      );
    }
    return (
      <ChoiceAnswerItem
        optHtml={html}
        question={question}
        optionLabelStyle={optionLabelStyle}
      />
    );
  }

  return (
    <AnswerResultRow correct={answer.isCorrect ?? null}>
      <span>{String(r)}</span>
    </AnswerResultRow>
  );
}

function ChoiceAnswerItem({
  optHtml,
  question,
  optionLabelStyle,
}: {
  optHtml: string;
  question?: Question | SubQuestion;
  optionLabelStyle: OptionLabelStyle;
}) {
  const optionIndex =
    question && isChoiceQuestion(question)
      ? question.options.findIndex((opt) => isChoiceOptionEqual(opt, optHtml))
      : -1;
  const label =
    optionIndex >= 0 ? formatOptionLabel(optionIndex, optionLabelStyle) : null;
  const isCorrectOption =
    question && isChoiceQuestion(question)
      ? choiceListIncludes(question.correctAnswers, optHtml)
      : null;

  return (
    <AnswerResultRow correct={isCorrectOption}>
      <div className="flex items-start gap-2">
        {label ? <span className="font-semibold shrink-0">{label}</span> : null}
        <div className="min-w-0 flex-1">
          <RichHtmlContent html={optHtml} />
        </div>
      </div>
    </AnswerResultRow>
  );
}
