import { NextRequest, NextResponse } from 'next/server';
import { createAttendanceActivity } from '@/services/attendanceService';
import { getSessionFromCookie } from '@/utils/session'; // Import getSessionFromCookie

export async function POST(req: NextRequest) {
  const cookieString = req.headers.get('cookie');
  const session = cookieString ? getSessionFromCookie(cookieString) : null;

  // 安全性：檢查用戶是否為老師
  if (!session || (Array.isArray(session.role) ? !session.role.includes('teacher') : session.role !== 'teacher')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    
    // 驗證輸入資料 (簡易版)
    const { courseId, title, checkInMethod, startTime, endTime, gracePeriodMinutes } = body;
    if (!courseId || !title || !checkInMethod || !startTime || !endTime || gracePeriodMinutes === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const activityData = {
      ...body,
      teacherId: session.id, // 從 session 獲取老師 ID
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    };

    const { activityId, checkInCode } = await createAttendanceActivity(activityData);

    return NextResponse.json({ message: 'Activity created successfully', activityId, checkInCode }, { status: 201 });
  } catch (error) {
    console.error('Error in /api/attendance/activities/create: ', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
