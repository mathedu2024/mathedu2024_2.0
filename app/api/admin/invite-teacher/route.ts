import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { requireAuthFromRequest, authGuard } from '@/services/apiAuth';
import { getSiteUrlFromRequest } from '@/utils/accountDefaults';
import { buildTeacherInviteEmail } from '@/utils/email';
import { sendAppEmailServer } from '@/utils/emailServer';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const denied = authGuard(requireAuthFromRequest(req, 'admin'));
  if (denied) return denied;

  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const note = String(body.note || '').trim();
    const roles = Array.isArray(body.roles) ? body.roles.filter(Boolean) : [];

    if (!name || !email) {
      return NextResponse.json({ error: '姓名與電子郵件為必填' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '電子郵件格式錯誤' }, { status: 400 });
    }
    if (roles.length === 0) {
      return NextResponse.json({ error: '請至少勾選一項系統權限' }, { status: 400 });
    }

    const existingUsers = await adminDb.collection('users').where('email', '==', email).limit(1).get();
    if (!existingUsers.empty) {
      return NextResponse.json({ error: '此電子郵件已有對應帳號' }, { status: 409 });
    }

    const pending = await adminDb
      .collection('teacher_invites')
      .where('email', '==', email)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (!pending.empty) {
      return NextResponse.json({ error: '此電子郵件已有尚未開通的邀請' }, { status: 409 });
    }

    const token = randomBytes(24).toString('hex');
    const now = Date.now();
    const invite = {
      email,
      name,
      roles,
      note,
      status: 'pending' as const,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + INVITE_TTL_MS).toISOString(),
    };
    await adminDb.collection('teacher_invites').doc(token).set(invite);

    const inviteUrl = `${getSiteUrlFromRequest(req)}/invite/teacher/${token}`;
    try {
      await sendAppEmailServer(buildTeacherInviteEmail({ toEmail: email, name, inviteUrl }));
    } catch (emailErr) {
      console.error('Invite email failed:', emailErr);
      await adminDb.collection('teacher_invites').doc(token).delete();
      return NextResponse.json({ error: '邀請信寄送失敗，請稍後再試' }, { status: 502 });
    }

    return NextResponse.json({ success: true, inviteUrl, expiresAt: invite.expiresAt });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('invite-teacher error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
