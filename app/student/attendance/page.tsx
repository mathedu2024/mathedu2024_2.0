'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AttendanceContent from './AttendanceContent';

/** 點名列表已併入我的課程；保留帶參數的簽到／查看頁 */
export default function StudentAttendancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');
  const activity = searchParams.get('activity');

  useEffect(() => {
    if (!courseId && !activity) {
      router.replace('/student/courses');
    }
  }, [courseId, activity, router]);

  if (!courseId && !activity) {
    return null;
  }

  return <AttendanceContent />;
}
