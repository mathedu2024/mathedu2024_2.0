import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { db } from '@/lib/db';
import * as admin from 'firebase-admin';

interface IncomingRecord {
  /** 帳號 id（roster doc id） */
  id?: string;
  /** 學號 */
  studentId: string;
  status: string;
  leaveType?: string;
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
      if (!r.studentId && !r.id) return;

      const recordsDocId = r.studentId || r.id!;
      const recordsRef = activityRef.collection('records').doc(recordsDocId);
      batch.set(
        recordsRef,
        {
          status: r.status || '',
          leaveType: r.status === 'leave' ? (r.leaveType || '其他') : admin.firestore.FieldValue.delete(),
          note: r.note || '',
          updatedAt: new Date(),
        },
        { merge: true }
      );

      // 同步寫入 roster，供學生簽到（請假→出席）判斷
      const rosterDocId = r.id || r.studentId;
      if (rosterDocId) {
        const rosterPayload: Record<string, unknown> = {
          studentId: r.studentId || rosterDocId,
          status: r.status || '',
          remarks: r.note || '',
        };
        if (r.status === 'leave') {
          rosterPayload.leaveType = r.leaveType || '其他';
        } else {
          rosterPayload.leaveType = admin.firestore.FieldValue.delete();
        }
        batch.set(activityRef.collection('roster').doc(rosterDocId), rosterPayload, { merge: true });
      }
    });

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('[API] /api/attendance/records/save error:', error);
    return NextResponse.json(
      { error: '儲存點名紀錄失敗' },
      { status: 500 }
    );
  }
}
