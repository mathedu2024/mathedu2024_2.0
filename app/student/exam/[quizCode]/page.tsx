'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import BackButton from '@/components/ui/BackButton';
import ExamTakeView from '@/components/student-exam/ExamTakeView';
import { useStudentInfo } from '@/student/StudentInfoContext';
import { useHydrated } from '@/utils/useHydrated';
import { useQuizStore } from '@/stores/useQuizStore';
import type { Quiz } from '@/services/quizTypes';
import type { QuizAnswerKey } from '@/services/quizStudentView';
import { applyQuizAnswerKey } from '@/services/quizStudentView';
import type { QuizSubmission } from '@/services/quizSubmissionTypes';
import { fetchStudentExamByCode, type StudentExamAttemptSummary } from '@/utils/studentClientApi';
import {
  buildStudentCourseExamsUrl,
  buildStudentExamStartUrl,
  resolveStudentExamExitHref,
} from '@/utils/examAttemptLabel';

function StudentExamTakePageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizCode = typeof params.quizCode === 'string' ? params.quizCode : '';
  const submissionId = searchParams.get('submission') ?? undefined;
  const review = searchParams.get('review') === '1';
  const take = searchParams.get('take') === '1';
  const fromParam = searchParams.get('from');
  const hydrated = useHydrated();
  const { studentInfo, loading: studentLoading } = useStudentInfo();
  const initExam = useQuizStore((s) => s.initExam);
  const reset = useQuizStore((s) => s.reset);
  const quiz = useQuizStore((s) => s.quiz);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pageTitle, setPageTitle] = useState('線上測驗');
  const [viewMeta, setViewMeta] = useState<{
    readOnly: boolean;
    resultsPublished: boolean;
    canRetake: boolean;
    viewingSubmissionId?: string;
    attempts: StudentExamAttemptSummary[];
  }>({ readOnly: false, resultsPublished: false, canRetake: false, attempts: [] });

  const backHref = useMemo(
    () => resolveStudentExamExitHref(fromParam, quiz),
    [fromParam, quiz]
  );

  useEffect(() => {
    return () => reset();
  }, [reset]);

  useEffect(() => {
    if (!quizCode || !studentInfo?.id) return;

    let cancelled = false;
    reset();
    void (async () => {
      setReady(false);
      setError(null);
      try {
        const data = await fetchStudentExamByCode(quizCode, {
          submissionId,
          review: review && !submissionId,
          take: take && !submissionId && !review,
        });
        if (!cancelled) {
          let loadedQuiz = data.quiz as Quiz;
          if (data.answerKey) {
            loadedQuiz = applyQuizAnswerKey(loadedQuiz, data.answerKey as QuizAnswerKey);
          }
          setPageTitle(loadedQuiz.title || '線上測驗');
          setViewMeta({
            readOnly: !!data.readOnly,
            resultsPublished: !!data.resultsPublished,
            canRetake: !!data.canRetake,
            viewingSubmissionId:
              typeof data.viewingSubmissionId === 'string'
                ? data.viewingSubmissionId
                : undefined,
            attempts: Array.isArray(data.attempts)
              ? (data.attempts as StudentExamAttemptSummary[])
              : [],
          });
          initExam({
            quiz: loadedQuiz,
            quizCode,
            studentId: studentInfo.id,
            readOnly: !!data.readOnly,
            submission: data.readOnly ? ((data.submission as QuizSubmission) ?? null) : null,
          });
          setReady(true);
        }
      } catch (err) {
        if (cancelled) return;
        const e = err as Error & {
          requireConfirm?: boolean;
          assignedCourses?: Array<{ courseId?: string }>;
        };
        // 未經確認視窗：導向開始作答頁
        if (e.requireConfirm && !take && !review && !submissionId) {
          const courseKey = e.assignedCourses?.[0]?.courseId;
          const from = courseKey ? buildStudentCourseExamsUrl(courseKey) : undefined;
          router.replace(buildStudentExamStartUrl(quizCode, { from }));
          return;
        }
        setError(err instanceof Error ? err.message : '載入失敗');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quizCode, submissionId, review, take, studentInfo?.id, initExam, reset, router]);

  if (!quizCode) {
    return (
      <div className="page-shell py-16 text-center text-on-surfaceVariant">無效的測驗連結</div>
    );
  }

  const header = (
    <div className="border-l-4 border-primary pl-4 mb-6 sm:mb-8">
      <h1 className="font-display text-2xl font-extrabold text-on-surface">{quiz?.title ?? pageTitle}</h1>
    </div>
  );

  if (!hydrated || (studentLoading && !studentInfo)) {
    return (
      <div className="page-shell w-full min-w-0 py-4 sm:py-6 md:py-8">
        {header}
        <PageLoadingArea minHeight="min-h-[40vh]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell py-16 text-center space-y-4">
        <p className="text-on-surfaceVariant">{error}</p>
        <BackButton label="返回線上測驗" href={backHref} withSpacing={false} />
      </div>
    );
  }

  if (!ready || !quiz) {
    return (
      <div className="page-shell w-full min-w-0 py-4 sm:py-6 md:py-8">
        {header}
        <PageLoadingArea minHeight="min-h-[40vh]" />
      </div>
    );
  }

  return (
    <ExamTakeView
      quizCode={quizCode}
      readOnly={viewMeta.readOnly}
      resultsPublished={viewMeta.resultsPublished}
      initialAttempts={viewMeta.readOnly ? viewMeta.attempts : undefined}
      backHref={backHref}
    />
  );
}

export default function StudentExamTakePage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell w-full min-w-0 py-4 sm:py-6 md:py-8">
          <PageLoadingArea minHeight="min-h-[50vh]" />
        </div>
      }
    >
      <StudentExamTakePageInner />
    </Suspense>
  );
}
