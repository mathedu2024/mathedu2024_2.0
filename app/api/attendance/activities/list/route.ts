import { NextRequest, NextResponse } from 'next/server';
import { getActivitiesForCourse } from '@/services/attendanceService';
import { getSessionFromCookie } from '@/utils/session';

export async function POST(req: NextRequest) {
  const cookieString = req.headers.get('cookie');
  console.log('API Route: cookieString', cookieString);
  const session = cookieString ? getSessionFromCookie(cookieString) : null;
  console.log('API Route: session', session);

  // Security: Check if user is a teacher or admin
  if (!session || !(session.role.includes('teacher') || session.role.includes('admin'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { courseId } = await req.json();
    if (!courseId) {
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
    }

    const activities = await getActivitiesForCourse(courseId);
    return NextResponse.json(activities);

  } catch (error) {
    console.error('Error in /api/attendance/activities/list: ', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}