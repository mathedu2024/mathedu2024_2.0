import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { db } from '@/lib/db';
import { ensureActivityCheckInCode, isStudentVisibleCheckInCode } from '@/services/attendanceCode';

export async function POST(req: NextRequest) {
  try {
    const { courseId } = await req.json();
    if (!courseId) return NextResponse.json({ error: 'Course ID required' }, { status: 400 });

    const activitiesRef = db.collection('courses').doc(courseId).collection('attendance');
    const snapshot = await activitiesRef.get();

    const activities = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const status = data.status || 'completed';
        const checkInMethod = data.checkInMethod || 'manual';

        // 僅進行中活動補代碼；舊紀錄不再補寫／暴露代碼
        let checkInCode: string | null = typeof data.checkInCode === 'string' ? data.checkInCode : null;
        if (status === 'active' && !checkInCode) {
          try {
            checkInCode = await ensureActivityCheckInCode(db, courseId, doc.id);
          } catch {
            checkInCode = null;
          }
        }

        // 列表可帶路由碼，但顯示碼僅限進行中的六位數數字
        const displayCode =
          status === 'active' && isStudentVisibleCheckInCode(checkInCode) ? checkInCode : null;

        return {
            id: doc.id,
            title: data.title || data.type || '未命名活動',
            startTime: data.startTime || data.date || new Date().toISOString(),
            endTime: data.endTime || new Date().toISOString(),
            status,
            checkInMethod,
            checkInCode: checkInCode, // 老師路由用（UI 只顯示 display）
            displayCheckInCode: displayCode,
            expected: data.expected || 0,
            present: data.present || 0,
            absent: data.absent || 0,
            leave: data.leave || 0,
            visibleToStudents: data.visibleToStudents !== false,
        };
    }));

    return NextResponse.json(activities);
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
