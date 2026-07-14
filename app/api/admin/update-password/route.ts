import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '../../../../services/firebase-admin';
import { requireAuthFromRequest, authGuard } from '@/services/apiAuth';

export async function POST(req: NextRequest) {
  const denied = authGuard(requireAuthFromRequest(req, 'admin'));
  if (denied) return denied;

  try {
    const { id, password } = await req.json();

    if (!id || !password) {
      return NextResponse.json({ error: 'Missing user account or password' }, { status: 400 });
    }

    const snapshot = await adminDb.collection('users').where('account', '==', id).get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userDoc = snapshot.docs[0];
    await userDoc.ref.update({ password });

    return NextResponse.json({
      success: true,
      message: '??????',
    });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
