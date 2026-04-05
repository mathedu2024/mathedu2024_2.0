import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface AttendanceRecord {
  studentId: string;
  status: string;
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

    // 讀取活動基本資訊（供前端 Header 顯示）
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

    // 1. 先讀取專用的 records 子集合（老師在新 UI 儲存的紀錄）
    const recordsRef = activityRef.collection('records');
    const recordsSnap = await recordsRef.get();

    const records: AttendanceRecord[] = recordsSnap.docs.map((doc) => {
      const data = doc.data() as { status?: string; note?: string };
      return {
        studentId: doc.id,
        status: data.status || '',
        note: data.note || '',
      };
    });

    // 2. 若 records 為空，嘗試從舊的 roster 結構帶入既有點名狀態
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

        let statusUi = '';
        const rawStatus = (data.status || '').toString();

        switch (rawStatus) {
          case 'present':
            statusUi = '出席';
            break;
          case 'absent':
            statusUi = '曠課';
            break;
          case 'leave':
            statusUi = data.leaveType || '請假';
            break;
          case 'late':
            statusUi = '遲到';
            break;
          default:
            statusUi = '';
        }

        records.push({
          studentId,
          status: statusUi,
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
