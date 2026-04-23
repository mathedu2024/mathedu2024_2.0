import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
  mode: 'manual' | 'digital';
  checkInCode?: string | null;
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
        date?: unknown;
        checkInMethod?: string;
        title?: string;
        type?: string;
        checkInCode?: string;
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

      const rawDate = toISO(data.startTime || data.date || new Date());
      const mode: 'manual' | 'digital' =
        data.checkInMethod === 'numeric' ? 'digital' : 'manual';

      activity = {
        id: activityDoc.id,
        name: data.title || data.type || '未命名活動',
        date: rawDate,
        type: data.type || '一般課程',
        mode,
        checkInCode: data.checkInCode || null,
      };
    }

    const recordsRef = activityRef.collection('records');
    const recordsSnap = await recordsRef.get();

    const records: AttendanceRecord[] = recordsSnap.docs.map((doc) => {
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
        const studentId =
          data.studentId || data.studentCode || doc.id;

        const normalizedStatus = normalizeStatus(data.status || '');

        records.push({
          studentId,
          status: normalizedStatus,
          leaveType: normalizedStatus === 'leave' ? data.leaveType || '' : '',
          note: data.remarks || '',
        });
      });
    }

    return NextResponse.json({
      records,
      activity,
    });
  } catch (error) {
    console.error('[API] /api/attendance/records/get error:', error);
    return NextResponse.json(
      { error: '取得點名紀錄失敗' },
      { status: 500 }
    );
  }
}
