import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '../../../../services/firebase-admin';
import { requireAuthFromRequest, authGuard } from '@/services/apiAuth';

export async function POST(req: NextRequest) {
  const denied = authGuard(requireAuthFromRequest(req, 'admin'));
  if (denied) return denied;

  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing student ID' }, { status: 400 });
    }

    const defaultPassword = 'abcd1234';

    await adminDb.collection('student_data').doc(id).update({
      password: defaultPassword,
    });

    return NextResponse.json({
      success: true,
      message: '?????????',
    });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    return NextResponse.json({ error: '?????????' }, { status: 500 });
  }
}
