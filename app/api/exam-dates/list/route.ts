import { NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '../../../../services/firebase-admin';

export async function GET() {
  try {
    const snapshot = await adminDb.collection('exam_dates').get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(data);
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    throw error;
  }
}
