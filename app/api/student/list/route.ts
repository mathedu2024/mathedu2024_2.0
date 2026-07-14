import { NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { requireAuthFromRequest, authGuard, stripPasswordsFromDocs } from '@/services/apiAuth';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const denied = authGuard(requireAuthFromRequest(req, 'admin', 'teacher'));
  if (denied) return denied;

  try {
    const snapshot = await adminDb.collection('student_data').get();
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
