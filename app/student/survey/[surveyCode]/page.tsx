'use client';

import React, { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import SurveyTakeView from '@/components/student-survey/SurveyTakeView';
import PageLoadingArea from '@/components/ui/PageLoadingArea';

function StudentSurveyPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const surveyCode = typeof params?.surveyCode === 'string' ? params.surveyCode : '';
  const backHref = searchParams.get('from') || '/student/courses';
  const reviewMode = searchParams.get('review') === '1';

  if (!surveyCode) {
    return <p className="text-center text-on-surfaceVariant py-16">找不到問卷</p>;
  }

  return <SurveyTakeView surveyCode={surveyCode} backHref={backHref} reviewMode={reviewMode} />;
}

export default function StudentSurveyPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell w-full min-w-0 py-4 sm:py-6 md:py-8">
          <PageLoadingArea minHeight="min-h-[50vh]" />
        </div>
      }
    >
      <StudentSurveyPageInner />
    </Suspense>
  );
}
