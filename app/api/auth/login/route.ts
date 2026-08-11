import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { serialize } from 'cookie';
import { adminDb, auth } from '../../../../services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const db = adminDb;
    const { account, password, loginType } = await req.json();

    const cleanAccount = account ? account.trim() : '';
    const cleanPassword = password ? password.trim() : '';

    if (!cleanAccount || !cleanPassword || !loginType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const userQuery = loginType === 'student'
      ? db.collection('student_data').where('account', '==', cleanAccount)
      : db.collection('users').where('account', '==', cleanAccount);

    const querySnapshot = await userQuery.get();

    if (querySnapshot.empty) {
      return NextResponse.json({ error: '帳號不存在或輸入錯誤' }, { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    let roles: string[] = [];
    if (loginType === 'student') {
      roles = ['student'];
    } else if (userData.roles && Array.isArray(userData.roles)) {
      roles = userData.roles;
    } else if (userData.role && typeof userData.role === 'string') {
      roles = [userData.role];
    }

    if (roles.length === 0) {
      return NextResponse.json({ error: 'User has no assigned role' }, { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    if (!roles.includes(loginType)) {
      return NextResponse.json({ error: 'Role mismatch' }, { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const userRole = roles;
    const roleForToken = loginType;

    // 密碼雜湊遷移將於專題研究中實作；目前維持明文比對以相容既有資料
    const passwordIsValid = cleanPassword === userData.password;

    if (!passwordIsValid) {
      return NextResponse.json({ error: '密碼錯誤' }, { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const uid = userDoc.id;

    if (!uid) {
      throw new Error('User data is incomplete.');
    }

    try {
      await auth.getUser(uid);
    } catch (e) {
      const siteReadErrorResponse = trySiteDbReadErrorResponse(e, req);
      if (siteReadErrorResponse) return siteReadErrorResponse;

      const error = e as { code?: string };
      if (error.code === 'auth/user-not-found') {
        if (!userData.name) {
          throw new Error('User data is incomplete for auth creation.');
        }
        await auth.createUser({
          uid,
          displayName: userData.name,
        });
      } else {
        throw e;
      }
    }

    const customToken = await auth.createCustomToken(uid, { role: roleForToken });

    const responseData = {
      token: customToken,
      role: userRole,
      name: userData.name,
      id: userDoc.id,
      account: cleanAccount,
    };

    const sessionData = {
      id: userDoc.id,
      name: userData.name,
      role: userRole,
      account: cleanAccount,
      currentRole: loginType,
    };

    // 不設 maxAge：瀏覽器工作階段 cookie，關閉瀏覽器後即清除
    const cookie = serialize('session', JSON.stringify(sessionData), {
      httpOnly: false,
      path: '/',
      sameSite: 'strict',
    });

    return new NextResponse(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
