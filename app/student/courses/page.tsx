'use client';

import React, { Suspense } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import StudentCoursesContent from './StudentCoursesContent';

export default function StudentCoursesPage() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <StudentCoursesContent />
    </Suspense>
  );
}