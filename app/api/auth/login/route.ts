import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb, auth } from '@/services/firebase-admin';
import {
  buildAuthSuccessResponse,
  findStudentByAccountOrEmail,
} from '@/utils/authSessionResponse';

export async function POST(req: NextRequest) {
  try {
    const { account, password, loginType } = await req.json();

    const cleanAccount = account ? String(account).trim() : '';
    const cleanPassword = password ? String(password).trim() : '';
    const type = String(loginType || 'student').trim();

    if (!cleanAccount || !cleanPassword || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (type === 'student') {
      const userDoc = await findStudentByAccountOrEmail(cleanAccount);
      if (!userDoc) {
        return NextResponse.json({ error: '帳號不存在或輸入錯誤' }, { status: 401 });
      }

      const userData = userDoc.data() || {};
      if (userData.authProvider === 'google' && !userData.password) {
        return NextResponse.json(
          { error: '此帳號請使用 Google 登入' },
          { status: 401 }
        );
      }

      if (cleanPassword !== String(userData.password || '')) {
        return NextResponse.json({ error: '密碼錯誤' }, { status: 401 });
      }

      return buildAuthSuccessResponse({
        uid: userDoc.id,
        name: String(userData.name || ''),
        account: String(userData.account || cleanAccount),
        roles: ['student'],
        currentRole: 'student',
        email: String(userData.email || ''),
      });
    }

    const querySnapshot = await adminDb
      .collection('users')
      .where('account', '==', cleanAccount)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return NextResponse.json({ error: '帳號不存在或輸入錯誤' }, { status: 401 });
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    let roles: string[] = [];
    if (userData.roles && Array.isArray(userData.roles)) {
      roles = userData.roles;
    } else if (userData.role && typeof userData.role === 'string') {
      roles = [userData.role];
    }

    if (roles.length === 0) {
      return NextResponse.json({ error: 'User has no assigned role' }, { status: 403 });
    }

    if (!roles.includes(type)) {
      return NextResponse.json({ error: 'Role mismatch' }, { status: 403 });
    }

    if (cleanPassword !== String(userData.password || '')) {
      return NextResponse.json({ error: '密碼錯誤' }, { status: 401 });
    }

    return buildAuthSuccessResponse({
      uid: userDoc.id,
      name: String(userData.name || ''),
      account: cleanAccount,
      roles,
      currentRole: type,
      email: String(userData.email || ''),
    });
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
