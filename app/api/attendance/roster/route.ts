import { NextRequest, NextResponse } from 'next/server';
import { getAttendanceRoster } from '@/services/attendanceService';
import { getSessionFromCookie } from '@/utils/session';

export async function POST(req: NextRequest) {
  const cookieString = req.headers.get('cookie');
  const session = cookieString ? getSessionFromCookie(cookieString) : null;

  if (!session || !(session.role.includes('teacher') || session.role.includes('admin'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { activityId, courseId } = await req.json();
    if (!activityId || !courseId) {
      return NextResponse.json({ error: 'Activity ID and Course ID are required' }, { status: 400 });
    }

    const roster = await getAttendanceRoster(courseId, activityId);
    return NextResponse.json(roster);

  } catch (error) {
    console.error('Error in /api/attendance/roster: ', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
