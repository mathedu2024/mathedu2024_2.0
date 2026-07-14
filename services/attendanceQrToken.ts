import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

/** 每次換碼間隔：隨機 15～40 秒 */
export const QR_ROTATE_MIN_SECONDS = 15;
export const QR_ROTATE_MAX_SECONDS = 40;

/** 換碼後舊 token 仍可短暫使用，避免掃碼當下剛好換碼 */
const QR_PREVIOUS_GRACE_MS = 8000;

function getQrSecret(): string {
  return (
    process.env.ATTENDANCE_QR_SECRET ||
    process.env.FIREBASE_CORE_PRIVATE_KEY ||
    process.env.FIREBASE_PRIVATE_KEY ||
    'attendance-qr-fallback-secret'
  );
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function randomQrRotateSeconds(): number {
  const min = QR_ROTATE_MIN_SECONDS;
  const max = QR_ROTATE_MAX_SECONDS;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function createRandomQrToken(courseId: string, activityId: string): string {
  const nonce = randomBytes(16).toString('hex');
  return createHmac('sha256', getQrSecret())
    .update(`${courseId}:${activityId}:${nonce}:${Date.now()}`)
    .digest('hex')
    .slice(0, 32);
}

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null && 'toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  const parsed = new Date(value as string | number).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export interface QrSessionPayload {
  token: string;
  expiresAt: number;
  rotateSeconds: number;
}

/** 若現有 token 仍有效則沿用；否則產生新 token（隨機 15～40 秒）並寫入活動 */
export async function issueOrRefreshQrSession(
  db: Firestore,
  courseId: string,
  activityId: string,
  activityData: Record<string, unknown>,
  nowMs: number = Date.now()
): Promise<QrSessionPayload> {
  const activityRef = db.collection('courses').doc(courseId).collection('attendance').doc(activityId);
  const currentToken = typeof activityData.qrCurrentToken === 'string' ? activityData.qrCurrentToken : null;
  const currentExpiresAt = toMillis(activityData.qrTokenExpiresAt);

  // 還有超過 1.5 秒才過期：沿用，避免老師輪詢造成頻繁換碼
  if (currentToken && currentExpiresAt !== null && currentExpiresAt - nowMs > 1500) {
    return {
      token: currentToken,
      expiresAt: currentExpiresAt,
      rotateSeconds: Math.max(1, Math.ceil((currentExpiresAt - nowMs) / 1000)),
    };
  }

  const rotateSeconds = randomQrRotateSeconds();
  const token = createRandomQrToken(courseId, activityId);
  const expiresAt = nowMs + rotateSeconds * 1000;

  const update: Record<string, unknown> = {
    qrCurrentToken: token,
    qrTokenExpiresAt: admin.firestore.Timestamp.fromMillis(expiresAt),
    qrRotateSeconds: rotateSeconds,
  };

  if (currentToken) {
    update.qrPreviousToken = currentToken;
    update.qrPreviousExpiresAt = admin.firestore.Timestamp.fromMillis(nowMs + QR_PREVIOUS_GRACE_MS);
  }

  await activityRef.update(update);

  return { token, expiresAt, rotateSeconds };
}

/** 以活動上儲存的目前／前一組 token 驗證（隨機間隔無法用純時間窗推算） */
export function verifyStoredQrToken(
  activityData: Record<string, unknown>,
  token: string,
  nowMs: number = Date.now()
): boolean {
  if (!token || typeof token !== 'string') return false;

  const currentToken = typeof activityData.qrCurrentToken === 'string' ? activityData.qrCurrentToken : null;
  const currentExpiresAt = toMillis(activityData.qrTokenExpiresAt);
  if (currentToken && currentExpiresAt !== null && nowMs <= currentExpiresAt && safeEqual(currentToken, token)) {
    return true;
  }

  const previousToken = typeof activityData.qrPreviousToken === 'string' ? activityData.qrPreviousToken : null;
  const previousExpiresAt = toMillis(activityData.qrPreviousExpiresAt);
  if (previousToken && previousExpiresAt !== null && nowMs <= previousExpiresAt && safeEqual(previousToken, token)) {
    return true;
  }

  return false;
}

export function buildStudentQrCheckInPath(
  courseId: string,
  activityId: string,
  token: string
): string {
  const params = new URLSearchParams({
    courseId,
    activity: activityId,
    token,
  });
  return `/student/attendance?${params.toString()}`;
}

/** 活動結束時清除簽到 token，避免舊碼殘留 */
export async function clearQrSession(db: Firestore, courseId: string, activityId: string): Promise<void> {
  const activityRef = db.collection('courses').doc(courseId).collection('attendance').doc(activityId);
  await activityRef.update({
    qrCurrentToken: admin.firestore.FieldValue.delete(),
    qrTokenExpiresAt: admin.firestore.FieldValue.delete(),
    qrPreviousToken: admin.firestore.FieldValue.delete(),
    qrPreviousExpiresAt: admin.firestore.FieldValue.delete(),
    qrRotateSeconds: admin.firestore.FieldValue.delete(),
  });
}
