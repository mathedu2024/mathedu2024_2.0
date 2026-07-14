import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/firebaseAdmin';
import { assignUniqueCheckInCode } from '@/services/attendanceCode';
import { getSessionFromCookie } from '@/utils/session';

export async function POST(req: NextRequest) {
  try {
    const cookie = req.headers.get('cookie');
    const session = cookie ? getSessionFromCookie(cookie) : null;

    const role = session?.role;
    const isTeacher = role === 'teacher' || role === '老師' || (Array.isArray(role) && (role.includes('teacher') || role.includes('老師')));
    const isAdmin = role === 'admin' || role === '管理員' || (Array.isArray(role) && (role.includes('admin') || role.includes('管理員')));

    if (!session || (!isTeacher && !isAdmin)) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const body = await req.json();
    const {
      courseId,
      title,
      checkInMethod,
      startTime,
      endTime,
      gracePeriodMinutes,
      status,
      defaultRosterStatus,
    } = body;

    if (!courseId || !title || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const method = checkInMethod === 'qr' || checkInMethod === 'numeric' || checkInMethod === 'manual'
      ? checkInMethod
      : 'manual';

    const checkInCode = await assignUniqueCheckInCode(adminDb, courseId, method);

    const activityData: Record<string, unknown> = {
      title,
      checkInMethod: method,
      checkInCode,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      gracePeriodMinutes: Number(gracePeriodMinutes) || 5,
      status: status || 'scheduled',
      courseId,
      createdAt: new Date(),
      createdBy: session.id || session.account,
      visibleToStudents: true,
    };

    // 僅手動點名可指定名冊預設；數字／QR 先不填（結束後再把未紀錄改缺席）
    if (method === 'manual') {
      activityData.defaultRosterStatus =
        defaultRosterStatus === 'present' ? 'present' : 'absent';
    }

    const docRef = await adminDb
      .collection('courses')
      .doc(courseId)
      .collection('attendance')
      .add(activityData);

    try {
      const studentsSnap = await adminDb.collection('courses').doc(courseId).collection('students').get();
      if (!studentsSnap.empty) {
        const batch = adminDb.batch();
        const initialStatus =
          method === 'manual'
            ? (defaultRosterStatus === 'present' ? 'present' : 'absent')
            : ''; // 未紀錄

        studentsSnap.docs.forEach((studentDoc) => {
          const s = studentDoc.data();
          batch.set(docRef.collection('roster').doc(studentDoc.id), {
            studentId: s.studentId || studentDoc.id,
            name: s.name || 'N/A',
            status: initialStatus,
            remarks: '',
          });
        });
        await batch.commit();
      }
    } catch (rosterError) {
      console.error('[API/attendance/activities/create] roster init failed:', rosterError);
    }

    const responseCode =
      method === 'numeric' && activityData.status === 'active' ? checkInCode : null;

    return NextResponse.json({
      success: true,
      activityId: docRef.id,
      checkInCode: responseCode,
      routingCode: checkInCode,
      message: '點名活動建立成功',
    });

  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('[API/attendance/activities/create] Error:', error);
    return NextResponse.json({ error: '建立點名活動失敗' }, { status: 500 });
  }
}
