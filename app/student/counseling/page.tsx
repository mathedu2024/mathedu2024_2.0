import React, { Suspense } from 'react';
import CounselingContent from './CounselingContent';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function CounselingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner />
        </div>
      }
    >
      <CounselingContent />
    </Suspense>
  );
}