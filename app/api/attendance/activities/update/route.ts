import { NextRequest, NextResponse } from 'next/server';
// 移除可能不存在的 attendanceService，改為直接使用 firebase-admin 進行資料庫操作
import { db } from '@/lib/firebase-admin'; 
import { getSessionFromCookie } from '@/utils/session';

export async function POST(req: NextRequest) {
  const cookieString = req.headers.get('cookie');
  const session = cookieString ? getSessionFromCookie(cookieString) as { role?: string | string[]; currentRole?: string | string[] } : null;

  // 安全地檢查身分權限，防止 session.role 為 undefined 或字串時呼叫 .includes 導致執行階段崩潰
  const role = session?.role || session?.currentRole || '';
  const isTeacherOrAdmin = typeof role === 'string' 
    ? role.includes('teacher') || role.includes('admin') 
    : Array.isArray(role) && (role.includes('teacher') || role.includes('admin'));

  if (!session || !isTeacherOrAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { courseId, activityId, ...updateData } = body;

    if (!courseId || !activityId) {
      return NextResponse.json({ error: 'Course ID and Activity ID are required' }, { status: 400 });
    }

    // 直接寫入 Firestore (符合您的 firestore.rules 結構)
    await db.collection('courses')
      .doc(courseId)
      .collection('attendance')
      .doc(activityId)
      .update(updateData);
      
    return NextResponse.json({ message: 'Activity updated successfully' });

  } catch (error) {
    console.error('Error in /api/attendance/activities/update: ', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
