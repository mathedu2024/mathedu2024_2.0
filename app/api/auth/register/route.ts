import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb, auth } from '@/services/firebase-admin';
import { buildAuthSuccessResponse, findStudentByAccountOrEmail } from '@/utils/authSessionResponse';
import { resolveStudentRegistration } from '@/utils/resolveStudentRegistration';
import {
  createAndSendEmailVerification,
  requiresEmailVerification,
} from '@/utils/emailVerification';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '').trim();
    const agreeTerms = Boolean(body.agreeTerms);

    if (!agreeTerms) {
      return NextResponse.json({ error: '請先同意服務條款與隱私權政策' }, { status: 400 });
    }
    if (!name || !email || !password) {
      return NextResponse.json({ error: '請填寫姓名、電子郵件與密碼' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: '電子郵件格式不正確' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: '密碼至少需要 8 個字元' }, { status: 400 });
    }
    if (await findStudentByAccountOrEmail(email)) {
      return NextResponse.json({ error: '此電子郵件已被註冊' }, { status: 409 });
    }

    let resolved;
    try {
      resolved = await resolveStudentRegistration(body);
    } catch (e) {
      const message = e instanceof Error ? e.message : '註冊資料不正確';
      const status = message.includes('已註冊') || message.includes('已被使用') ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }

    const needsEmailVerification = requiresEmailVerification(resolved.registrantType);

    try {
      await auth.createUser({
        uid: resolved.studentId,
        email,
        password,
        displayName: name,
        emailVerified: !needsEmailVerification,
      });
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === 'auth/email-already-exists') {
        return NextResponse.json({ error: '此電子郵件已被註冊' }, { status: 409 });
      }
      if (err.code === 'auth/uid-already-exists') {
        return NextResponse.json({ error: '此學號／帳號已存在' }, { status: 409 });
      }
      throw e;
    }

    const now = new Date().toISOString();
    await adminDb.collection('student_data').doc(resolved.studentId).set({
      studentId: resolved.studentId,
      name,
      account: resolved.account,
      email,
      password,
      authProvider: 'password',
      registrationSource: resolved.registrationSource,
      registrantType: resolved.registrantType,
      emailVerified: !needsEmailVerification,
      ...(needsEmailVerification ? {} : { emailVerifiedAt: now }),
      gender: '',
      grade: resolved.grade,
      schoolGroup: resolved.schoolGroup,
      className: resolved.className,
      seatNumber: resolved.seatNumber,
      organization: resolved.organization,
      jobTitle: resolved.jobTitle,
      phone: '',
      address: '',
      remarks: '',
      enrolledCourses: [],
      createdAt: now,
      updatedAt: now,
    });

    if (needsEmailVerification) {
      try {
        await createAndSendEmailVerification({
          req,
          studentId: resolved.studentId,
          account: resolved.account,
          email,
          name,
        });
      } catch (emailErr) {
        console.error('[auth/register] verification email failed:', emailErr);
        // 帳號已建立：仍回傳成功，但提示寄信失敗以便前端顯示重寄
        const authRes = await buildAuthSuccessResponse({
          uid: resolved.studentId,
          name,
          account: resolved.account,
          roles: ['student'],
          currentRole: 'student',
          email,
        });
        const payload = await authRes.json();
        return NextResponse.json(
          {
            ...payload,
            emailVerified: false,
            needsEmailVerification: true,
            emailSendFailed: true,
            message: '帳號已建立，但驗證信寄送失敗，請稍後於頁面重寄。',
          },
          { status: 200, headers: { 'Set-Cookie': authRes.headers.get('Set-Cookie') || '' } }
        );
      }
    }

    const authRes = await buildAuthSuccessResponse({
      uid: resolved.studentId,
      name,
      account: resolved.account,
      roles: ['student'],
      currentRole: 'student',
      email,
    });
    const payload = await authRes.json();
    return NextResponse.json(
      {
        ...payload,
        emailVerified: !needsEmailVerification,
        needsEmailVerification,
      },
      { status: 200, headers: { 'Set-Cookie': authRes.headers.get('Set-Cookie') || '' } }
    );
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    const message = error instanceof Error ? error.message : '註冊失敗';
    console.error('[auth/register]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
