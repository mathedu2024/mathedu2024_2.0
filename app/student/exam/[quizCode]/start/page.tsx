'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import BackButton from '@/components/ui/BackButton';
import StudentExamStartPageView from '@/components/student-exam/StudentExamStartPageView';
import { useStudentInfo } from '@/student/StudentInfoContext';
import { useHydrated } from '@/utils/useHydrated';
import {
  fetchStudentExamList,
  type StudentExamListItem,
} from '@/utils/studentClientApi';
import { resolveStudentExamExitHref } from '@/utils/examAttemptLabel';

function StudentExamStartPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const quizCode = typeof params.quizCode === 'string' ? params.quizCode : '';
  const modeParam = searchParams.get('mode');
  const mode = modeParam === 'retake' ? 'retake' : 'start';
  const fromParam = searchParams.get('from');
  const hydrated = useHydrated();
  const { studentInfo, loading: studentLoading } = useStudentInfo();
  const [exam, setExam] = useState<StudentExamListItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const backHref = useMemo(
    () =>
      resolveStudentExamExitHref(
        fromParam,
        exam
          ? {
              assignedCourses: exam.assignedCourses,
              courseId: exam.assignedCourses?.[0]?.courseId,
              courseName: exam.assignedCourses?.[0]?.courseName,
            }
          : null
      ),
    [fromParam, exam]
  );

  useEffect(() => {
    if (!quizCode || !studentInfo?.id) return;

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchStudentExamList(studentInfo.id);
        if (cancelled) return;
        const found = list.find((item) => item.quizCode === quizCode || item.id === quizCode);
        if (!found) {
          setExam(null);
          setError('找不到此測驗，或您沒有作答權限。');
        } else {
          setExam(found);
        }
      } catch {
        if (!cancelled) {
          setExam(null);
          setError('載入測驗資訊失敗，請稍後再試。');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quizCode, studentInfo?.id]);

  if (!quizCode) {
    return (
      <div className="page-shell py-16 text-center text-on-surfaceVariant">無效的測驗連結</div>
    );
  }

  const pageHeader = (
    <div className="border-l-4 border-primary pl-4">
      <h1 className="font-display text-2xl font-extrabold text-on-surface flex items-center gap-3">
        <ClipboardDocumentCheckIcon className="h-8 w-8 text-primary" />
        線上測驗
      </h1>
      <p className="text-on-surfaceVariant text-sm mt-1">檢視測驗資訊與作答紀錄，確認後再開始作答。</p>
    </div>
  );

  if (!hydrated || studentLoading || !studentInfo) {
    return (
      <div className="page-shell w-full min-w-0 pt-4 sm:pt-6 md:pt-8 pb-10">
        {pageHeader}
        <PageLoadingArea minHeight="min-h-[40vh]" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-shell w-full min-w-0 pt-4 sm:pt-6 md:pt-8 pb-10">
        {pageHeader}
        <BackButton label="返回線上測驗" href={backHref} />
        <PageLoadingArea minHeight="min-h-[40vh]" />
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="page-shell py-16 text-center space-y-4">
        <p className="text-on-surfaceVariant">{error || '找不到測驗'}</p>
        <BackButton label="返回線上測驗" href={backHref} withSpacing={false} />
      </div>
    );
  }

  return (
    <div className="page-shell w-full min-w-0 pt-4 sm:pt-6 md:pt-8 pb-10">
      {pageHeader}
      <BackButton label="返回線上測驗" href={backHref} />
      <StudentExamStartPageView
        exam={exam}
        studentId={studentInfo.id}
        mode={mode}
        backHref={backHref}
      />
    </div>
  );
}

export default function StudentExamStartPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell w-full min-w-0 pt-4 sm:pt-6 md:pt-8 pb-10">
          <PageLoadingArea minHeight="min-h-[50vh]" />
        </div>
      }
    >
      <StudentExamStartPageInner />
    </Suspense>
  );
}
