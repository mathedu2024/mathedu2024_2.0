import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/utils/session';
import { submitCheckIn } from '@/services/attendanceService';

export async function POST(req: NextRequest) {
  const session = getSessionFromCookie(req.headers.get('cookie') || '');

  if (!session || !session.id || (Array.isArray(session.role) ? !session.role.includes('student') : session.role !== 'student')) {
    return NextResponse.json({ error: '未授權：僅學生能執行此操作。' }, { status: 401 });
  }

  try {
    const requestBody = await req.json();
    console.log('[API/check-in] Incoming request body:', requestBody);
    const { courseId, activityId, checkInCode } = requestBody;

    if (!courseId || !activityId || !checkInCode) {
      return NextResponse.json({ error: '缺少 courseId, activityId 或 checkInCode。' }, { status: 400 });
    }

    const result = await submitCheckIn({
      courseId,
      activityId,
      studentId: session.id,
      checkInCode,
    });

    return NextResponse.json({ message: '簽到成功！', status: result }, { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '簽到時發生未知錯誤。';
    console.error(`[API/check-in] Error for student ${session.id}:`, errorMessage);

    if (errorMessage.includes('已經簽到過了')) {
        return NextResponse.json({ error: errorMessage }, { status: 409 }); // 409 Conflict
    }
    if (errorMessage.includes('不存在') || errorMessage.includes('尚未開始或已結束')) {
        return NextResponse.json({ error: errorMessage }, { status: 404 }); // 404 Not Found or Gone
    }
    if (errorMessage.includes('簽到碼錯誤') || errorMessage.includes('時間已過')) {
        return NextResponse.json({ error: errorMessage }, { status: 400 }); // 400 Bad Request
    }

    return NextResponse.json({ error: '伺服器內部錯誤，請稍後再試。' }, { status: 500 });
  }
}
