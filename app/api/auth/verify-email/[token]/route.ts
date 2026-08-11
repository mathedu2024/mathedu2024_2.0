import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb, auth } from '@/services/firebase-admin';
import { markStudentEmailVerified } from '@/utils/emailVerification';

type Ctx = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, context: Ctx) {
  try {
    const { token } = await context.params;
    if (!token) {
      return NextResponse.json({ error: '缺少驗證代碼' }, { status: 400 });
    }

    const doc = await adminDb.collection('email_verifications').doc(token).get();
    if (!doc.exists) {
      return NextResponse.json({ error: '連結無效或已失效' }, { status: 404 });
    }

    const data = doc.data() || {};
    if (data.usedAt) {
      return NextResponse.json({ error: '此連結已使用過' }, { status: 410 });
    }
    if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: '連結已過期，請重新寄送驗證信' }, { status: 410 });
    }

    const studentId = String(data.studentId || '');
    if (!studentId) {
      return NextResponse.json({ error: '驗證資料不完整' }, { status: 400 });
    }

    await markStudentEmailVerified(studentId);
    await doc.ref.set({ usedAt: new Date().toISOString() }, { merge: true });

    try {
      await auth.updateUser(studentId, { emailVerified: true });
    } catch {
      // Auth uid 可能與 studentId 不同（極端情況），略過
    }

    return NextResponse.json({
      success: true,
      message: '信箱驗證成功',
      account: data.account || '',
    });
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('[auth/verify-email]', error);
    return NextResponse.json({ error: '驗證失敗' }, { status: 500 });
  }
}
