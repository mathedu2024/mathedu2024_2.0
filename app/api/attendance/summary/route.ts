import { NextRequest, NextResponse } from 'next/server';
import { getCourseAttendanceSummary } from '@/services/attendanceService';
import { getSessionFromCookie } from '@/utils/session';

export async function POST(req: NextRequest) {
  const cookieString = req.headers.get('cookie');
  const session = cookieString ? getSessionFromCookie(cookieString) : null;

  if (!session || !(session.role.includes('teacher') || session.role.includes('admin'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { courseId } = await req.json();
    if (!courseId) {
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
    }

    const summaryData = await getCourseAttendanceSummary(courseId);
    return NextResponse.json(summaryData);

  } catch (error) {
    console.error('Error in /api/attendance/summary: ', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
