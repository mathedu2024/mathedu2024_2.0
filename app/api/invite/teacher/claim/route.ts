import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { DEFAULT_ACCOUNT_PASSWORD } from '@/utils/accountDefaults';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body.token || '').trim();
    const account = String(body.account || '').trim();

    if (!token || !account) {
      return NextResponse.json({ error: '缺少邀請代碼或帳號' }, { status: 400 });
    }
    if (!/^[A-Za-z0-9]+$/.test(account)) {
      return NextResponse.json(
        { error: '帳號僅能包含英文字母與數字，不能有空白或標點' },
        { status: 400 }
      );
    }

    const inviteRef = adminDb.collection('teacher_invites').doc(token);
    const inviteDoc = await inviteRef.get();
    if (!inviteDoc.exists) {
      return NextResponse.json({ error: '邀請不存在或已失效' }, { status: 404 });
    }

    const invite = inviteDoc.data() || {};
    if (invite.status !== 'pending') {
      return NextResponse.json({ error: '此邀請已使用或已取消' }, { status: 410 });
    }
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: '邀請已過期，請聯繫管理員重新寄送' }, { status: 410 });
    }

    const dup = await adminDb.collection('users').where('account', '==', account).limit(1).get();
    if (!dup.empty) {
      return NextResponse.json({ error: '此帳號已被使用，請更換' }, { status: 409 });
    }

    const userId = randomUUID();
    const userData = {
      id: userId,
      name: String(invite.name || ''),
      account,
      password: DEFAULT_ACCOUNT_PASSWORD,
      roles: Array.isArray(invite.roles) ? invite.roles : ['teacher'],
      email: String(invite.email || '').toLowerCase(),
      note: String(invite.note || ''),
    };

    await adminDb.collection('users').doc(userId).set(userData);
    await inviteRef.update({
      status: 'claimed',
      claimedAt: new Date().toISOString(),
      claimedAccount: account,
      claimedUserId: userId,
    });

    return NextResponse.json({
      success: true,
      account,
      name: userData.name,
      defaultPassword: DEFAULT_ACCOUNT_PASSWORD,
    });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('claim teacher invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
