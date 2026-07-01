'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import StudentCoursesContent from './StudentCoursesContent';
import PageLoadingArea from '@/components/ui/PageLoadingArea';

function CoursesPageRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');

  useEffect(() => {
    if (courseId) {
      router.replace(`/student/courses/${encodeURIComponent(courseId)}`);
    }
  }, [courseId, router]);

  if (courseId) {
    return <PageLoadingArea minHeight="min-h-[16rem]" />;
  }

  return <StudentCoursesContent />;
}

export default function StudentCoursesPage() {
  return (
    <Suspense fallback={<PageLoadingArea minHeight="min-h-[16rem]" />}>
      <CoursesPageRedirect />
    </Suspense>
  );
}
