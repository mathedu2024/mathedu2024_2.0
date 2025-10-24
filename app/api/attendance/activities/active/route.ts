import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { getActiveActivityForCourse } from '@/services/attendanceService';

export async function GET(req: NextRequest) {
  const session = await getSession();

  // 確保用戶是登入的學生
  if (!session || !session.id || (session.currentRole || session.role) !== 'student') {
    return NextResponse.json({ error: '未授權' }, { status: 401 });
  }

  const courseId = req.nextUrl.searchParams.get('courseId');

  if (!courseId) {
    return NextResponse.json({ error: '缺少 courseId 參數' }, { status: 400 });
  }

  try {
    const activeActivity = await getActiveActivityForCourse(courseId);

    // 找不到進行中的活動並非錯誤，直接回傳 null
    return NextResponse.json(activeActivity, { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '查詢活動時發生未知錯誤。';
    console.error(`[API/active-activity] Error for course ${courseId}:`, errorMessage);
    return NextResponse.json({ error: '伺服器內部錯誤，無法查詢進行中的活動。' }, { status: 500 });
  }
}
