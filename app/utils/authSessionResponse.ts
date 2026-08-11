import { NextResponse } from 'next/server';
import { serialize } from 'cookie';
import { adminDb, auth } from '@/services/firebase-admin';

export type AuthSessionPayload = {
  id: string;
  name: string;
  account: string;
  role: string | string[];
  currentRole: string;
  token: string;
};

export async function ensureFirebaseAuthUser(uid: string, displayName: string, email?: string) {
  try {
    await auth.getUser(uid);
  } catch (e) {
    const error = e as { code?: string };
    if (error.code === 'auth/user-not-found') {
      await auth.createUser({
        uid,
        displayName,
        ...(email ? { email } : {}),
      });
      return;
    }
    throw e;
  }
}

export async function buildAuthSuccessResponse(params: {
  uid: string;
  name: string;
  account: string;
  roles: string[];
  currentRole: string;
  email?: string;
}) {
  await ensureFirebaseAuthUser(params.uid, params.name, params.email);
  const token = await auth.createCustomToken(params.uid, { role: params.currentRole });

  const sessionData = {
    id: params.uid,
    name: params.name,
    role: params.roles,
    account: params.account,
    currentRole: params.currentRole,
  };

  const cookie = serialize('session', JSON.stringify(sessionData), {
    httpOnly: false,
    path: '/',
    sameSite: 'strict',
  });

  const body: AuthSessionPayload = {
    token,
    role: params.roles,
    name: params.name,
    id: params.uid,
    account: params.account,
    currentRole: params.currentRole,
  };

  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
  });
}

export async function findStudentByAccountOrEmail(identifier: string) {
  const value = identifier.trim();
  if (!value) return null;

  const byDocId = await adminDb.collection('student_data').doc(value).get();
  if (byDocId.exists) return byDocId;

  const byAccount = await adminDb
    .collection('student_data')
    .where('account', '==', value)
    .limit(1)
    .get();
  if (!byAccount.empty) return byAccount.docs[0];

  const byStudentId = await adminDb
    .collection('student_data')
    .where('studentId', '==', value)
    .limit(1)
    .get();
  if (!byStudentId.empty) return byStudentId.docs[0];

  const lower = value.toLowerCase();
  if (lower.includes('@')) {
    const byEmail = await adminDb
      .collection('student_data')
      .where('email', '==', lower)
      .limit(1)
      .get();
    if (!byEmail.empty) return byEmail.docs[0];
  }

  return null;
}

export async function findStudentByGoogleOrEmail(googleUid: string, email: string) {
  const byGoogle = await adminDb
    .collection('student_data')
    .where('googleUid', '==', googleUid)
    .limit(1)
    .get();
  if (!byGoogle.empty) return byGoogle.docs[0];

  if (email) {
    const byEmail = await adminDb
      .collection('student_data')
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();
    if (!byEmail.empty) return byEmail.docs[0];
  }

  // 若學生文件 id 就是 Firebase Auth uid
  const byId = await adminDb.collection('student_data').doc(googleUid).get();
  if (byId.exists) return byId;

  return null;
}
