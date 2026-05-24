import { NextRequest, NextResponse } from 'next/server';
import { syncStudentCourseEnrollments } from '@/services/courseEnrollmentSync';

export async function POST(req: NextRequest) {
  const { studentId, oldCourses, newCourses, studentInfo } = await req.json();
  if (!studentId || !Array.isArray(oldCourses) || !Array.isArray(newCourses)) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  try {
    const result = await syncStudentCourseEnrollments(studentId, oldCourses, newCourses, studentInfo);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error updating student courses:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to update course enrollments.', details: message }, { status: 500 });
  }
}
