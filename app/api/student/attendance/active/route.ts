import { NextRequest, NextResponse } from 'next/server';
import { getActiveActivityForCourse } from '@/services/attendanceService';
import { getSessionFromCookie } from '@/utils/session';

export async function GET(req: NextRequest) {
  const cookieString = req.headers.get('cookie');
  const session = cookieString ? getSessionFromCookie(cookieString) : null;

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get('courseId');

  if (!courseId) {
    return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
  }

  try {
    const activity = await getActiveActivityForCourse(courseId);
    if (!activity) {
      return NextResponse.json({ message: 'No active activity found for this course.' }, { status: 404 });
    }
    return NextResponse.json(activity);
  } catch (error) {
    console.error(`Error fetching active attendance activity for course ${courseId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
