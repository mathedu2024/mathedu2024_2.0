'use client';

import React, { Suspense } from 'react';
import LessonDetailContent from '@/student/lesson-detail/LessonDetailContent';
import PageLoadingArea from '@/components/ui/PageLoadingArea';

/** 老師預覽課堂詳情：畫面與學生端相同（不作答送出） */
function TeacherCourseLessonPreviewInner() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-[100] bg-violet-600 text-white text-sm px-4 py-2.5 shadow-sm">
        <strong>學生端預覽</strong>
        <span className="opacity-90 ml-2">課堂內容與學生端相同</span>
      </div>
      <LessonDetailContent />
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
