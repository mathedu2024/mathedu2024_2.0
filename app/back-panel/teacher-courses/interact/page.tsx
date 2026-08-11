'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import TeacherCourseInteract from '@/components/TeacherCourseInteract';
import { getSession } from '@/utils/session';

type CourseInfo = {
  id: string;
  name: string;
  code: string;
};

function TeacherCourseInteractInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code')?.trim() || '';
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<CourseInfo | null>(null);

  useEffect(() => {
    const session = getSession();
    const role = session?.role;
    const roles = Array.isArray(role) ? role : role ? [role] : [];
    const isStaff = roles.some((r) => {
      const n = String(r).toLowerCase();
      return n === 'admin' || n === '管理員' || n === 'teacher' || n === '老師';
    });
    if (!session?.id || !isStaff) {
      setError('請以老師或管理員身分登入後再使用課程互動');
      setCourse(null);
      return;
    }
    if (!code) {
      setError('連結無效：缺少課程代碼');
      setCourse(null);
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
            typeof json?.error === 'string' ? json.error : '無法載入課程'
          );
        }
        const c = json?.course;
        if (!c?.id || !c?.code) throw new Error('課程資料不完整');
        if (!cancelled) {
          setCourse({
            id: String(c.id),
            name: String(c.name || ''),
            code: String(c.code),
          });
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '無法載入課程');
          setCourse(null);
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
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-white/80 text-center">{error}</p>
        <button
          type="button"
          onClick={handleClose}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary"
        >
          關閉
        </button>
      </div>
    );
  }

  if (!course) {
    return <PageLoadingArea className="min-h-screen bg-slate-900" minHeight="min-h-screen" />;
  }

  return <TeacherCourseInteract course={course} onClose={handleClose} />;
}

export default function TeacherCourseInteractPage() {
  return (
    <Suspense fallback={<PageLoadingArea className="min-h-screen bg-slate-900" minHeight="min-h-screen" />}>
      <TeacherCourseInteractInner />
    </Suspense>
  );
}
