import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebaseAdmin';
import { getSessionFromCookie } from '@/utils/session';

export async function POST(req: NextRequest) {
  try {
    const cookie = req.headers.get('cookie');
    const session = cookie ? getSessionFromCookie(cookie) : null;

    const role = session?.role;
    const isTeacher = role === 'teacher' || role === '老師' || (Array.isArray(role) && (role.includes('teacher') || role.includes('老師')));
    const isAdmin = role === 'admin' || role === '管理員' || (Array.isArray(role) && (role.includes('admin') || role.includes('管理員')));

    if (!session || (!isTeacher && !isAdmin)) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const body = await req.json();
    const { courseId, title, checkInMethod, startTime, endTime, gracePeriodMinutes, status } = body;

    if (!courseId || !title || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    let checkInCode = null;
    if (checkInMethod === 'numeric') {
      checkInCode = Math.floor(100000 + Math.random() * 900000).toString();
    }

    const activityData = {
      title,
      checkInMethod,
      checkInCode,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      gracePeriodMinutes: Number(gracePeriodMinutes) || 5,
      status: status || 'scheduled',
      courseId,
      createdAt: new Date(),
      createdBy: session.id || session.account,
    };

    const docRef = await adminDb
      .collection('courses')
      .doc(courseId)
      .collection('attendance')
      .add(activityData);

    return NextResponse.json({ 
      success: true, 
      activityId: docRef.id,
      message: '點名活動建立成功' 
    });

  } catch (error) {
    console.error('[API/attendance/activities/create] Error:', error);
    return NextResponse.json({ error: '建立點名活動失敗' }, { status: 500 });
  }
}