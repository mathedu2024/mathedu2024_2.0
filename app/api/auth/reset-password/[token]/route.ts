import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';

type Ctx = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, context: Ctx) {
  try {
    const { token } = await context.params;
    if (!token) {
      return NextResponse.json({ error: '缺少重設代碼' }, { status: 400 });
    }

    const doc = await adminDb.collection('password_resets').doc(token).get();
    if (!doc.exists) {
      return NextResponse.json({ error: '連結無效或已失效' }, { status: 404 });
    }

    const data = doc.data() || {};
    if (data.usedAt) {
      return NextResponse.json({ error: '此連結已使用過' }, { status: 410 });
    }
    if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: '連結已過期，請重新申請' }, { status: 410 });
    }

    return NextResponse.json({
      account: data.account || '',
      userType: data.userType || '',
    });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: Ctx) {
  try {
    const { token } = await context.params;
    const body = await req.json();
    const newPassword = String(body.newPassword || '').trim();

    if (!token) {
      return NextResponse.json({ error: '缺少重設代碼' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: '新密碼至少需 6 個字元' }, { status: 400 });
    }

    const resetRef = adminDb.collection('password_resets').doc(token);
    const resetDoc = await resetRef.get();
    if (!resetDoc.exists) {
      return NextResponse.json({ error: '連結無效或已失效' }, { status: 404 });
    }

    const data = resetDoc.data() || {};
    if (data.usedAt) {
      return NextResponse.json({ error: '此連結已使用過' }, { status: 410 });
    }
    if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: '連結已過期，請重新申請' }, { status: 410 });
    }

    const userType = data.userType === 'student' ? 'student' : 'teacher';
    const collection = userType === 'student' ? 'student_data' : 'users';
    const userId = String(data.userId || '');
    if (!userId) {
      return NextResponse.json({ error: '重設資料不完整' }, { status: 400 });
    }

    const userRef = adminDb.collection(collection).doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: '找不到對應帳號' }, { status: 404 });
    }

    await userRef.update({ password: newPassword });
    await resetRef.update({ usedAt: new Date().toISOString() });

    return NextResponse.json({
      success: true,
      userType,
      loginPath: userType === 'student' ? '/login' : '/login?role=teacher',
    });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('reset-password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
