import { adminDb as db } from './firebase-admin';
import * as admin from 'firebase-admin';
import { clearQrSession } from './attendanceQrToken';

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isUnrecordedStatus(status: unknown): boolean {
  if (status === null || status === undefined) return true;
  const s = String(status).trim();
  return s === '' || s === 'unrecorded' || s === '未點';
}

/**
 * 預約點名：開始時間到了自動改為 active（才開放 QR／數字簽到）
 */
export async function activateAttendanceIfStarted(
  courseId: string,
  activityId: string
): Promise<{ activated: boolean; status: string }> {
  const ref = db.collection('courses').doc(courseId).collection('attendance').doc(activityId);
  const snap = await ref.get();
  if (!snap.exists) return { activated: false, status: '' };

  const data = snap.data()!;
  const status = String(data.status || '');
  const startTime = toDate(data.startTime);
  const endTime = toDate(data.endTime);
  const now = new Date();

  if (status === 'scheduled' && startTime && now >= startTime && (!endTime || now <= endTime)) {
    await ref.update({
      status: 'active',
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { activated: true, status: 'active' };
  }

  return { activated: false, status };
}

/**
 * 數字／QR 點名結束後：未紀錄學生改為缺席；並將活動標為 completed
 */
export async function finalizeAttendanceIfEnded(
  courseId: string,
  activityId: string
): Promise<{ finalized: boolean; status: string }> {
  const ref = db.collection('courses').doc(courseId).collection('attendance').doc(activityId);
  const snap = await ref.get();
  if (!snap.exists) return { finalized: false, status: '' };

  const data = snap.data()!;
  const status = String(data.status || '');
  const method = String(data.checkInMethod || 'manual');
  const endTime = toDate(data.endTime);
  const now = new Date();

  if (!endTime || now <= endTime) {
    return { finalized: false, status };
  }

  if (status === 'completed' && data.absentFinalizedAt) {
    return { finalized: false, status: 'completed' };
  }

  // 數字／QR：把未紀錄改缺席；請假／已簽到保留
  if (method === 'numeric' || method === 'qr') {
    const rosterSnap = await ref.collection('roster').get();
    if (!rosterSnap.empty) {
      const batch = db.batch();
      rosterSnap.docs.forEach((doc) => {
        const rosterData = doc.data();
        if (isUnrecordedStatus(rosterData.status)) {
          batch.update(doc.ref, {
            status: 'absent',
            leaveType: admin.firestore.FieldValue.delete(),
          });
        }
      });
      await batch.commit();
    }
  }

  await ref.update({
    status: 'completed',
    absentFinalizedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  if (method === 'qr') {
    try {
      await clearQrSession(db, courseId, activityId);
    } catch {
      // ignore
    }
  }

  return { finalized: true, status: 'completed' };
}

/** 進入活動時同步狀態：先結束結算，再啟動預約 */
export async function syncAttendanceLifecycle(
  courseId: string,
  activityId: string
): Promise<{ status: string }> {
  const ended = await finalizeAttendanceIfEnded(courseId, activityId);
  if (ended.status === 'completed') {
    return { status: 'completed' };
  }
  const started = await activateAttendanceIfStarted(courseId, activityId);
  return { status: started.status || ended.status };
}
