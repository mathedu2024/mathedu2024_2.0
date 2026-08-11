import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { findStudentByAccountOrEmail } from '@/utils/authSessionResponse';
import {
  createAndSendEmailVerification,
  isStudentEmailVerified,
} from '@/utils/emailVerification';
import { getSessionFromCookie } from '@/utils/session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const emailFromBody = String(body.email || '').trim().toLowerCase();

    // 優先用登入 session；否則用 email 查（註冊後 check-email 頁）
    const session = getSessionFromCookie(req.headers.get('cookie') || '');
    let studentId = '';
    let account = '';
    let email = '';
    let name = '';

    const isStudentSession =
      session &&
      (session.currentRole === 'student' ||
        session.role === 'student' ||
        (Array.isArray(session.role) && session.role.includes('student')));

    if (session?.id && isStudentSession) {
      const doc = await adminDb.collection('student_data').doc(session.id).get();
      if (doc.exists) {
        const data = doc.data() || {};
        studentId = doc.id;
        account = String(data.account || session.account || '');
        email = String(data.email || emailFromBody || '').toLowerCase();
        name = String(data.name || session.name || '');
        if (isStudentEmailVerified(data)) {
          return NextResponse.json({ success: true, alreadyVerified: true, message: '信箱已驗證' });
        }
      }
    }

    if (!studentId && emailFromBody) {
      const found = await findStudentByAccountOrEmail(emailFromBody);
      if (found) {
        const data = found.data() || {};
        studentId = found.id;
        account = String(data.account || '');
        email = String(data.email || emailFromBody).toLowerCase();
        name = String(data.name || '');
        if (isStudentEmailVerified(data)) {
          return NextResponse.json({ success: true, alreadyVerified: true, message: '信箱已驗證' });
        }
      }
    }

    if (!studentId || !email) {
      // 避免探測帳號
      return NextResponse.json({
        success: true,
        message: '若帳號存在且尚未驗證，驗證信將寄至該信箱。',
      });
    }

    try {
      await createAndSendEmailVerification({
        req,
        studentId,
        account: account || studentId,
        email,
        name,
      });
    } catch (emailErr) {
      console.error('[auth/resend-verification]', emailErr);
      return NextResponse.json({ error: '郵件寄送失敗，請稍後再試' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: '驗證信已寄出，請至信箱查收。',
    });
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('[auth/resend-verification]', error);
    return NextResponse.json({ error: '重寄失敗' }, { status: 500 });
  }
}
