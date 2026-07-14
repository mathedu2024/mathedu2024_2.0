import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { db } from '@/lib/db';
import { getCourseEnrolledStudentKeys } from '@/services/attendanceService';
import { syncAttendanceLifecycle } from '@/services/attendanceLifecycle';

interface AttendanceRecord {
  studentId: string;
  status: string;
  leaveType?: string;
  note?: string;
}

interface AttendanceActivityResponse {
  id: string;
  name: string;
  date: string;
  type: string;
  mode: 'manual' | 'digital' | 'qr';
  checkInCode?: string | null;
  status?: string;
  startTime?: string | null;
  endTime?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const normalizeStatus = (rawStatus: string): 'present' | 'absent' | 'leave' | 'late' | '' => {
      const status = (rawStatus || '').toString().trim();
      if (!status) return '';
      if (status === 'present' || status === '出席') return 'present';
      if (status === 'absent' || status === '曠課') return 'absent';
      if (status === 'leave' || status === '請假') return 'leave';
      if (status === 'late' || status === '遲到') return 'late';
      return '';
    };

    const { courseId, activityId } = await req.json();

    if (!courseId || !activityId) {
      return NextResponse.json(
        { error: 'courseId 與 activityId 為必填參數' },
        { status: 400 }
      );
    }

    // 同步預約開始／結束後未紀錄改缺席
    await syncAttendanceLifecycle(courseId, activityId);

    const activityRef = db
      .collection('courses')
      .doc(courseId)
      .collection('attendance')
      .doc(activityId);

    const activityDoc = await activityRef.get();
    let activity: AttendanceActivityResponse | null = null;

    if (activityDoc.exists) {
      const data = activityDoc.data() as {
        startTime?: unknown;
        endTime?: unknown;
        date?: unknown;
        checkInMethod?: string;
        title?: string;
        type?: string;
        checkInCode?: string;
        status?: string;
      };

      const toISO = (d: unknown) => {
        if (!d) return new Date().toISOString();
        if (typeof d === 'string') return d;
        if (d instanceof Date) return d.toISOString();
        if (typeof d === 'object' && d !== null && 'toDate' in d && typeof (d as { toDate: () => Date }).toDate === 'function') {
          return (d as { toDate: () => Date }).toDate().toISOString();
        }
        try {
          return new Date(d as string | number).toISOString();
        } catch {
          return new Date().toISOString();
        }
      };

      const startISO = toISO(data.startTime || data.date || new Date());
      const mode: 'manual' | 'digital' | 'qr' =
        data.checkInMethod === 'numeric'
          ? 'digital'
          : data.checkInMethod === 'qr'
            ? 'qr'
            : 'manual';

      const visibleCode =
        data.status === 'active' && mode === 'digital' && /^\d{6}$/.test(data.checkInCode || '')
          ? data.checkInCode
          : mode === 'qr' || mode === 'manual'
            ? data.checkInCode || null
            : null;

      activity = {
        id: activityDoc.id,
        name: data.title || data.type || '未命名活動',
        date: startISO,
        type: data.type || '一般課程',
        mode,
        checkInCode: visibleCode,
        status: data.status,
        startTime: startISO,
        endTime: data.endTime ? toISO(data.endTime) : null,
      };
    }

    const enrolledKeys = await getCourseEnrolledStudentKeys(courseId);

    const isEnrolledRecord = (studentId: string, data?: { studentId?: string; studentCode?: string }) => {
      const schoolId = String(data?.studentId || data?.studentCode || '');
      return enrolledKeys.has(studentId) || (schoolId !== '' && enrolledKeys.has(schoolId));
    };

    const recordsRef = activityRef.collection('records');
    const recordsSnap = await recordsRef.get();

    const records: AttendanceRecord[] = recordsSnap.docs
      .filter((doc) => isEnrolledRecord(doc.id, doc.data() as { studentId?: string; studentCode?: string }))
      .map((doc) => {
      const data = doc.data() as { status?: string; leaveType?: string; note?: string };
      return {
        studentId: doc.id,
        status: normalizeStatus(data.status || ''),
        leaveType: data.leaveType || '',
        note: data.note || '',
      };
    });

    if (records.length === 0) {
      const rosterRef = activityRef.collection('roster');
      const rosterSnap = await rosterRef.get();

      rosterSnap.forEach((doc) => {
        const data = doc.data() as {
          studentId?: string;
          studentCode?: string;
          status?: string;
          leaveType?: string;
          remarks?: string;
        };

        if (!isEnrolledRecord(doc.id, data)) return;

        const normalizedStatus = normalizeStatus(data.status || '');

        records.push({
          studentId: data.studentId || doc.id,
          status: normalizedStatus,
          leaveType: normalizedStatus === 'leave' ? data.leaveType || '' : '',
          note: data.remarks || '',
        });
        // 若學號與帳號 id 不同，多推一筆以帳號 id 對應（前端 getRecord 會查兩者）
        if (data.studentId && data.studentId !== doc.id) {
          records.push({
            studentId: doc.id,
            status: normalizedStatus,
            leaveType: normalizedStatus === 'leave' ? data.leaveType || '' : '',
            note: data.remarks || '',
          });
        }
      });
    }

    return NextResponse.json({
      records,
      activity,
    });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('[API] /api/attendance/records/get error:', error);
    return NextResponse.json(
      { error: '取得點名紀錄失敗' },
      { status: 500 }
    );
  }
}
