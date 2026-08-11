'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import SurveyTakeView from '@/components/student-survey/SurveyTakeView';
import type { Survey } from '@/services/surveyTypes';
import { getSession } from '@/utils/session';
import {
  clearTeacherSurveyPreview,
  loadTeacherSurveyPreview,
} from '@/utils/teacherSurveyPreview';

function TeacherSurveyPreviewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('t') ?? '';
  const [error, setError] = useState<string | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const cachedSurveyRef = useRef<Survey | null>(null);

  useEffect(() => {
    const session = getSession();
    const role = session?.role;
    const roles = Array.isArray(role) ? role : role ? [role] : [];
    const isStaff = roles.some((r) => {
      const n = String(r).toLowerCase();
      return n === 'admin' || n === '管理員' || n === 'teacher' || n === '老師';
    });
    if (!session?.id || !isStaff) {
      setError('請以老師或管理員身分登入後再預覽');
      setSurvey(null);
      return;
    }

    if (!token) {
      setError('預覽連結無效');
      setSurvey(null);
      return;
    }

    let loaded = cachedSurveyRef.current;
    if (!loaded) {
      loaded = loadTeacherSurveyPreview(token);
      if (loaded) cachedSurveyRef.current = loaded;
    }

    if (!loaded) {
      setError('預覽資料已失效，請回到編輯頁重新開啟預覽');
      setSurvey(null);
      return;
    }

    setSurvey(loaded);
    setError(null);
  }, [token]);

  const handleClose = () => {
    clearTeacherSurveyPreview(token);
    cachedSurveyRef.current = null;
    window.close();
    window.setTimeout(() => {
      router.push('/back-panel/teacher-courses');
    }, 150);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-gray-600 text-center">{error}</p>
        <button
          type="button"
          onClick={handleClose}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover"
        >
          關閉
        </button>
      </div>
    );
  }

  if (!survey) {
    return <PageLoadingArea className="min-h-screen" minHeight="min-h-screen" />;
  }

  return (
    <SurveyTakeView
      surveyCode={survey.surveyCode || 'preview'}
      previewSurvey={survey}
      onExitPreview={handleClose}
    />
  );
}

export default function TeacherSurveyPreviewPage() {
  return (
    <Suspense fallback={<PageLoadingArea className="min-h-screen" minHeight="min-h-screen" />}>
      <TeacherSurveyPreviewInner />
    </Suspense>
  );
}
