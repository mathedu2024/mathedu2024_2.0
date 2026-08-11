'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import ExamTakeView from '@/components/student-exam/ExamTakeView';
import { useQuizStore } from '@/stores/useQuizStore';
import type { Quiz } from '@/services/quizTypes';
import { getSession } from '@/utils/session';
import {
  clearTeacherExamPreview,
  loadTeacherExamPreview,
} from '@/utils/teacherExamPreview';

const PREVIEW_STUDENT_ID = '__teacher_preview__';

function TeacherExamPreviewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('t') ?? '';
  const initExam = useQuizStore((s) => s.initExam);
  const reset = useQuizStore((s) => s.reset);
  const quiz = useQuizStore((s) => s.quiz);
  const previewMode = useQuizStore((s) => s.previewMode);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  /** 避免 React Strict Mode 重跑 effect 時清掉資料後讀不到 */
  const cachedQuizRef = useRef<Quiz | null>(null);

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
      setReady(false);
      return;
    }

    if (!token) {
      setError('預覽連結無效');
      setReady(false);
      return;
    }

    let loaded = cachedQuizRef.current;
    if (!loaded) {
      loaded = loadTeacherExamPreview(token);
      if (loaded) cachedQuizRef.current = loaded;
    }

    if (!loaded) {
      setError('預覽資料已失效，請回到編輯頁重新開啟預覽');
      setReady(false);
      return;
    }

    initExam({
      quiz: loaded,
      quizCode: loaded.quizCode || 'preview',
      studentId: PREVIEW_STUDENT_ID,
      readOnly: false,
      previewMode: true,
    });
    setReady(true);
    setError(null);

    // 不在 cleanup 清除 localStorage（Strict Mode 會先清再重跑導致失效）
  }, [token, initExam]);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const handleClose = () => {
    clearTeacherExamPreview(token);
    cachedQuizRef.current = null;
    reset();
    window.close();
    // 若瀏覽器不允許關閉腳本開啟的分頁，再導回列表
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

  if (!ready || !previewMode || !quiz) {
    return <PageLoadingArea className="min-h-screen" minHeight="min-h-screen" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ExamTakeView
        quizCode={quiz.quizCode || 'preview'}
        onExitPreview={handleClose}
      />
    </div>
  );
}

export default function TeacherExamPreviewPage() {
  return (
    <Suspense fallback={<PageLoadingArea className="min-h-screen" minHeight="min-h-screen" />}>
      <TeacherExamPreviewInner />
    </Suspense>
  );
}
