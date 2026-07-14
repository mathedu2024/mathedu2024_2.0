import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '../../../../services/firebase-admin';
import { requireAuthFromRequest, authGuard } from '@/services/apiAuth';

export async function POST(req: NextRequest) {
  const denied = authGuard(requireAuthFromRequest(req, 'admin'));
  if (denied) return denied;

  try {
    const data = await req.json();

    if (!data.id || !data.account) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await adminDb.collection('users').doc(data.id).set(data, { merge: true });

    return NextResponse.json({ success: true, message: '????/????' });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
