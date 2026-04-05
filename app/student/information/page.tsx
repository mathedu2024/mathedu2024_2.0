import React, { Suspense } from 'react';
import StudentInformationContent from './StudentInformationContent';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function StudentInformationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size={40} text="載入個人資料中..." />
        </div>
      }
    >
      <StudentInformationContent />
    </Suspense>
  );
}