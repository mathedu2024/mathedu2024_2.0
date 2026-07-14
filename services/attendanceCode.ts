import type { Firestore } from 'firebase-admin/firestore';

const MANUAL_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 取得課程內已使用的點名代碼（不含指定活動） */
export async function getUsedCheckInCodes(
  db: Firestore,
  courseId: string,
  excludeActivityId?: string
): Promise<Set<string>> {
  const snap = await db.collection('courses').doc(courseId).collection('attendance').get();
  const used = new Set<string>();
  snap.docs.forEach((doc) => {
    if (excludeActivityId && doc.id === excludeActivityId) return;
    const code = doc.data().checkInCode;
    if (typeof code === 'string' && code.length > 0) used.add(code);
  });
  return used;
}

export function generateUniqueDigitalCheckInCode(used: Set<string>): string {
  for (let i = 0; i < 100; i++) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    if (!used.has(code)) return code;
  }
  throw new Error('無法產生唯一的數字點名代碼');
}

/** 手動點名用隱藏代碼（M 開頭，不與六位數字簽到碼衝突） */
export function generateUniqueManualCheckInCode(used: Set<string>): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = 'M';
    for (let i = 0; i < 8; i++) {
      code += MANUAL_CODE_CHARS[Math.floor(Math.random() * MANUAL_CODE_CHARS.length)];
    }
    if (!used.has(code)) return code;
  }
  throw new Error('無法產生唯一的手動點名代碼');
}

/** QR 點名用隱藏路由代碼（Q 開頭；實際簽到使用輪換 token，不顯示此碼） */
export function generateUniqueQrCheckInCode(used: Set<string>): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = 'Q';
    for (let i = 0; i < 8; i++) {
      code += MANUAL_CODE_CHARS[Math.floor(Math.random() * MANUAL_CODE_CHARS.length)];
    }
    if (!used.has(code)) return code;
  }
  throw new Error('無法產生唯一的 QR 點名代碼');
}

export function isManualHiddenCheckInCode(code: string): boolean {
  return /^M[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code);
}

export function isQrHiddenCheckInCode(code: string): boolean {
  return /^Q[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code);
}

export function isStudentVisibleCheckInCode(code: string | null | undefined): boolean {
  return typeof code === 'string' && /^\d{6}$/.test(code);
}

export async function assignUniqueCheckInCode(
  db: Firestore,
  courseId: string,
  checkInMethod: 'manual' | 'numeric' | 'qr' | string,
  excludeActivityId?: string
): Promise<string> {
  const used = await getUsedCheckInCodes(db, courseId, excludeActivityId);
  if (checkInMethod === 'numeric') return generateUniqueDigitalCheckInCode(used);
  if (checkInMethod === 'qr') return generateUniqueQrCheckInCode(used);
  return generateUniqueManualCheckInCode(used);
}

/** 僅在進行中的數字點名才對外回傳簽到碼；其餘方式／已結束活動不暴露代碼 */
export function publicCheckInCodeForActivity(data: {
  status?: string;
  checkInMethod?: string;
  checkInCode?: string | null;
}): string | null {
  if (data.status !== 'active') return null;
  if (data.checkInMethod !== 'numeric') return null;
  return isStudentVisibleCheckInCode(data.checkInCode) ? (data.checkInCode as string) : null;
}

/** 若活動缺少點名代碼則補上，並確保課程內唯一 */
export async function ensureActivityCheckInCode(
  db: Firestore,
  courseId: string,
  activityId: string
): Promise<string> {
  const ref = db.collection('courses').doc(courseId).collection('attendance').doc(activityId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('點名活動不存在');

  const data = doc.data()!;
  const existing = data.checkInCode;
  if (typeof existing === 'string' && existing.length > 0) {
    return existing;
  }

  const method =
    data.checkInMethod === 'numeric'
      ? 'numeric'
      : data.checkInMethod === 'qr'
        ? 'qr'
        : 'manual';
  const code = await assignUniqueCheckInCode(db, courseId, method, activityId);
  await ref.update({ checkInCode: code });
  return code;
}
