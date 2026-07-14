import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { requireAuthFromRequest, authGuard } from '@/services/apiAuth';

export async function POST(req: NextRequest) {
  const denied = authGuard(requireAuthFromRequest(req, 'admin'));
  if (denied) return denied;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const snapshot = await adminDb.collection('users').where('account', '==', id).get();
    if (snapshot.empty) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const batch = adminDb.batch();
    snapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    const message = error instanceof Error ? error.message : '????';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
