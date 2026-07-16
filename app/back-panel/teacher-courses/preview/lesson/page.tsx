'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LessonDetailContent from '@/student/lesson-detail/LessonDetailContent';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import { getSession } from '@/utils/session';
import type { StudentExamListItem } from '@/utils/studentClientApi';

/** 老師預覽課堂詳情：畫面與學生端相同（不作答送出） */
function TeacherCourseLessonPreviewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '';
  const [exams, setExams] = useState<StudentExamListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const courseCode = useMemo(() => {
    if (typeof window === 'undefined') return '';
    try {
      const raw = localStorage.getItem('currentLesson');
      if (!raw) return '';
      const lesson = JSON.parse(raw) as { courseCode?: string };
      return typeof lesson.courseCode === 'string' ? lesson.courseCode.trim() : '';
    } catch {
      return '';
    }
  }, []);

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
      return;
    }
    if (!courseCode) {
      setError('找不到課程資料，請從課程預覽重新進入課堂');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/teacher/course-preview?code=${encodeURIComponent(courseCode)}`,
          { credentials: 'same-origin' }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof json?.error === 'string' ? json.error : '無法載入學生端預覽'
          );
        }
        if (!cancelled) {
          setExams(Array.isArray(json.exams) ? json.exams : []);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '無法載入學生端預覽');
          setExams([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseCode]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-gray-600 text-center">{error}</p>
        <button
          type="button"
          onClick={() => {
            if (returnTo) router.push(returnTo);
            else router.back();
          }}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
        >
          返回
        </button>
      </div>
    );
  }

  if (exams === null) {
    return <PageLoadingArea className="min-h-screen" minHeight="min-h-screen" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-[100] bg-violet-600 text-white text-sm px-4 py-2.5 shadow-sm">
        <strong>學生端預覽</strong>
        <span className="opacity-90 ml-2">課堂內容與學生端相同</span>
      </div>
      <LessonDetailContent previewMode previewExams={exams} />
    </div>
  );
}

export default function TeacherCourseLessonPreviewPage() {
  return (
    <Suspense fallback={<PageLoadingArea className="min-h-screen" minHeight="min-h-screen" />}>
      <TeacherCourseLessonPreviewInner />
    </Suspense>
  );
}
