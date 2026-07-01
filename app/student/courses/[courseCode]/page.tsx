'use client';

import { useParams } from 'next/navigation';
import StudentCoursesContent from '../StudentCoursesContent';

export default function StudentCoursesCoursePage() {
  const params = useParams();
  const raw = params.courseCode;
  const courseCode =
    typeof raw === 'string' ? decodeURIComponent(raw) : Array.isArray(raw) ? decodeURIComponent(raw[0] ?? '') : '';

  return <StudentCoursesContent courseCodeFromUrl={courseCode} />;
}
