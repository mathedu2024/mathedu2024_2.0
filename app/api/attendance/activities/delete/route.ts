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

    const { activityId, courseId } = await req.json();

    if (!activityId || !courseId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    await adminDb
      .collection('courses')
      .doc(courseId)
      .collection('attendance')
      .doc(activityId)
      .delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API/attendance/activities/delete] Error:', error);
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}