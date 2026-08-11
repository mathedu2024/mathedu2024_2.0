'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import BackButton from '@/components/ui/BackButton';
import StudentSurveyStartPageView from '@/components/student-survey/StudentSurveyStartPageView';
import { useStudentInfo } from '@/student/StudentInfoContext';
import { useHydrated } from '@/utils/useHydrated';
import {
  fetchStudentSurveyList,
  type StudentSurveyListItem,
} from '@/utils/studentClientApi';
import { resolveStudentSurveyExitHref } from '@/utils/surveyAttemptLabel';

function StudentSurveyStartPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const surveyCode = typeof params.surveyCode === 'string' ? params.surveyCode : '';
  const modeParam = searchParams.get('mode');
  const mode = modeParam === 'retake' ? 'retake' : 'start';
  const fromParam = searchParams.get('from');
  const hydrated = useHydrated();
  const { studentInfo, loading: studentLoading } = useStudentInfo();
  const [survey, setSurvey] = useState<StudentSurveyListItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const backHref = useMemo(
    () => resolveStudentSurveyExitHref(fromParam, survey),
    [fromParam, survey]
  );

  useEffect(() => {
    if (!surveyCode || !studentInfo?.id) return;

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchStudentSurveyList(studentInfo.id);
        if (cancelled) return;
        const found = list.find(
          (item) => item.surveyCode === surveyCode || item.id === surveyCode
        );
        if (!found) {
          setSurvey(null);
          setError('找不到此問卷，或您沒有填寫權限。');
        } else {
          setSurvey(found);
        }
      } catch {
        if (!cancelled) {
          setSurvey(null);
          setError('載入問卷資訊失敗，請稍後再試。');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [surveyCode, studentInfo?.id]);

  if (!surveyCode) {
    return (
      <div className="page-shell py-16 text-center text-on-surfaceVariant">無效的問卷連結</div>
    );
  }

  const pageHeader = (
    <div className="border-l-4 border-primary pl-4">
      <h1 className="font-display text-2xl font-extrabold text-on-surface flex items-center gap-3">
        <ClipboardDocumentListIcon className="h-8 w-8 text-primary" />
        課程問卷
      </h1>
      <p className="text-on-surfaceVariant text-sm mt-1">檢視問卷資訊與填寫紀錄，確認後再開始填寫。</p>
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
        <BackButton label="返回課程問卷" href={backHref} />
        <PageLoadingArea minHeight="min-h-[40vh]" />
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="page-shell py-16 text-center space-y-4">
        <p className="text-on-surfaceVariant">{error || '找不到問卷'}</p>
        <BackButton label="返回課程問卷" href={backHref} withSpacing={false} />
      </div>
    );
  }

  return (
    <div className="page-shell w-full min-w-0 pt-4 sm:pt-6 md:pt-8 pb-10">
      {pageHeader}
      <BackButton label="返回課程問卷" href={backHref} />
      <StudentSurveyStartPageView
        survey={survey}
        mode={mode}
        backHref={backHref}
      />
    </div>
  );
}

export default function StudentSurveyStartPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell w-full min-w-0 pt-4 sm:pt-6 md:pt-8 pb-10">
          <PageLoadingArea minHeight="min-h-[50vh]" />
        </div>
      }
    >
      <StudentSurveyStartPageInner />
    </Suspense>
  );
}
