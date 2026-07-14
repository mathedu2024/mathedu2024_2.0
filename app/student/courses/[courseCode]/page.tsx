'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import StudentCoursesContent from '../StudentCoursesContent';
import PageLoadingArea from '@/components/ui/PageLoadingArea';

function CourseDetailPage() {
  const params = useParams();
  const raw = params.courseCode;
  const courseCode =
    typeof raw === 'string' ? decodeURIComponent(raw) : Array.isArray(raw) ? decodeURIComponent(raw[0] ?? '') : '';

  return <StudentCoursesContent courseCodeFromUrl={courseCode} />;
}

export default function StudentCoursesCoursePage() {
  return (
    <Suspense fallback={<PageLoadingArea minHeight="min-h-[16rem]" />}>
      <CourseDetailPage />
    </Suspense>
  );
}
