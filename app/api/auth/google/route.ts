import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb, auth } from '@/services/firebase-admin';
import {
  buildAuthSuccessResponse,
  findStudentByGoogleOrEmail,
} from '@/utils/authSessionResponse';
import { resolveStudentRegistration } from '@/utils/resolveStudentRegistration';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idToken = String(body.idToken || '').trim();
    if (!idToken) {
      return NextResponse.json({ error: '缺少 Google 登入憑證' }, { status: 400 });
    }

    const decoded = await auth.verifyIdToken(idToken);
    const googleUid = decoded.uid;
    const email = String(decoded.email || '').trim().toLowerCase();
    const googleName = String(decoded.name || email.split('@')[0] || '學生').trim();

    if (!email) {
      return NextResponse.json({ error: 'Google 帳號未提供電子郵件' }, { status: 400 });
    }

    let studentDoc = await findStudentByGoogleOrEmail(googleUid, email);
    const now = new Date().toISOString();

    if (!studentDoc) {
      // 新帳號：必須帶齊註冊欄位（校內／校外）
      if (!Boolean(body.agreeTerms)) {
        return NextResponse.json(
          { error: '請先至註冊頁填寫資料並同意服務條款後，再使用 Google 註冊' },
          { status: 400 }
        );
      }

      const name = String(body.name || googleName).trim() || googleName;

      let resolved;
      try {
        resolved = await resolveStudentRegistration(body);
      } catch (e) {
        const message = e instanceof Error ? e.message : '註冊資料不正確';
        const status = message.includes('已註冊') || message.includes('已被使用') ? 409 : 400;
        return NextResponse.json({ error: message }, { status });
      }

      const ref = adminDb.collection('student_data').doc(resolved.studentId);
      await ref.set({
        studentId: resolved.studentId,
        name,
        account: resolved.account,
        email,
        password: '',
        googleUid,
        authProvider: 'google',
        registrationSource:
          resolved.registrantType === 'school'
            ? 'google-school'
            : resolved.registrantType === 'professional'
              ? 'google-professional'
              : 'google-visitor',
        registrantType: resolved.registrantType,
        emailVerified: true,
        emailVerifiedAt: now,
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
      studentDoc = await ref.get();
    } else {
      const data = studentDoc.data() || {};
      const patch: Record<string, unknown> = {
        googleUid,
        updatedAt: now,
        // Google 登入視為信箱已驗證
        emailVerified: true,
        emailVerifiedAt: data.emailVerifiedAt || now,
      };
      if (!data.email) patch.email = email;
      if (!data.authProvider) patch.authProvider = 'google';
      if (data.authProvider === 'password' || data.password) {
        patch.authProvider = data.password ? 'password+google' : 'google';
      }
      await studentDoc.ref.set(patch, { merge: true });
      studentDoc = await studentDoc.ref.get();
    }

    const userData = studentDoc.data() || {};
    // 不帶 email 建立／簽發，避免與既有 Google Auth 帳號衝突
    return buildAuthSuccessResponse({
      uid: studentDoc.id,
      name: String(userData.name || googleName),
      account: String(userData.account || email),
      roles: ['student'],
      currentRole: 'student',
    });
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    const message = error instanceof Error ? error.message : 'Google 登入失敗';
    console.error('[auth/google]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
