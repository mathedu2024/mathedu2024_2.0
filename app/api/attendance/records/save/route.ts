import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface IncomingRecord {
  studentId: string;
  status: string;
  note?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { courseId, activityId, records } = await req.json();

    if (!courseId || !activityId || !Array.isArray(records)) {
      return NextResponse.json(
        { error: 'courseId、activityId 與 records 為必填，且 records 必須為陣列' },
        { status: 400 }
      );
    }

    const activityRef = db
      .collection('courses')
      .doc(courseId)
      .collection('attendance')
      .doc(activityId);

    const batch = db.batch();

    (records as IncomingRecord[]).forEach((r) => {
      if (!r.studentId) return;

      const docRef = activityRef.collection('records').doc(r.studentId);
      batch.set(
        docRef,
        {
          status: r.status || '',
          note: r.note || '',
          updatedAt: new Date(),
        },
        { merge: true }
      );
    });

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] /api/attendance/records/save error:', error);
    return NextResponse.json(
      { error: '儲存點名紀錄失敗' },
      { status: 500 }
    );
  }
}

