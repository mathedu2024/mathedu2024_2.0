import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { getSessionFromCookie } from '@/utils/session';
import { submitCheckIn } from '@/services/attendanceService';
import { finalizeAttendanceIfEnded } from '@/services/attendanceLifecycle';

export async function POST(req: NextRequest) {
  const session = getSessionFromCookie(req.headers.get('cookie') || '');

  if (!session || !session.id || (Array.isArray(session.role) ? !session.role.includes('student') : session.role !== 'student')) {
    return NextResponse.json({ error: '未授權：僅學生能執行此操作。' }, { status: 401 });
  }

  try {
    const requestBody = await req.json();
    console.log('[API/check-in] Incoming request body:', requestBody);
    const { courseId, activityId, checkInCode, qrToken } = requestBody;

    if (!courseId || !activityId || (!checkInCode && !qrToken)) {
      return NextResponse.json({ error: '缺少 courseId, activityId 或簽到憑證。' }, { status: 400 });
    }

    const ended = await finalizeAttendanceIfEnded(courseId, activityId);
    if (ended.status === 'completed') {
      return NextResponse.json({ error: '點名活動尚未開始或已結束。' }, { status: 404 });
    }

    const result = await submitCheckIn({
      courseId,
      activityId,
      studentId: session.id,
      checkInCode,
      qrToken,
    });

    return NextResponse.json({ message: '簽到成功！', status: result }, { status: 200 });

  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    const errorMessage = error instanceof Error ? error.message : '簽到時發生未知錯誤。';
    console.error(`[API/check-in] Error for student ${session.id}:`, errorMessage);

    if (errorMessage.includes('已經簽到') || errorMessage.includes('無需重複掃描')) {
        return NextResponse.json({ error: errorMessage, code: 'ALREADY_CHECKED_IN' }, { status: 409 });
    }
    if (errorMessage.includes('不存在') || errorMessage.includes('尚未開始或已結束')) {
        return NextResponse.json({ error: errorMessage }, { status: 404 });
    }
    if (
      errorMessage.includes('簽到碼錯誤') ||
      errorMessage.includes('時間已過') ||
      errorMessage.includes('QR') ||
      errorMessage.includes('不支援學生自行簽到')
    ) {
        return NextResponse.json(
          {
            error: errorMessage,
            code: errorMessage.includes('QR') ? 'QR_EXPIRED' : undefined,
          },
          { status: 400 }
        );
    }

    return NextResponse.json({ error: '伺服器內部錯誤，請稍後再試。' }, { status: 500 });
  }
}
