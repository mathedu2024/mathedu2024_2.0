'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from '@/utils/swalTheme';
import { PaperAirplaneIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import BackButton from '@/components/ui/BackButton';
import QuestionTakeCard from './QuestionTakeCard';
import ExamAnswerOverview from './ExamAnswerOverview';
import StudentExamAttemptPickerModal from './StudentExamAttemptPickerModal';
import RichHtmlContent from '@/components/RichHtmlContent';
import { isHtmlEmpty } from '@/utils/richText';
import { useQuizStore, countAnsweredQuestions } from '@/stores/useQuizStore';
import {
  buildQuizQuestionNumberList,
  countQuizQuestions,
  formatQuizTimeLimit,
  getQuestionNumberMap,
  getQuizMaxAttempts,
  isContinuousQuestionNumbers,
  isGroupQuestion,
  isQuizExamLockEnabled,
  isQuizResultsPublished,
  type GroupQuestion,
  type NumberedQuestionEntry,
  type Question,
  type QuizSection,
} from '@/services/quizTypes';
import type { QuizSubmission } from '@/services/quizSubmissionTypes';
import type { QuestionAnswerRecord } from '@/services/quizSubmissionTypes';
import {
  buildQuestionOverview,
  buildSubmitSummaryHtml,
  countOverviewStats,
} from '@/utils/examAnswerStatus';
import {
  fetchStudentExamAttempts,
  invalidateStudentExamGet,
  invalidateStudentExamList,
  type StudentExamAttemptSummary,
} from '@/utils/studentClientApi';
import { useExamSessionGuards } from '@/utils/useExamSessionGuards';
import { useMobileExamLayout } from '@/utils/useMobileExamLayout';
import { resolveStudentExamExitHref } from '@/utils/examAttemptLabel';
import { applyQuizAnswerKey, type QuizAnswerKey } from '@/services/quizStudentView';

function findQuestionLocation(
  sections: QuizSection[],
  entry: NumberedQuestionEntry
): { section: QuizSection; sectionIndex: number; parentGroup?: GroupQuestion } | null {
  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const section = sections[sIdx];
    for (const q of section.questions) {
      if (entry.isSubQuestion && entry.parentGroupId === q.id && isGroupQuestion(q)) {
        return { section, sectionIndex: sIdx, parentGroup: q };
      }
      if (!entry.isSubQuestion && q.id === entry.id) {
        return { section, sectionIndex: sIdx };
      }
    }
  }
  return null;
}

