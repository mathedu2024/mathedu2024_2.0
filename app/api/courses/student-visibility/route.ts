import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let sessionData: { id?: string; role?: string[] | string };
  try {
    sessionData = JSON.parse(decodeURIComponent(sessionCookie.value));
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roleList = Array.isArray(sessionData.role) ? sessionData.role : [sessionData.role || ''];
  const isAdmin = roleList.includes('admin');
  const isTeacher = roleList.includes('teacher');
  if (!isAdmin && !isTeacher) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { courseId, studentVisible } = await req.json();
    if (!courseId || typeof studentVisible !== 'boolean') {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    const courseRef = adminDb.collection('courses').doc(courseId);
    const courseDoc = await courseRef.get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: '找不到課程' }, { status: 404 });
    }

    if (!isAdmin) {
      const teacherId = sessionData.id;
      const teacherIds = (courseDoc.data()?.teachers || []) as string[];
      if (!teacherId || !teacherIds.includes(teacherId)) {
        return NextResponse.json({ error: '無權限修改此課程' }, { status: 403 });
      }
    }

    await courseRef.set(
      {
        studentVisible,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '更新失敗';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
