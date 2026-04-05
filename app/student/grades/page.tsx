import React, { Suspense } from 'react';
import GradesContent from './GradesContent';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function StudentGradesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size={40} text="載入成績資料中..." />
        </div>
      }
    >
      <GradesContent />
    </Suspense>
  );
}