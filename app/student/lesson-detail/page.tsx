import React, { Suspense } from 'react';
import LessonDetailContent from './LessonDetailContent';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function LessonDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size={40} text="正在載入課程內容..." />
        </div>
      }
    >
      <LessonDetailContent />
    </Suspense>
  );
}