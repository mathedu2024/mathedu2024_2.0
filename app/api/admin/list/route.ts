import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { getSessionFromCookie } from '@/utils/session';
import { requireAuth, authGuard, stripPasswordsFromDocs } from '@/services/apiAuth';

export async function GET() {
  const sessionCookie = (await cookies()).get('session');
  const session = sessionCookie?.value
    ? getSessionFromCookie(`session=${sessionCookie.value}`)
    : null;
  const denied = authGuard(requireAuth(session, 'admin'));
  if (denied) return denied;

  try {
    const snapshot = await adminDb.collection('users').get();
    const data = stripPasswordsFromDocs(
      snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    );
    return NextResponse.json(data);
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    throw error;
  }
}
