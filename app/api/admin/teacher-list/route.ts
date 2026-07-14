import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '../../../../services/firebase-admin';
import { requireAuthFromRequest, authGuard, stripPasswordsFromDocs } from '@/services/apiAuth';

export async function GET(req: NextRequest) {
  const denied = authGuard(requireAuthFromRequest(req, 'admin'));
  if (denied) return denied;

  try {
    const snapshot = await adminDb.collection('users').where('role', '==', 'teacher').get();
    const teachers = stripPasswordsFromDocs(
      snapshot.docs.map((doc) => ({ id: doc.id, name: doc.data().name ?? '', ...doc.data() }))
    );
    return NextResponse.json(teachers);
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    const message = error instanceof Error ? error.message : '????';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
