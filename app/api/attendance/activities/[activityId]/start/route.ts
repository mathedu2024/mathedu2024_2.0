import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/utils/session';
import { startAttendanceActivity } from '@/services/attendanceService';

export async function POST(req: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
  const resolvedParams = await params;
  const { activityId } = resolvedParams;
  const session = await getSession();

  // 1. 驗證教師身分
  if (!session || !session.id || (session.currentRole || session.role) !== 'teacher') {
    return NextResponse.json({ error: '未授權：僅教師能啟動點名活動。' }, { status: 401 });
  }

  // 2. 驗證 activityId
  if (!activityId) {
    return NextResponse.json({ error: '缺少活動 ID。' }, { status: 400 });
  }

  try {
    const { courseId } = await req.json();
    if (!courseId) {
        return NextResponse.json({ error: '缺少課程 ID。' }, { status: 400 });
    }

    // 3. 呼叫 service function
    const checkInCode = await startAttendanceActivity(courseId, activityId);

    // 4. 回傳產生的簽到碼
    return NextResponse.json({ message: '活動已啟動', checkInCode }, { status: 200 });

  } catch (error) {
    // 5. 處理錯誤
    const errorMessage = error instanceof Error ? error.message : '啟動活動時發生未知錯誤。';
    console.error(`[API/start-activity] Error for activity ${activityId}:`, errorMessage);
    return NextResponse.json({ error: '伺服器內部錯誤，無法啟動活動。' }, { status: 500 });
  }
}
