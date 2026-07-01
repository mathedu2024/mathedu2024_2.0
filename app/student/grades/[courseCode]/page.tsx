'use client';

import { useParams } from 'next/navigation';
import GradesContent from '../GradesContent';

export default function GradesCoursePage() {
  const params = useParams();
  const raw = params.courseCode;
  const courseCode =
    typeof raw === 'string' ? decodeURIComponent(raw) : Array.isArray(raw) ? decodeURIComponent(raw[0] ?? '') : '';

  return <GradesContent courseCodeFromUrl={courseCode} />;
}
