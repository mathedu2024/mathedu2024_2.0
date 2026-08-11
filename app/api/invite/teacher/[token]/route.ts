import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';

type Ctx = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, context: Ctx) {
  try {
    const { token } = await context.params;
    if (!token) {
      return NextResponse.json({ error: '缺少邀請代碼' }, { status: 400 });
    }

    const doc = await adminDb.collection('teacher_invites').doc(token).get();
    if (!doc.exists) {
      return NextResponse.json({ error: '邀請不存在或已失效' }, { status: 404 });
    }

    const data = doc.data() || {};
    if (data.status !== 'pending') {
      return NextResponse.json({ error: '此邀請已使用或已取消' }, { status: 410 });
    }
    if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: '邀請已過期，請聯繫管理員重新寄送' }, { status: 410 });
    }

    return NextResponse.json({
      name: data.name || '',
      email: data.email || '',
      roles: data.roles || [],
      expiresAt: data.expiresAt || null,
    });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
