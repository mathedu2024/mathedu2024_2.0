import { NextRequest, NextResponse } from 'next/server';
import { deleteAttendanceActivity } from '@/services/attendanceService';
import { getSessionFromCookie } from '@/utils/session';

export async function POST(req: NextRequest) {
  const cookieString = req.headers.get('cookie');
  const session = cookieString ? getSessionFromCookie(cookieString) : null;

  if (!session || !(session.role.includes('teacher') || session.role.includes('admin'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { courseId, activityId } = await req.json();
    if (!courseId || !activityId) {
      return NextResponse.json({ error: 'Course ID and Activity ID are required' }, { status: 400 });
    }

    await deleteAttendanceActivity(courseId, activityId);
    return NextResponse.json({ message: 'Activity deleted successfully' });

  } catch (error) {
    console.error('Error in /api/attendance/activities/delete: ', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
