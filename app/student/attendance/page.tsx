import React, { Suspense } from 'react';
import AttendanceContent from './AttendanceContent';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function StudentAttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size={40} text="載入頁面中..." />
        </div>
      }
    >
      <AttendanceContent />
    </Suspense>
  );
}