import React, { Suspense } from 'react';
import LessonDetailContent from './LessonDetailContent';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function LessonDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50"><LoadingSpinner size={40} text="載入課程內容中..." /></div>
      }
    >
      <LessonDetailContent />
    </Suspense>
  );
}