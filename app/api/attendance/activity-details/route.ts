
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import { getSessionFromCookie } from '@/utils/session';

export async function GET(req: NextRequest) {
  const session = getSessionFromCookie(req.headers.get('cookie') || '');
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get('courseId');
  const activityId = searchParams.get('id');

  if (!courseId || !activityId) {
    return NextResponse.json({ error: 'Course ID and Activity ID are required' }, { status: 400 });
  }

  try {
    const activityDoc = await adminDb.collection('courses').doc(courseId).collection('attendance').doc(activityId).get();

    if (!activityDoc.exists) {
      return NextResponse.json({ error: 'Attendance activity not found' }, { status: 404 });
    }

    const activityData = activityDoc.data();
    let courseName = '未知課程';

    const courseDoc = await adminDb.collection('courses').doc(courseId).get();
    if (courseDoc.exists) {
      courseName = courseDoc.data()?.name || '未知課程';
    }
    
    const responseData = {
      id: activityDoc.id,
      title: activityData?.title,
      courseName: courseName, 
      checkInMethod: activityData?.checkInMethod,
      startTime: activityData?.startTime.toDate(),
      endTime: activityData?.endTime.toDate(),
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching activity details:', error);
    return NextResponse.json({ error: 'Failed to fetch activity details' }, { status: 500 });
  }
}
