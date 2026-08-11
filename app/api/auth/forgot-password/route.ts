import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { getSiteUrlFromRequest } from '@/utils/accountDefaults';
import { buildPasswordResetEmail } from '@/utils/email';
import { sendAppEmailServer } from '@/utils/emailServer';

const RESET_TTL_MS = 60 * 60 * 1000;

type UserType = 'student' | 'teacher';

function isUserType(v: unknown): v is UserType {
  return v === 'student' || v === 'teacher';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const account = String(body.account || '').trim();
    const userType = body.userType;

    // 一律回傳相同文案，避免探測帳號是否存在
    const genericOk = NextResponse.json({
      success: true,
      message: '若帳號存在且已設定電子郵件，重設密碼信將寄至該信箱。',
    });

    if (!account || !isUserType(userType)) {
      return NextResponse.json({ error: '請提供帳號與身分' }, { status: 400 });
    }

    const collection = userType === 'student' ? 'student_data' : 'users';
    const snap = await adminDb.collection(collection).where('account', '==', account).limit(1).get();
    if (snap.empty) {
      return genericOk;
    }

    const doc = snap.docs[0];
    const data = doc.data() || {};
    const email = String(data.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return genericOk;
    }

    if (userType === 'teacher') {
      const roles: string[] = Array.isArray(data.roles)
        ? data.roles
        : data.role
          ? [data.role]
          : [];
      // 學生不走 users；此處僅確保非空帳號可重設
      if (roles.length === 0) {
        return genericOk;
      }
    }

    const token = randomBytes(24).toString('hex');
    const now = Date.now();
    await adminDb.collection('password_resets').doc(token).set({
      userType,
      userId: doc.id,
      account,
      email,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + RESET_TTL_MS).toISOString(),
    });

    const resetUrl = `${getSiteUrlFromRequest(req)}/reset-password/${token}`;
    const userLabel = userType === 'student' ? '學生' : '老師／管理員';

    try {
      await sendAppEmailServer(
        buildPasswordResetEmail({
          toEmail: email,
          name: String(data.name || ''),
          account,
          resetUrl,
          userLabel,
        })
      );
    } catch (emailErr) {
      console.error('Forgot password email failed:', emailErr);
      await adminDb.collection('password_resets').doc(token).delete();
      return NextResponse.json({ error: '郵件寄送失敗，請稍後再試' }, { status: 502 });
    }

    return genericOk;
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('forgot-password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
