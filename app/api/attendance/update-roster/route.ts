import { NextRequest, NextResponse } from 'next/server';
import { updateAttendanceRoster } from '@/services/attendanceService';
import { getSessionFromCookie } from '@/utils/session';

export async function POST(req: NextRequest) {
  const cookieString = req.headers.get('cookie');
  const session = cookieString ? getSessionFromCookie(cookieString) : null;

  if (!session || !(session.role.includes('teacher') || session.role.includes('admin'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { activityId, roster, courseId } = await req.json();
    if (!activityId || !roster || !courseId) {
      return NextResponse.json({ error: 'Activity ID, roster data, and Course ID are required' }, { status: 400 });
    }

    await updateAttendanceRoster(courseId, activityId, roster);
    return NextResponse.json({ message: 'Attendance roster updated successfully' });

  } catch (error) {
    console.error('Error in /api/attendance/update-roster: ', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
