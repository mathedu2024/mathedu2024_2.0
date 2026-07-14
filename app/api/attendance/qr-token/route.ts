import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { getSessionFromCookie } from '@/utils/session';
import {
  buildStudentQrCheckInPath,
  issueOrRefreshQrSession,
} from '@/services/attendanceQrToken';
import { syncAttendanceLifecycle } from '@/services/attendanceLifecycle';

export async function GET(req: NextRequest) {
  const session = getSessionFromCookie(req.headers.get('cookie') || '');
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.role;
  const isTeacher =
    role === 'teacher' ||
    role === '老師' ||
    (Array.isArray(role) && (role.includes('teacher') || role.includes('老師')));
  const isAdmin =
    role === 'admin' ||
    role === '管理員' ||
    (Array.isArray(role) && (role.includes('admin') || role.includes('管理員')));

  if (!isTeacher && !isAdmin) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get('courseId');
  const activityId = searchParams.get('activityId');

  if (!courseId || !activityId) {
    return NextResponse.json({ error: '缺少 courseId 或 activityId' }, { status: 400 });
  }

  try {
    const lifecycle = await syncAttendanceLifecycle(courseId, activityId);
    if (lifecycle.status === 'completed' || lifecycle.status === 'scheduled') {
      return NextResponse.json(
        {
          error:
            lifecycle.status === 'scheduled'
              ? '預約點名尚未開始，開始時間到才會顯示簽到 QR'
              : '點名活動尚未開始或已結束',
        },
        { status: 400 }
      );
    }

    const activityRef = adminDb
      .collection('courses')
      .doc(courseId)
      .collection('attendance')
      .doc(activityId);
    const activityDoc = await activityRef.get();

    if (!activityDoc.exists) {
      return NextResponse.json({ error: '點名活動不存在' }, { status: 404 });
    }

    const data = activityDoc.data()!;
    if (data.checkInMethod !== 'qr') {
      return NextResponse.json({ error: '此活動不是 QR 點名' }, { status: 400 });
    }

    if (data.status !== 'active') {
      return NextResponse.json({ error: '點名活動尚未開始或已結束' }, { status: 400 });
    }

    const { token, expiresAt, rotateSeconds } = await issueOrRefreshQrSession(
      adminDb,
      courseId,
      activityId,
      data as Record<string, unknown>
    );
    const path = buildStudentQrCheckInPath(courseId, activityId, token);
    const origin = req.nextUrl.origin;
    const checkInUrl = `${origin}${path}`;

    return NextResponse.json({
      token,
      expiresAt,
      rotateSeconds,
      checkInUrl,
      path,
    });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('[API/attendance/qr-token] Error:', error);
    return NextResponse.json({ error: '無法產生簽到 QR' }, { status: 500 });
  }
}
