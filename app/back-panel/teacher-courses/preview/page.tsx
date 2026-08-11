'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import StudentCoursesContent from '@/student/courses/StudentCoursesContent';
import { getSession } from '@/utils/session';
import type { StudentExamListItem, StudentSurveyListItem, StudentAttendanceActivity } from '@/utils/studentClientApi';

type PreviewCourse = {
  id: string;
  name: string;
  code: string;
  status: string;
  archived?: boolean;
  gradeTags: string[];
  subjectTag: string;
  startDate: string;
  endDate: string;
  teachers: string[];
  teacherName?: string;
  description: string;
  teachingMethod: string;
  courseNature: string;
  location?: string;
  liveStreamURL?: string;
  coverImageURL?: string;
  classTimes?: { day: string; startTime: string; endTime: string }[];
  customLinks?: { name: string; url: string; icon: string }[];
  announcements?: {
    id: string;
    title: string;
    content: string;
    links: { name: string; url: string }[];
    createdAt: string;
    visibleToStudents?: boolean;
  }[];
};

export type TeacherCoursePreviewData = {
  course: PreviewCourse;
  exams: StudentExamListItem[];
  surveys: StudentSurveyListItem[];
  attendance: StudentAttendanceActivity[];
};

function TeacherCoursePreviewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code')?.trim() || '';
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TeacherCoursePreviewData | null>(null);

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
      setData(null);
      return;
    }
    if (!code) {
      setError('預覽連結無效');
      setData(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/teacher/course-preview?code=${encodeURIComponent(code)}`,
          { credentials: 'same-origin' }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof json?.error === 'string' ? json.error : '無法載入學生端預覽'
          );
        }
        if (!cancelled) {
          setData(json as TeacherCoursePreviewData);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '無法載入學生端預覽');
          setData(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleClose = () => {
    window.close();
    window.setTimeout(() => {
      if (code) {
        router.push(`/back-panel/teacher-courses/${encodeURIComponent(code)}`);
      } else {
        router.push('/back-panel/teacher-courses');
      }
    }, 150);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-gray-600 text-center">{error}</p>
        <button
          type="button"
          onClick={handleClose}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
        >
          關閉
        </button>
      </div>
    );
  }

  if (!data) {
    return <PageLoadingArea className="min-h-screen" minHeight="min-h-screen" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-[100] bg-violet-600 text-white text-sm px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <span>
          <strong>學生端預覽</strong>
          <span className="opacity-90 ml-2">畫面與學生端相同；作答／點名／成績不會真正儲存。</span>
        </span>
        <button
          type="button"
          onClick={handleClose}
          className="px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-medium"
        >
          關閉預覽
        </button>
      </div>
      <StudentCoursesContent
        courseCodeFromUrl={data.course.code}
        previewMode
        previewData={data}
        onExitPreview={handleClose}
      />
    </div>
  );
}

export default function TeacherCoursePreviewPage() {
  return (
    <Suspense fallback={<PageLoadingArea className="min-h-screen" minHeight="min-h-screen" />}>
      <TeacherCoursePreviewInner />
    </Suspense>
  );
}
