import { randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import { getSiteUrlFromRequest } from '@/utils/accountDefaults';
import { buildEmailVerificationEmail } from '@/utils/email';
import { sendAppEmailServer } from '@/utils/emailServer';

const VERIFY_TTL_MS = 48 * 60 * 60 * 1000; // 48 小時
const COLLECTION = 'email_verifications';

/** 舊資料或缺欄位視為已驗證，避免鎖死既有帳號 */
export function isStudentEmailVerified(data: Record<string, unknown> | undefined | null): boolean {
  if (!data) return true;
  return data.emailVerified !== false;
}

/** 校外在學、業界人士：帳密註冊需驗證信箱 */
export function requiresEmailVerification(registrantType: string): boolean {
  return registrantType === 'visitor' || registrantType === 'professional';
}

export async function createAndSendEmailVerification(params: {
  req: NextRequest;
  studentId: string;
  account: string;
  email: string;
  name: string;
}): Promise<void> {
  const token = randomBytes(24).toString('hex');
  const now = Date.now();

  await adminDb.collection(COLLECTION).doc(token).set({
    studentId: params.studentId,
    account: params.account,
    email: params.email.toLowerCase(),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + VERIFY_TTL_MS).toISOString(),
    usedAt: null,
  });

  const verifyUrl = `${getSiteUrlFromRequest(params.req)}/verify-email/${token}`;
  await sendAppEmailServer(
    buildEmailVerificationEmail({
      toEmail: params.email,
      name: params.name,
      account: params.account,
      verifyUrl,
    })
  );
}

export async function markStudentEmailVerified(studentId: string): Promise<void> {
  const now = new Date().toISOString();
  await adminDb.collection('student_data').doc(studentId).set(
    {
      emailVerified: true,
      emailVerifiedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
}