function SectionHeader({
  section,
  sectionIndex,
}: {
  section: QuizSection;
  sectionIndex: number;
}) {
  return (
    <div className="border-l-4 border-primary pl-3">
      <h2 className="font-bold text-on-surface">{section.title || `第 ${sectionIndex + 1} 大題`}</h2>
      {!isHtmlEmpty(section.description) && (
        <div className="text-sm text-on-surfaceVariant mt-1">
          <RichHtmlContent html={section.description!} />
        </div>
      )}
    </div>
  );
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

interface ExamTakeViewProps {
  quizCode: string;
  readOnly?: boolean;
  resultsPublished?: boolean;
  initialAttempts?: StudentExamAttemptSummary[];
  /** 離開作答／檢視後的回程（通常為課程線上測驗分頁） */
  backHref?: string;
  /** 老師預覽：關閉時回呼（不導向學生列表） */
  onExitPreview?: () => void;
}

export default function ExamTakeView({
  quizCode,
  readOnly: readOnlyProp = false,
  resultsPublished: resultsPublishedProp,
  initialAttempts,
  backHref,
  onExitPreview,
}: ExamTakeViewProps) {
  const router = useRouter();
  const {
    quiz,
    answers,
    skippedIds,
    readOnly,
    previewMode,
    submitting,
    submission,
    deadlineAt,
    studentId,
    setAnswer,
    toggleSkip,
    setSubmitting,
    setSubmission,
    clearDraft,
  } = useQuizStore();

  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [submitResult, setSubmitResult] = useState<{
    totalScore: number;
    maxScore: number;
    objectiveScore: number;
    hasPendingManual: boolean;
  } | null>(null);
  const autoSubmittedRef = useRef(false);
  const [attempts, setAttempts] = useState<StudentExamAttemptSummary[]>(initialAttempts ?? []);
  const [attemptPickerOpen, setAttemptPickerOpen] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const isMobileLayout = useMobileExamLayout();

  useExamSessionGuards();

  const resultsPublished =
    resultsPublishedProp ?? (quiz ? isQuizResultsPublished(quiz) : false);
  const examLock = quiz ? isQuizExamLockEnabled(quiz) : false;
  const showReviewActions = readOnlyProp && readOnly;

  useEffect(() => {
    if (initialAttempts !== undefined) {
      setAttempts(initialAttempts);
      return;
    }
    if (!readOnlyProp) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchStudentExamAttempts(quizCode);
        if (!cancelled) setAttempts(list);
      } catch {
        if (!cancelled) setAttempts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [readOnlyProp, quizCode, initialAttempts]);

  const exitHref = resolveStudentExamExitHref(backHref, quiz);

  const handleExitToList = () => {
    if (previewMode) {
      onExitPreview?.();
      return;
    }
    if (readOnly) {
      window.close();
      router.push(exitHref);
      return;
    }
    router.push(exitHref);
  };

  const numbered = useMemo(
    () =>
      quiz
        ? buildQuizQuestionNumberList(quiz.sections, isContinuousQuestionNumbers(quiz))
        : [],
    [quiz]
  );

  const overviewItems = useMemo(
    () => buildQuestionOverview(numbered, answers, skippedIds),
    [numbered, answers, skippedIds]
  );

  const subQuestionNumbers = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of numbered) {
      if (entry.isSubQuestion) map.set(entry.id, entry.number);
    }
    return map;
  }, [numbered]);

  const questionNumberMap = useMemo(
    () =>
      quiz
        ? getQuestionNumberMap(quiz.sections, isContinuousQuestionNumbers(quiz))
        : new Map<string, number>(),
    [quiz]
  );

  const allQuestionIds = useMemo(() => numbered.map((n) => n.id), [numbered]);
  const answeredCount = countAnsweredQuestions(answers, allQuestionIds);
  const totalQuestions = quiz ? countQuizQuestions(quiz) : 0;

  const gradingByQuestionId = useMemo(() => {
    if (!submission) return new Map<string, QuestionAnswerRecord>();
    return new Map(submission.answers.map((a) => [a.questionId, a]));
  }, [submission]);

  const showQuestionGrading = readOnly && resultsPublished;

  const currentEntry = numbered[currentQuestionIndex] ?? null;
  const currentQuestionId = currentEntry?.id;

  useEffect(() => {
    if (currentQuestionIndex >= numbered.length && numbered.length > 0) {
      setCurrentQuestionIndex(numbered.length - 1);
    }
  }, [currentQuestionIndex, numbered.length]);

  const jumpToQuestion = useCallback(
    (questionId: string) => {
      const index = numbered.findIndex((n) => n.id === questionId);
      if (index >= 0) {
        setCurrentQuestionIndex(index);
      }
      if (!isMobileLayout) {
        document.getElementById(`question-${questionId}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    },
    [numbered, isMobileLayout]
  );

  const goToPreviousQuestion = () => {
    setCurrentQuestionIndex((i) => Math.max(0, i - 1));
  };

  const goToNextQuestion = () => {
    setCurrentQuestionIndex((i) => Math.min(numbered.length - 1, i + 1));
  };

  const doSubmit = useCallback(async (silent = false) => {
    if (!quiz || readOnly || submitting || autoSubmittedRef.current) return;

    if (previewMode) {
      if (!silent) {
        await Swal.fire({
          icon: 'info',
          title: '預覽模式',
          text: '學生版預覽不會儲存或送出答案。',
          confirmButtonColor: '#2D6DF6',
        });
      }
      return;
    }

    autoSubmittedRef.current = true;
    setSubmitting(true);
    try {
      const res = await fetch('/api/student/exams/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizCode, answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '提交失敗');
      }
      clearDraft();
      const answerKey = data.answerKey as QuizAnswerKey | undefined;
      const quizWithAnswers =
        answerKey && quiz ? applyQuizAnswerKey(quiz, answerKey) : undefined;
      setSubmission(data.submission as QuizSubmission, {
        ...(quizWithAnswers ? { quiz: quizWithAnswers } : {}),
      });
      setSubmitResult(data.gradeResult);
      if (studentId) invalidateStudentExamList(studentId);
      invalidateStudentExamGet(quizCode);
      if (!silent) {
        const maxAttempts = quiz ? getQuizMaxAttempts(quiz) : null;
        const retakeHint =
          maxAttempts === null
            ? '可從測驗列表再次作答。'
            : maxAttempts > 1
              ? `尚可再作答（上限 ${maxAttempts} 次）。`
              : '';
        Swal.fire({
          icon: 'success',
          title: '測驗已提交',
          text: data.gradeResult.hasPendingManual
            ? `客觀題已自動批改，簡答題待老師批改。${retakeHint ? ` ${retakeHint}` : ''}`
            : retakeHint
              ? `您的答案已成功送出。${retakeHint}`
              : '您的答案已成功送出。',
          confirmButtonColor: '#2D6DF6',
        });
      }
    } catch (err) {
      autoSubmittedRef.current = false;
      Swal.fire({
        icon: 'error',
        title: '提交失敗',
        text: err instanceof Error ? err.message : '請稍後再試',
        confirmButtonColor: '#2D6DF6',
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    quiz,
    readOnly,
    previewMode,
    submitting,
    quizCode,
    answers,
    studentId,
    setSubmitting,
    setSubmission,
    clearDraft,
  ]);

  const handleSubmit = async () => {
    if (!quiz) return;
    if (previewMode) {
      void doSubmit(false);
      return;
    }
    const stats = countOverviewStats(overviewItems);
    const maxAttempts = getQuizMaxAttempts(quiz);
    const retakeNote =
      maxAttempts === null
        ? '提交後可從測驗列表再次作答。'
        : maxAttempts > 1
          ? `提交後尚可再作答（上限 ${maxAttempts} 次）。`
          : '提交後將無法修改答案。';

    const result = await Swal.fire({
      title: '確定要提交測驗？',
      html: `${buildSubmitSummaryHtml(overviewItems)}<p class="text-on-surfaceVariant text-sm mt-3">${retakeNote}</p>`,
      icon: stats.unanswered > 0 || stats.skipped > 0 ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonColor: '#2D6DF6',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: '確認提交',
      cancelButtonText: '再檢查一下',
      width: 480,
    });
    if (result.isConfirmed) void doSubmit();
  };

  useEffect(() => {
    if (!deadlineAt || readOnly) return;
    const tick = () => {
      const left = deadlineAt - Date.now();
      setRemainingMs(left);
      if (left <= 0) {
        if (previewMode) {
          setRemainingMs(0);
          return;
        }
        void doSubmit(true);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [deadlineAt, readOnly, previewMode, doSubmit]);

  if (!quiz) return null;

  const showResult = readOnly && (submission || submitResult);
  const showTimer = !readOnly && !!deadlineAt;
  const showScoreInResult = showResult && resultsPublished;

  const questionCardBaseProps = {
    optionLabelStyle: quiz.optionLabelStyle,
    subQuestionNumbers,
    answers,
    skippedIds,
    readOnly,
    showGrading: showQuestionGrading,
    showCorrectAnswers: showQuestionGrading,
    gradingByQuestionId,
    onAnswer: setAnswer,
    onToggleSkip: toggleSkip,
    forceVerticalLayout: isMobileLayout,
  };

  const renderMobileCurrentQuestion = () => {
    if (!currentEntry) return null;
    const location = findQuestionLocation(quiz.sections, currentEntry);
    if (!location) return null;
    const { section, sectionIndex, parentGroup } = location;

    return (
      <section className="space-y-4">
        <SectionHeader section={section} sectionIndex={sectionIndex} />
        {currentEntry.isSubQuestion && parentGroup ? (
          <QuestionTakeCard
            question={parentGroup}
            questionNumber={0}
            {...questionCardBaseProps}
            visibleSubQuestionId={currentEntry.id}
          />
        ) : (
          <QuestionTakeCard
            question={currentEntry.question as Question}
            questionNumber={currentEntry.number}
            {...questionCardBaseProps}
          />
        )}
      </section>
    );
  };

  return (
    <div className="page-shell w-full min-w-0 py-4 sm:py-6 md:py-8">
      {previewMode && (
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          <strong>學生版預覽</strong>
          ：畫面與學生作答相同（含打亂／計時），但不會暫存或送出答案。
        </div>
      )}

      <div className="border-l-4 border-primary pl-4 mb-0">
        <h1 className="font-display text-2xl font-extrabold text-on-surface">{quiz.title}</h1>
        <p className="text-on-surfaceVariant text-sm mt-1">
          {previewMode
            ? `預覽作答 ${answeredCount} / ${totalQuestions} 題`
            : readOnly
              ? '作答紀錄檢視'
              : `已答 ${answeredCount} / ${totalQuestions} 題`}
          {!readOnly && ` · ${formatQuizTimeLimit(quiz)}`}
        </p>
      </div>

      {showReviewActions ? (
        <div className="flex flex-wrap gap-2 mt-4 mb-2">
          <button
            type="button"
            onClick={handleExitToList}
            className="inline-flex items-center px-4 py-2 bg-white border border-outline-variant/40 text-on-surface text-sm font-medium rounded-lg hover:bg-surface"
          >
            關閉視窗
          </button>
          {attempts.length > 0 && (
            <button
              type="button"
              onClick={() => setAttemptPickerOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-white border border-outline-variant/40 text-on-surface text-sm font-medium rounded-lg hover:bg-surface"
            >
              {attempts.length > 1 ? '選擇其他作答紀錄' : '選擇作答紀錄'}
            </button>
          )}
        </div>
      ) : previewMode ? (
        <div className="mt-4 mb-2">
          <button
            type="button"
            onClick={handleExitToList}
            className="inline-flex items-center px-4 py-2 bg-white border border-outline-variant/40 text-on-surface text-sm font-medium rounded-lg hover:bg-surface"
          >
            關閉預覽
          </button>
        </div>
      ) : !examLock ? (
        <BackButton label="返回線上測驗" href={exitHref} />
      ) : null}

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        <ExamAnswerOverview
          items={overviewItems}
          remainingMs={remainingMs}
          showTimer={showTimer}
          formatRemaining={formatRemaining}
          readOnly={readOnly}
          currentQuestionId={isMobileLayout ? currentQuestionId : undefined}
          onJumpToQuestion={jumpToQuestion}
          onToggleSkip={toggleSkip}
        />

        <div className="flex-1 min-w-0 space-y-8 w-full order-2 lg:order-1">
          {!isHtmlEmpty(quiz.description) && (
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-sm text-on-surface">
              <RichHtmlContent html={quiz.description!} />
            </div>
          )}

          {readOnly && !resultsPublished && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
              成績尚未公布，您可查看自己的作答內容，但暫不顯示批改結果與得分。
            </div>
          )}

          {showResult && (
            <div className="bg-white rounded-2xl border border-emerald-200 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-on-surface mb-2">提交結果</h2>
              {showScoreInResult ? (
                <>
                  <p className="text-2xl font-bold text-primary">
                    {submitResult?.totalScore ?? submission?.totalScore ?? 0}
                    <span className="text-base font-normal text-on-surfaceVariant">
                      {' '}
                      / {submitResult?.maxScore ?? submission?.maxScore ?? quiz.totalPoints} 分
                    </span>
                  </p>
                  {(submitResult?.hasPendingManual || submission?.status === 'grading') && (
                    <p className="text-sm text-amber-700 mt-2">含簡答題，待老師批改後會更新總分。</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-on-surfaceVariant">已提交，成績尚未公布。</p>
              )}
            </div>
          )}

          {isMobileLayout ? (
            <>
              {renderMobileCurrentQuestion()}
              {numbered.length > 0 && (
                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={goToPreviousQuestion}
                    disabled={currentQuestionIndex <= 0}
                    className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-white text-sm font-medium text-on-surface hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeftIcon className="w-5 h-5" />
                    上一題
                  </button>
                  <span className="text-sm text-on-surfaceVariant tabular-nums shrink-0">
                    第 {currentEntry?.number ?? 0} 題
                  </span>
                  <button
                    type="button"
                    onClick={goToNextQuestion}
                    disabled={currentQuestionIndex >= numbered.length - 1}
                    className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-white text-sm font-medium text-on-surface hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    下一題
                    <ChevronRightIcon className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          ) : (
            quiz.sections.map((section, sIdx) => (
              <section key={section.id} className="space-y-4">
                <SectionHeader section={section} sectionIndex={sIdx} />

                <div className="space-y-5">
                  {section.questions.map((question) => (
                    <QuestionTakeCard
                      key={question.id}
                      question={question}
                      questionNumber={
                        isGroupQuestion(question) ? 0 : questionNumberMap.get(question.id) ?? 0
                      }
                      {...questionCardBaseProps}
                    />
                  ))}
                </div>
              </section>
            ))
          )}

          {!readOnly && !showResult && (
            <div className="flex justify-center pb-6">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="inline-flex items-center px-8 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary-hover disabled:opacity-50 shadow-md"
              >
                <PaperAirplaneIcon className="w-5 h-5 mr-2" />
                {previewMode ? '模擬提交（不會送出）' : '提交測驗'}
              </button>
            </div>
          )}
        </div>
      </div>

      {showReviewActions && (
        <StudentExamAttemptPickerModal
          open={attemptPickerOpen}
          onClose={() => setAttemptPickerOpen(false)}
          quizCode={quizCode}
          examTitle={quiz.title}
          attempts={attempts}
          resultsPublished={resultsPublished}
          openMode="sameWindow"
          currentSubmissionId={submission?.id}
          backHref={exitHref}
        />
      )}
    </div>
  );
}
