import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebaseAdmin';
import { getSessionFromCookie } from '@/utils/session';

export async function POST(req: NextRequest) {
  try {
    console.log('[API/attendance/activities] 收到請求');

    const cookie = req.headers.get('cookie');
    const session = cookie ? getSessionFromCookie(cookie) : null;
    
    console.log('[API/attendance/activities] Session 狀態:', session ? '存在' : '不存在', '角色:', session?.role);

    const role = session?.role;
    const isTeacher = role === 'teacher' || role === '老師' || (Array.isArray(role) && (role.includes('teacher') || role.includes('老師')));
    const isAdmin = role === 'admin' || role === '管理員' || (Array.isArray(role) && (role.includes('admin') || role.includes('管理員')));

    if (!session || (!isTeacher && !isAdmin)) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const body = await req.json();
    const { courseId } = body;
    console.log('[API/attendance/activities] 查詢 CourseId:', courseId);

    if (!courseId) {
      return NextResponse.json({ error: '缺少 courseId 參數' }, { status: 400 });
    }


    const activitiesRef = adminDb
      .collection('courses')
      .doc(courseId)
      .collection('attendance');
      

    const snapshot = await activitiesRef.orderBy('startTime', 'desc').get();
    console.log('[API/attendance/activities] 查詢結果筆數:', snapshot.size);

    const activities = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        startTime: data.startTime?.toDate ? data.startTime.toDate().toISOString() : data.startTime,
        endTime: data.endTime?.toDate ? data.endTime.toDate().toISOString() : data.endTime,
      };
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error('[API/attendance/activities] Error:', error);
    return NextResponse.json({ error: '讀取點名紀錄失敗' }, { status: 500 });
  }
}